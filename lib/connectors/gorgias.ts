import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, GorgiasCredentials } from "@/types/connector";

export async function deleteGorgias(
  email: string,
  creds: GorgiasCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Basic ${Buffer.from(creds.email + ":" + creds.api_key).toString("base64")}`,
  };
  const base = `https://${creds.domain}.gorgias.com/api`;

  try {
    const searchRes = await fetchWithRetry(
      `${base}/customers?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "gorgias",
        status: "failed",
        message: `Gorgias search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Gorgias returns either { _embedded: { customers: [...] } } or { data: [...] }.
    const customers: Array<{ id: number | string }> =
      search?._embedded?.customers ?? search?.data ?? [];
    if (customers.length === 0) {
      return {
        integration: "gorgias",
        status: "skipped",
        message: "No Gorgias customers matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `${base}/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "gorgias",
          status: "failed",
          message: `Gorgias deletion failed for ${c.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "gorgias",
      status: "success",
      message: `Deleted ${deleted} Gorgias customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "gorgias",
      status: "failed",
      message: "Gorgias deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
