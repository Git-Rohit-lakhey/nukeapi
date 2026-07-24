import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, WorkOSCredentials } from "@/types/connector";

const WORKOS_BASE = "https://api.workos.com";

export async function deleteWorkOS(
  email: string,
  creds: WorkOSCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  try {
    // List directory users in the given directory matching the email.
    const listRes = await fetchWithRetry(
      `${WORKOS_BASE}/directory_users?directory=${encodeURIComponent(
        creds.directory_id,
      )}&email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? `HTTP ${listRes.status}`;
      return {
        integration: "workos",
        status: "failed",
        message: `WorkOS lookup returned ${listRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const users: Array<{ id: string }> = list.data ?? [];
    if (users.length === 0) {
      return {
        integration: "workos",
        status: "skipped",
        message: "No WorkOS directory user matched that email",
        durationMs: Date.now() - start,
      };
    }

    // Delete every matching directory user (directory sync is authoritative
    // for the downstream provider, so removal here deprovisions access).
    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `${WORKOS_BASE}/directory_users/${encodeURIComponent(u.id)}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "workos",
          status: "failed",
          message: `WorkOS deletion failed for user ${u.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted += 1;
    }

    return {
      integration: "workos",
      status: "success",
      message: `Deleted ${deleted} WorkOS directory user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "workos",
      status: "failed",
      message: "WorkOS deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
