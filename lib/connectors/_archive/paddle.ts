import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, PaddleCredentials } from "@/types/connector";

/** Paddle — find customers by email, then DELETE each. */
export async function deletePaddle(
  email: string,
  creds: PaddleCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://api.paddle.com";
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/customers?email=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "paddle",
        status: "failed",
        message: `Paddle returned ${res.status}`,
        error: b?.error?.detail ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const customers: Array<{ id: string }> = json.data ?? [];
    if (customers.length === 0) {
      return {
        integration: "paddle",
        status: "skipped",
        message: "No Paddle customer matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const c of customers) {
      const d = await fetchWithRetry(`${base}/customers/${c.id}`, {
        method: "DELETE",
        headers,
      });
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "paddle",
        status: "failed",
        message: "Failed to delete any Paddle customer",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "paddle",
      status: "success",
      message: `Deleted ${deleted} Paddle customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "paddle",
      status: "failed",
      message: "Paddle deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
