import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, MemberstackCredentials } from "@/types/connector";

/**
 * Memberstack: look up members by email and delete each match. Tries the public
 * API host; both response shapes (`data` and `members`) are handled.
 */
export async function deleteMemberstack(
  email: string,
  creds: MemberstackCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };
  const base = "https://api.memberstack.com/v1";

  try {
    const listRes = await fetchWithRetry(
      `${base}/members?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? `HTTP ${listRes.status}`;
      return {
        integration: "memberstack",
        status: "failed",
        message: "Memberstack member lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const members: Array<{ id?: string }> = list.data ?? list.members ?? [];
    if (members.length === 0) {
      return {
        integration: "memberstack",
        status: "skipped",
        message: "No Memberstack member matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const m of members) {
      if (!m.id) continue;
      const delRes = await fetchWithRetry(`${base}/members/${m.id}`, {
        method: "DELETE",
        headers,
      });
      if (delRes.ok) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "memberstack",
        status: "skipped",
        message: "No Memberstack member matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "memberstack",
      status: "success",
      message: `Deleted ${deleted} Memberstack member(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "memberstack",
      status: "failed",
      message: "Memberstack deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
