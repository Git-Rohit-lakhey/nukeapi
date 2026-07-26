import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, OktaCredentials } from "@/types/connector";

/** Okta — search users by email, then DELETE each. */
export async function deleteOkta(
  email: string,
  creds: OktaCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://${creds.domain}`;
  const headers = {
    Authorization: `SSWS ${creds.api_token}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/api/v1/users?search=${encodeURIComponent(`profile.email eq "${email}"`)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "okta",
        status: "failed",
        message: `Okta returned ${res.status}`,
        error: b?.errorSummary ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const users: Array<{ id: string }> = await res.json();
    if (!Array.isArray(users) || users.length === 0) {
      return {
        integration: "okta",
        status: "skipped",
        message: "No Okta user matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const u of users) {
      const d = await fetchWithRetry(`${base}/api/v1/users/${u.id}`, {
        method: "DELETE",
        headers,
      });
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "okta",
        status: "failed",
        message: "Failed to delete any Okta user",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "okta",
      status: "success",
      message: `Deleted ${deleted} Okta user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "okta",
      status: "failed",
      message: "Okta deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
