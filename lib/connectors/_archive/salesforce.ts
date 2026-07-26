import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, SalesforceCredentials } from "@/types/connector";

const SF_API = "services/data/v60.0";

/** SOQL strings are interpolated (emails are validated upstream), but guard
 * single quotes by doubling them to avoid a trivial injection. */
function escapeSoql(s: string): string {
  return s.replace(/'/g, "''");
}

export async function deleteSalesforce(
  email: string,
  creds: SalesforceCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = creds.instance_url.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    let deleted = 0;
    let nextUrl: string | undefined =
      `${base}/${SF_API}/query?q=${encodeURIComponent(
        `SELECT Id FROM Contact WHERE Email = '${escapeSoql(email)}'`,
      )}`;

    // 6.11 — follow nextRecordsUrl pagination so every matching Contact is
    // deleted, not just the first page.
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
          `${base}/${SF_API}/sobjects/Contact/${r.Id}`,
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
