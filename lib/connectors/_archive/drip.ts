import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, DripCredentials } from "@/types/connector";

/** Drip — DELETE a subscriber by email (email is Drip's subscriber key). */
export async function deleteDrip(
  email: string,
  creds: DripCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://api.getdrip.com/v2/${creds.account_id}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/subscribers/${encodeURIComponent(email)}`,
      { method: "DELETE", headers },
    );
    if (res.status === 404) {
      return {
        integration: "drip",
        status: "skipped",
        message: "No Drip subscriber matched that email",
        durationMs: Date.now() - start,
      };
    }
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "drip",
        status: "failed",
        message: `Drip returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "drip",
      status: "success",
      message: "Deleted Drip subscriber",
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "drip",
      status: "failed",
      message: "Drip deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
