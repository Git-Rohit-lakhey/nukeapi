import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, JuneCredentials } from "@/types/connector";

/** June — forget a user by email (treated as user_id). */
export async function deleteJune(
  email: string,
  creds: JuneCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://api.june.so/api/v1";
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(`${base}/forget`, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: email, workspace_id: creds.workspace_id }),
    });
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "june",
        status: "failed",
        message: `June returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "june",
      status: "success",
      message: `Queued June forget request for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "june",
      status: "failed",
      message: "June deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
