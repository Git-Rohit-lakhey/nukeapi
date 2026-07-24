import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, HelpScoutCredentials } from "@/types/connector";

// NOTE: Help Scout uses API-key Basic auth (the api_key is the username,
// password is empty), not a Bearer token. This is intentional and per their
// v2 API docs.
const HS_BASE = "https://api.helpscout.net/v2";

export async function deleteHelpScout(
  email: string,
  creds: HelpScoutCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Basic ${Buffer.from(creds.api_key + ":").toString("base64")}`,
  };

  try {
    const searchRes = await fetchWithRetry(
      `${HS_BASE}/customers?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "helpscout",
        status: "failed",
        message: `Help Scout search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const customers: Array<{ id: number | string }> =
      search?._embedded?.customers ?? [];
    if (customers.length === 0) {
      return {
        integration: "helpscout",
        status: "skipped",
        message: "No Help Scout customers matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `${HS_BASE}/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "helpscout",
          status: "failed",
          message: `Help Scout deletion failed for ${c.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "helpscout",
      status: "success",
      message: `Deleted ${deleted} Help Scout customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "helpscout",
      status: "failed",
      message: "Help Scout deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
