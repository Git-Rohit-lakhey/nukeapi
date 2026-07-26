import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, GrooveCredentials } from "@/types/connector";

const GROOVE_BASE = "https://api.groovehq.com/v1";

export async function deleteGroove(
  email: string,
  creds: GrooveCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.access_token}` };

  try {
    const searchRes = await fetchWithRetry(
      `${GROOVE_BASE}/customers?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "groove",
        status: "failed",
        message: `Groove search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Groove returns either { customers: [...] } or { data: [...] }.
    const customers: Array<{ id: number | string }> =
      search?.customers ?? search?.data ?? [];
    if (customers.length === 0) {
      return {
        integration: "groove",
        status: "skipped",
        message: "No Groove customers matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `${GROOVE_BASE}/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "groove",
          status: "failed",
          message: `Groove deletion failed for ${c.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "groove",
      status: "success",
      message: `Deleted ${deleted} Groove customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "groove",
      status: "failed",
      message: "Groove deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
