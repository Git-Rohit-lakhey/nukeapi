import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, LemonSqueezyCredentials } from "@/types/connector";

const LS_BASE = "https://api.lemonsqueezy.com/v1";

export async function deleteLemonSqueezy(
  email: string,
  creds: LemonSqueezyCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  try {
    const searchRes = await fetchWithRetry(
      `${LS_BASE}/customers?filter[email]=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.errors?.[0]?.detail ?? b?.error ?? `HTTP ${searchRes.status}`;
      return {
        integration: "lemonsqueezy",
        status: "failed",
        message: `LemonSqueezy lookup failed`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const customers: Array<{ id: string | number }> = search?.data ?? [];
    if (customers.length === 0) {
      return {
        integration: "lemonsqueezy",
        status: "skipped",
        message: `No LemonSqueezy customers matched ${email}`,
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    let lastErr: string | undefined;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `${LS_BASE}/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        lastErr = b?.errors?.[0]?.detail ?? b?.error ?? `HTTP ${delRes.status}`;
        continue;
      }
      deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "lemonsqueezy",
        status: "failed",
        message: "Failed to delete any LemonSqueezy customer",
        error: lastErr,
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "lemonsqueezy",
      status: "success",
      message: `Deleted ${deleted} LemonSqueezy customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "lemonsqueezy",
      status: "failed",
      message: "LemonSqueezy deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
