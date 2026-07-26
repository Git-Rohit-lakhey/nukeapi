import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, StytchCredentials } from "@/types/connector";

/** Stytch — search users by email, then DELETE each match. */
export async function deleteStytch(
  email: string,
  creds: StytchCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://api.stytch.com";
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.secret}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(`${base}/v1/users/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: email, limit: 100 }),
    });
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "stytch",
        status: "failed",
        message: `Stytch returned ${res.status}`,
        error: b?.error_message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const users: Array<{ user_id: string }> = json.results ?? [];
    if (users.length === 0) {
      return {
        integration: "stytch",
        status: "skipped",
        message: "No Stytch user matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const u of users) {
      const d = await fetchWithRetry(`${base}/v1/users/${u.user_id}`, {
        method: "DELETE",
        headers,
      });
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "stytch",
        status: "failed",
        message: "Failed to delete any Stytch user",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "stytch",
      status: "success",
      message: `Deleted ${deleted} Stytch user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "stytch",
      status: "failed",
      message: "Stytch deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
