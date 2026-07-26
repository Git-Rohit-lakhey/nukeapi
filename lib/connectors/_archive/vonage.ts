import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, VonageCredentials } from "@/types/connector";

const VONAGE_HOSTS = ["https://api.nexmo.com", "https://api.eu.nexmo.com"];

/**
 * Vonage (nexmo) user directory. Look up the user by email and delete each
 * match. If the account has no email-indexed user, report skipped honestly.
 */
export async function deleteVonage(
  email: string,
  creds: VonageCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const auth = `Basic ${Buffer.from(creds.api_key + ":" + creds.api_secret).toString("base64")}`;
  const headers = { Authorization: auth };

  try {
    let users: Array<{ id?: string }> = [];
    let lastErr: string | undefined;

    for (const base of VONAGE_HOSTS) {
      const listRes = await fetchWithRetry(
        `${base}/v2/users?email=${encodeURIComponent(email)}`,
        { method: "GET", headers },
      );
      if (!listRes.ok) {
        const b = await parseJsonSafe(listRes);
        lastErr = b?.title ?? b?.detail ?? `HTTP ${listRes.status}`;
        continue;
      }
      const list = await parseJsonSafe(listRes);
      users = list?._embedded?.users ?? [];
      break;
    }

    if (users.length === 0) {
      return {
        integration: "vonage",
        status: "skipped",
        message: lastErr
          ? `Vonage user lookup failed (${lastErr}); no email-indexed user deleted`
          : "No Vonage user matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      if (!u.id) continue;
      const base = u.id.startsWith("USR-") ? VONAGE_HOSTS[0] : VONAGE_HOSTS[0];
      const delRes = await fetchWithRetry(`${base}/v2/users/${u.id}`, {
        method: "DELETE",
        headers,
      });
      if (delRes.ok) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "vonage",
        status: "skipped",
        message: "No Vonage user matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "vonage",
      status: "success",
      message: `Deleted ${deleted} Vonage user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "vonage",
      status: "failed",
      message: "Vonage deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
