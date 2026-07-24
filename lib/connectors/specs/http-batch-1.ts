import type { ConnectorSpec } from "../engine/types";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";
import type { ConnectorResult } from "@/types/connector";

/**
 * BATCH 1 HTTP SPECS — declarative conversions of the connectors in
 * lib/connectors/{intercom,salesforce,segment,klaviyo,sendgrid,auth0,clerk,
 * posthog,zendesk,mixpanel}.ts.
 *
 * Conversions mirror http-batch-0.ts exactly. Four connectors
 * (intercom, auth0, clerk, zendesk) reduce cleanly to a single
 * find + per-resource delete and are encoded as HttpSpec. The other
 * six cannot be expressed as a single find+delete with the engine's
 * four pagination strategies / per-resource delete model, so they are
 * encoded as CustomSpec run() functions that copy the original source
 * verbatim (only adapting credentials to Record<string,string> access).
 *
 * Deviations from the original source, all forced by the engine
 * contract (documented in the PR / CHANGELOG):
 *  - intercom: cursorBody injects `starting_after` at the top level of
 *    the POST body on subsequent pages (the original nested it in
 *    `pagination.starting_after`). This is the canonical cursorBody
 *    mapping for Intercom's `pages.next.starting_after` cursor.
 *  - auth0: resultsPath is "" because /api/v2/users-by-email returns a
 *    bare JSON array (engine falls back to the whole payload).
 */

// ─────────────────────────────────────────────────────────────────────────
// CustomSpec run() implementations (faithful copies of the originals)
// ─────────────────────────────────────────────────────────────────────────

async function runSalesforce(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const escapeSoql = (s: string) => s.replace(/'/g, "''");
  const base = (creds.instance_url ?? "").replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${creds.access_token ?? ""}`,
    "Content-Type": "application/json",
  };

  try {
    let deleted = 0;
    let nextUrl: string | undefined =
      `${base}/services/data/v60.0/query?q=${encodeURIComponent(
        `SELECT Id FROM Contact WHERE Email = '${escapeSoql(email)}'`,
      )}`;

    // Follow nextRecordsUrl pagination so every matching Contact is deleted.
    while (nextUrl) {
      const res = await fetchWithRetry(nextUrl, { method: "GET", headers });
      if (!res.ok) {
        const body = await parseJsonSafe(res);
        const msg = body?.["error"]?.["message"] ?? JSON.stringify(body).slice(0, 200);
        return {
          integration: "salesforce",
          status: "failed",
          message: `Salesforce API returned ${res.status}`,
          error: msg ?? `HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }
      const json = await parseJsonSafe(res);
      const records: Array<{ Id: string }> = json.records ?? [];

      for (const r of records) {
        const delRes = await fetchWithRetry(
          `${base}/services/data/v60.0/sobjects/Contact/${r.Id}`,
          { method: "DELETE", headers },
        );
        if (delRes.status === 404) continue; // already gone
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          const m = b?.["error"]?.["message"] ?? `HTTP ${delRes.status}`;
          return {
            integration: "salesforce",
            status: "failed",
            message: `Failed to delete Salesforce Contact ${r.Id}`,
            error: m,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      nextUrl =
        json.done === false && json.nextRecordsUrl
          ? `${base}/${json.nextRecordsUrl.replace(/^\//, "")}`
          : undefined;
    }

    if (deleted === 0) {
      return {
        integration: "salesforce",
        status: "skipped",
        message: "No Salesforce contacts matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "salesforce",
      status: "success",
      message: `Deleted ${deleted} Salesforce contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "salesforce",
      status: "failed",
      message: "Salesforce deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runSegment(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const url = `https://platform.segmentapis.com/v1beta/workspaces/${encodeURIComponent(
    creds.workspace ?? "",
  )}/users/delete`;
  const headers = {
    Authorization: `Bearer ${creds.access_token ?? ""}`,
    "Content-Type": "application/json",
  };

  try {
    // Segment's Regulation API deletes by user_id (no server-side email
    // lookup exists), so the email is used as the user_id — the common
    // pattern when the external id equals the email.
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: email }),
    });
    if (!res.ok) {
      const body = await parseJsonSafe(res);
      const msg = body?.message ?? JSON.stringify(body).slice(0, 200);
      return {
        integration: "segment",
        status: "failed",
        message: `Segment API returned ${res.status}`,
        error: msg ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "segment",
      status: "success",
      message: `Queued deletion for Segment user "${email}"`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "segment",
      status: "failed",
      message: "Segment deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runKlaviyo(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Klaviyo-API-Key ${creds.api_key ?? ""}`,
    revision: "2024-10-15",
  };

  try {
    let deleted = 0;
    let nextUrl: string | undefined =
      `https://a.klaviyo.com/api/profiles/?filter=${encodeURIComponent(
        `equals(email,"${email}")`,
      )}&page[size]=100`;

    while (nextUrl) {
      const res = await fetchWithRetry(nextUrl, { method: "GET", headers });
      if (!res.ok) {
        const body = await parseJsonSafe(res);
        const msg = body?.detail ?? JSON.stringify(body).slice(0, 200);
        return {
          integration: "klaviyo",
          status: "failed",
          message: `Klaviyo API returned ${res.status}`,
          error: msg ?? `HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }
      const json = await parseJsonSafe(res);
      const profiles: Array<{ id: string }> = json.data ?? [];

      for (const p of profiles) {
        const delRes = await fetchWithRetry(`https://a.klaviyo.com/api/profiles/${p.id}/`, {
          method: "DELETE",
          headers,
        });
        if (delRes.status === 404) continue;
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          const m = b?.detail ?? `HTTP ${delRes.status}`;
          return {
            integration: "klaviyo",
            status: "failed",
            message: `Failed to delete Klaviyo profile ${p.id}`,
            error: m,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      nextUrl = json.links?.next ?? undefined;
    }

    if (deleted === 0) {
      return {
        integration: "klaviyo",
        status: "skipped",
        message: "No Klaviyo profiles matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "klaviyo",
      status: "success",
      message: `Deleted ${deleted} Klaviyo profile(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "klaviyo",
      status: "failed",
      message: "Klaviyo deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runSendGrid(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const escapeLike = (s: string) => s.replace(/'/g, "''");
  const headers = { Authorization: `Bearer ${creds.api_key ?? ""}` };

  try {
    // Search marketing contacts by email.
    const searchRes = await fetchWithRetry(
      `https://api.sendgrid.com/v3/marketing/contacts/search`,
      { method: "POST", headers, body: JSON.stringify({ query: `email LIKE '${escapeLike(email)}'` }) },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.errors?.[0]?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "sendgrid",
        status: "failed",
        message: `SendGrid search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const search = await parseJsonSafe(searchRes);
    const contacts: Array<{ id: string }> = search.result ?? [];
    if (contacts.length === 0) {
      return {
        integration: "sendgrid",
        status: "skipped",
        message: "No SendGrid contacts matched that email",
        durationMs: Date.now() - start,
      };
    }

    // Bulk delete by id array (single call, not per-resource).
    const ids = contacts.map((c) => c.id);
    const delRes = await fetchWithRetry(`https://api.sendgrid.com/v3/marketing/contacts`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!delRes.ok) {
      const b = await parseJsonSafe(delRes);
      const msg = b?.errors?.[0]?.message ?? `HTTP ${delRes.status}`;
      return {
        integration: "sendgrid",
        status: "failed",
        message: "SendGrid deletion failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "sendgrid",
      status: "success",
      message: `Queued deletion of ${ids.length} SendGrid contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "sendgrid",
      status: "failed",
      message: "SendGrid deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runPostHog(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = (creds.host ?? "").replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${creds.api_key ?? ""}` };

  try {
    let deleted = 0;
    let nextUrl: string | undefined =
      `${base}/api/projects/${creds.project_id ?? ""}/persons/?email=${encodeURIComponent(
        email,
      )}&limit=100`;

    while (nextUrl) {
      const res = await fetchWithRetry(nextUrl, { method: "GET", headers });
      if (!res.ok) {
        const b = await parseJsonSafe(res);
        const msg = b?.detail ?? `HTTP ${res.status}`;
        return {
          integration: "posthog",
          status: "failed",
          message: `PostHog API returned ${res.status}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      const json = await parseJsonSafe(res);
      const persons: Array<{ id: number | string }> = json.results ?? [];

      for (const p of persons) {
        const delRes = await fetchWithRetry(
          `${base}/api/projects/${creds.project_id ?? ""}/persons/${p.id}/`,
          { method: "DELETE", headers },
        );
        if (delRes.status === 404) continue;
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          const m = b?.detail ?? `HTTP ${delRes.status}`;
          return {
            integration: "posthog",
            status: "failed",
            message: `Failed to delete PostHog person ${p.id}`,
            error: m,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      nextUrl = json.next ?? undefined;
    }

    if (deleted === 0) {
      return {
        integration: "posthog",
        status: "skipped",
        message: "No PostHog persons matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "posthog",
      status: "success",
      message: `Deleted ${deleted} PostHog person(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "posthog",
      status: "failed",
      message: "PostHog deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runMixpanel(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const basic = Buffer.from(`${creds.api_secret ?? ""}:`).toString("base64");
  const headers = {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
  };

  try {
    // Find the user's $distinct_id(s) by the $email profile property.
    const searchUrl =
      `https://mixpanel.com/api/2.0/engage/?project_id=${encodeURIComponent(creds.project_id ?? "")}` +
      `&where=${encodeURIComponent(JSON.stringify({ $email: email }))}`;
    const searchRes = await fetchWithRetry(searchUrl, { method: "GET", headers });
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.error ?? JSON.stringify(b).slice(0, 200) ?? `HTTP ${searchRes.status}`;
      return {
        integration: "mixpanel",
        status: "failed",
        message: `Mixpanel API returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const search = await parseJsonSafe(searchRes);
    const results: Array<{ $distinct_id?: string; distinct_id?: string }> =
      search.results ?? [];
    const ids = results
      .map((r) => r.$distinct_id ?? r.distinct_id)
      .filter((x): x is string => typeof x === "string");

    if (ids.length === 0) {
      return {
        integration: "mixpanel",
        status: "skipped",
        message: "No Mixpanel profiles matched that email",
        durationMs: Date.now() - start,
      };
    }

    // Delete each People profile by distinct_id (POST with id in body).
    let deleted = 0;
    for (const id of ids) {
      const delRes = await fetchWithRetry(
        `https://mixpanel.com/api/2.0/engage/?project_id=${encodeURIComponent(creds.project_id ?? "")}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ $delete: "", $distinct_id: id }),
        },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const m = b?.error ?? `HTTP ${delRes.status}`;
        return {
          integration: "mixpanel",
          status: "failed",
          message: `Failed to delete Mixpanel profile ${id}`,
          error: m,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }
    return {
      integration: "mixpanel",
      status: "success",
      message: `Deleted ${deleted} Mixpanel profile(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "mixpanel",
      status: "failed",
      message: "Mixpanel deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// The batch
// ─────────────────────────────────────────────────────────────────────────

export const HTTP_BATCH_1: ConnectorSpec[] = [
  // ── Intercom: POST contact search (cursor in body), DELETE each contact ──
  {
    key: "intercom",
    transport: "http",
    label: "Intercom",
    baseUrl: "https://api.intercom.io",
    auth: { type: "bearer" },
    headers: { "Intercom-Version": "2.11", "Content-Type": "application/json" },
    find: {
      method: "POST",
      path: "/contacts/search",
      body: () => ({
        query: { field: "email", operator: "=", value: "{email}" },
        pagination: { per_page: 100 },
      }),
      paginate: { type: "cursorBody", param: "starting_after", nextPath: "pages.next.starting_after" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/contacts/{res.id}",
      successStatuses: [200, 204],
      ignoreStatuses: [404],
      itemNoun: "contact",
    },
  },

  // ── Salesforce: SOQL query + nextRecordsUrl pagination (CustomSpec) ──
  {
    key: "salesforce",
    transport: "custom",
    label: "Salesforce",
    run: runSalesforce,
  },

  // ── Segment: single Regulation-API POST, no find (CustomSpec) ──
  {
    key: "segment",
    transport: "custom",
    label: "Segment",
    run: runSegment,
  },

  // ── Klaviyo: profile search + links.next full-URL pagination (CustomSpec) ──
  {
    key: "klaviyo",
    transport: "custom",
    label: "Klaviyo",
    run: runKlaviyo,
  },

  // ── SendGrid: search then bulk DELETE by id array (CustomSpec) ──
  {
    key: "sendgrid",
    transport: "custom",
    label: "SendGrid",
    run: runSendGrid,
  },

  // ── Auth0: GET users-by-email (bare array), DELETE each user ──
  {
    key: "auth0",
    transport: "http",
    label: "Auth0",
    baseUrl: "https://{cred.domain}",
    auth: { type: "bearer", token: "{cred.management_api_token}" },
    find: {
      method: "GET",
      path: "/api/v2/users-by-email",
      query: { email: "{email}" },
      resultsPath: "",
      idPath: "user_id",
    },
    delete: {
      method: "DELETE",
      path: "/api/v2/users/{res.user_id}",
      ignoreStatuses: [404],
      itemNoun: "user",
    },
  },

  // ── Clerk: GET users by email_address, DELETE each user ──
  {
    key: "clerk",
    transport: "http",
    label: "Clerk",
    baseUrl: "https://api.clerk.dev",
    auth: { type: "bearer", token: "{cred.api_key}" },
    headers: { "Content-Type": "application/json" },
    find: {
      method: "GET",
      path: "/v1/users",
      query: { email_address: "{email}", limit: "100" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/v1/users/{res.id}",
      ignoreStatuses: [404],
      itemNoun: "user",
    },
  },

  // ── PostHog: GET persons + json.next full-URL pagination (CustomSpec) ──
  {
    key: "posthog",
    transport: "custom",
    label: "PostHog",
    run: runPostHog,
  },

  // ── Zendesk: GET user search (basic auth email/token:token), DELETE each ──
  {
    key: "zendesk",
    transport: "http",
    label: "Zendesk",
    baseUrl: "https://{cred.subdomain}.zendesk.com",
    auth: { type: "basic", user: "{cred.agent_email}/token", pass: "{cred.api_token}" },
    find: {
      method: "GET",
      path: "/api/v2/users/search.json",
      query: { query: "email:{email}" },
      resultsPath: "users",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/api/v2/users/{res.id}.json",
      ignoreStatuses: [404],
      itemNoun: "user",
    },
  },

  // ── Mixpanel: engage $email lookup + POST $delete per distinct_id (CustomSpec) ──
  {
    key: "mixpanel",
    transport: "custom",
    label: "Mixpanel",
    run: runMixpanel,
  },
];
