import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, Auth0Credentials } from "@/types/connector";

export async function deleteAuth0(
  email: string,
  creds: Auth0Credentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = creds.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${creds.management_api_token}` };

  try {
    const res = await fetchWithRetry(
      `https://${base}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      const msg = b?.message ?? `HTTP ${res.status}`;
      return {
        integration: "auth0",
        status: "failed",
        message: `Auth0 API returned ${res.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const users: Array<{ user_id: string }> = await parseJsonSafe(res);
    if (!Array.isArray(users) || users.length === 0) {
      return {
        integration: "auth0",
        status: "skipped",
        message: "No Auth0 users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `https://${base}/api/v2/users/${encodeURIComponent(u.user_id)}`,
        { method: "DELETE", headers },
      );
      if (delRes.status === 404) continue;
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const m = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "auth0",
          status: "failed",
          message: `Failed to delete Auth0 user ${u.user_id}`,
          error: m,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }
    return {
      integration: "auth0",
      status: "success",
      message: `Deleted ${deleted} Auth0 user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "auth0",
      status: "failed",
      message: "Auth0 deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
