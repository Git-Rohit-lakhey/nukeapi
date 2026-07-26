import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, GumroadCredentials } from "@/types/connector";

const GR_BASE = "https://api.gumroad.com/v2";

export async function deleteGumroad(
  email: string,
  creds: GumroadCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.access_token}` };

  try {
    const searchRes = await fetchWithRetry(
      `${GR_BASE}/customers.json?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? b?.error ?? `HTTP ${searchRes.status}`;
      return {
        integration: "gumroad",
        status: "failed",
        message: "Gumroad lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const customers: Array<{ id: string | number }> =
      search?.customers ?? search?.results ?? [];
    if (customers.length === 0) {
      return {
        integration: "gumroad",
        status: "skipped",
        message: `No Gumroad customers matched ${email}`,
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    let lastErr: string | undefined;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `${GR_BASE}/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        lastErr = b?.message ?? b?.error ?? `HTTP ${delRes.status}`;
        continue;
      }
      deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "gumroad",
        status: "failed",
        message: "Failed to delete any Gumroad customer",
        error: lastErr,
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "gumroad",
      status: "success",
      message: `Deleted ${deleted} Gumroad customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "gumroad",
      status: "failed",
      message: "Gumroad deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
