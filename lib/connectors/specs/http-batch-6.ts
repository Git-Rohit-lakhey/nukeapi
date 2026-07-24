import type { ConnectorResult } from "@/types/connector";
import type { ConnectorSpec } from "../engine/types";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";
import { validateSqlIdentifier } from "../postgresql";

/**
 * Batch 6 connector specs.
 *
 *  - airtable, braze, iterable  -> CustomSpec (run functions)
 *      airtable: loops over MULTIPLE table_ids (single-baseUrl engine cannot
 *                express this) and validates each as a SQL identifier.
 *      braze:    two-step (export to resolve external_id, then delete) with a
 *                non-item-list response shape (external_ids[] | users[]).
 *      iterable: a single POST /users/delete with the email — no find step.
 *
 *  - webflow, memberstack, outseta, vero -> HttpSpec
 *      webflow/ memberstack/ outseta: classic find-by-email + delete-each.
 *      vero:                    find-by-email + delete-each, but auth is a
 *                query param (auth_token) rather than a header, so the token
 *                is interpolated into the path/query templates.
 *
 * Run functions below are faithful copies of the originals in
 * lib/connectors/<name>.ts, adapted to `Record<string,string>` creds.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM SPECS
// ─────────────────────────────────────────────────────────────────────────────

const AT_BASE = "https://api.airtable.com/v0";

async function deleteAirtable(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key ?? ""}` };

  const tables = (creds.table_ids ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tables.length === 0) {
    return {
      integration: "airtable",
      status: "failed",
      message: "No Airtable table IDs provided",
      error: "table_ids must be a non-empty comma-separated list",
      durationMs: Date.now() - start,
    };
  }

  // §6.14 — validate every identifier before interpolation, including the email
  // column, which is interpolated into the filter formula (the value itself is
  // escaped separately).
  for (const t of tables) {
    if (!validateSqlIdentifier(t)) {
      return {
        integration: "airtable",
        status: "failed",
        message: `Invalid Airtable table id: ${t}`,
        error: "table id must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/",
        durationMs: Date.now() - start,
      };
    }
  }
  if (!validateSqlIdentifier(creds.email_column ?? "")) {
    return {
      integration: "airtable",
      status: "failed",
      message: `Invalid Airtable email column: ${creds.email_column ?? ""}`,
      error: "email column must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/",
      durationMs: Date.now() - start,
    };
  }

  try {
    let total = 0;
    const errors: string[] = [];

    for (const table of tables) {
      const formula = `{${creds.email_column}}='${email.replace(/'/g, "\\'")}'`;
      // §6.11 — Airtable list results are paginated via `offset`; loop until the
      // last page (no offset returned) so no matching record is missed.
      let offset: string | undefined;
      do {
        const url =
          `${AT_BASE}/${creds.base_id}/${encodeURIComponent(table)}` +
          `?filterByFormula=${encodeURIComponent(formula)}` +
          (offset ? `&offset=${encodeURIComponent(offset)}` : "");

        const listRes = await fetchWithRetry(url, { method: "GET", headers });
        if (!listRes.ok) {
          const b = await parseJsonSafe(listRes);
          const msg = b?.error?.message ?? `HTTP ${listRes.status}`;
          errors.push(`${table}: ${msg}`);
          break;
        }

        const list = await parseJsonSafe(listRes);
        const records: Array<{ id?: string }> = list.records ?? [];

        for (const r of records) {
          if (!r.id) continue;
          const delRes = await fetchWithRetry(
            `${AT_BASE}/${creds.base_id}/${encodeURIComponent(table)}/${r.id}`,
            { method: "DELETE", headers },
          );
          if (delRes.ok) total++;
          else {
            const b = await parseJsonSafe(delRes);
            errors.push(`${table}/${r.id}: ${b?.error?.message ?? delRes.status}`);
          }
        }
        offset = list.offset;
      } while (offset);
    }

    if (total === 0) {
      return {
        integration: "airtable",
        status: "skipped",
        message: errors.length
          ? `No Airtable records matched that email (${errors.join("; ")})`
          : "No Airtable records matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "airtable",
      status: "success",
      message: `Deleted ${total} Airtable record(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "airtable",
      status: "failed",
      message: "Airtable deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function deleteBraze(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key ?? ""}`,
    "Content-Type": "application/json",
  };
  const instanceUrl = (creds.instance_url ?? "").replace(/\/$/, "");

  try {
    const exportRes = await fetchWithRetry(
      `${instanceUrl}/users/export/segment?fields_to_export[]=external_id&email_address=${encodeURIComponent(email)}`,
      { method: "POST", headers },
    );
    if (!exportRes.ok) {
      const b = await parseJsonSafe(exportRes);
      const msg = b?.message ?? `HTTP ${exportRes.status}`;
      return {
        integration: "braze",
        status: "failed",
        message: "Braze user export failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const exportBody = await parseJsonSafe(exportRes);
    const externalIds: string[] = Array.isArray(exportBody?.external_ids)
      ? exportBody.external_ids
      : ((exportBody?.users ?? [])
          .map((u: { external_id?: string }) => u.external_id)
          .filter(Boolean) as string[]);

    if (externalIds.length === 0) {
      return {
        integration: "braze",
        status: "skipped",
        message: "No Braze user matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    const failedIds: string[] = [];
    for (const externalId of externalIds) {
      const delRes = await fetchWithRetry(`${instanceUrl}/users/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ external_ids: [externalId] }),
      });
      if (delRes.ok) deleted++;
      else {
        const b = await parseJsonSafe(delRes);
        failedIds.push(`${externalId}: ${b?.message ?? delRes.status}`);
      }
    }

    if (deleted === 0) {
      return {
        integration: "braze",
        status: "failed",
        message: "Braze deletion failed",
        error: failedIds.join("; "),
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "braze",
      status: "success",
      message: `Requested deletion of ${deleted} Braze user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "braze",
      status: "failed",
      message: "Braze deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function deleteIterable(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key ?? ""}`,
    "Content-Type": "application/json",
  };

  try {
    const delRes = await fetchWithRetry(`https://api.iterable.com/api/users/delete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    });

    // 404 / 400 indicating no such user -> honest skip, not a success.
    if (delRes.status === 404 || delRes.status === 400) {
      const b = await parseJsonSafe(delRes);
      return {
        integration: "iterable",
        status: "skipped",
        message: b?.message ?? "No Iterable user matched that email",
        durationMs: Date.now() - start,
      };
    }

    if (!delRes.ok) {
      const b = await parseJsonSafe(delRes);
      const msg = b?.message ?? b?.msg ?? `HTTP ${delRes.status}`;
      return {
        integration: "iterable",
        status: "failed",
        message: "Iterable deletion failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "iterable",
      status: "success",
      message: `Requested deletion of Iterable user for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "iterable",
      status: "failed",
      message: "Iterable deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP SPECS
// ─────────────────────────────────────────────────────────────────────────────

export const HTTP_BATCH_6: ConnectorSpec[] = [
  // ── Webflow: GET members by email, DELETE each member ──
  {
    key: "webflow",
    transport: "http",
    label: "Webflow",
    baseUrl: "https://api.webflow.com/v2",
    auth: { type: "bearer", token: "{cred.api_token}" },
    find: {
      method: "GET",
      path: "/sites/{cred.site_id}/members",
      query: { email: "{email}" },
      resultsPath: "members",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/sites/{cred.site_id}/members/{res.id}",
      // 204 = removed; 404 = member already gone (skip); 401/403 = auth hard-fail.
      // Per-member delete failures are tolerated and kept (continueOnOther), and
      // zero deletions report skipped — matching the original connector.
      successStatuses: [200, 204],
      ignoreStatuses: [404],
      failStatuses: [401, 403],
      continueOnOther: true,
      itemNoun: "member",
    },
  },

  // ── Memberstack: GET members by email (v1 `data` envelope), DELETE each ──
  {
    key: "memberstack",
    transport: "http",
    label: "Memberstack",
    baseUrl: "https://api.memberstack.com/v1",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/members",
      query: { email: "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/members/{res.id}",
      successStatuses: [200, 204],
      ignoreStatuses: [404],
      failStatuses: [401, 403],
      continueOnOther: true,
      itemNoun: "member",
    },
  },

  // ── Outseta: GET people by email (`items`, id `Uid`), DELETE each ──
  {
    key: "outseta",
    transport: "http",
    label: "Outseta",
    baseUrl: "https://api.outseta.com/v1",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/crm/people",
      query: { email: "{email}" },
      resultsPath: "items",
      idPath: "Uid",
    },
    delete: {
      method: "DELETE",
      path: "/crm/people/{res.Uid}",
      successStatuses: [200, 204],
      ignoreStatuses: [404],
      failStatuses: [401, 403],
      continueOnOther: true,
      itemNoun: "person",
    },
  },

  // ── Vero: GET users by email (auth_token in query, not header), DELETE each ──
  // The engine has no query-param auth scheme, so the token is interpolated
  // directly into the find `query` map and the delete `path`. Query values are
  // URL-encoded by the engine for the find step; the delete path token is raw
  // (Vero tokens contain no reserved characters in practice).
  {
    key: "vero",
    transport: "http",
    label: "Vero",
    baseUrl: "https://api.getvero.com/api/v2",
    auth: { type: "none" },
    find: {
      method: "GET",
      path: "/users/",
      query: { email: "{email}", auth_token: "{cred.auth_token}" },
      resultsPath: "users",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/users/{res.id}?auth_token={cred.auth_token}",
      successStatuses: [200, 204],
      ignoreStatuses: [404],
      // No hard-fail set: the original tolerates any per-user failure, records
      // it, continues, and finally reports success if at least one delete
      // succeeded (or skipped if none did). continueOnOther mirrors that.
      failStatuses: [],
      continueOnOther: true,
      itemNoun: "user",
    },
  },

  // ── Airtable: loops over multiple tables, per-table find+delete ──
  {
    key: "airtable",
    transport: "custom",
    label: "Airtable",
    run: deleteAirtable,
  },

  // ── Braze: export to resolve external_id, then delete each by id ──
  {
    key: "braze",
    transport: "custom",
    label: "Braze",
    run: deleteBraze,
  },

  // ── Iterable: single POST /users/delete with the email (no find step) ──
  {
    key: "iterable",
    transport: "custom",
    label: "Iterable",
    run: deleteIterable,
  },
];
