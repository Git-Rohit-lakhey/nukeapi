import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import { validateSqlIdentifier } from "./postgresql";
import type { ConnectorResult, AirtableCredentials } from "@/types/connector";

const AT_BASE = "https://api.airtable.com/v0";

/**
 * Airtable: delete records across one or more tables that match the email in
 * the configured column. Table IDs are interpolated into the URL path, so per
 * Section 6.14 each is validated against the strict SQL-identifier allowlist
 * before use. The email itself is passed as a value inside a formula string.
 */
export async function deleteAirtable(
  email: string,
  creds: AirtableCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  const tables = creds.table_ids
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

  // 6.14 — validate every identifier before interpolation, including the email
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
  if (!validateSqlIdentifier(creds.email_column)) {
    return {
      integration: "airtable",
      status: "failed",
      message: `Invalid Airtable email column: ${creds.email_column}`,
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
