import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ClerkCredentials } from "@/types/connector";

const CLERK_BASE = "https://api.clerk.dev";

export async function deleteClerk(
  email: string,
  creds: ClerkCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetchWithRetry(
      `${CLERK_BASE}/v1/users?email_address=${encodeURIComponent(email)}&limit=100`,
      { method: "GET", headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      const msg = b?.errors?.[0]?.message ?? `HTTP ${res.status}`;
      return {
        integration: "clerk",
        status: "failed",
        message: `Clerk API returned ${res.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const users: Array<{ id: string }> = json.data ?? [];
    if (users.length === 0) {
      return {
        integration: "clerk",
        status: "skipped",
        message: "No Clerk users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(`${CLERK_BASE}/v1/users/${u.id}`, {
        method: "DELETE",
        headers,
      });
      if (delRes.status === 404) continue;
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const m = b?.errors?.[0]?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "clerk",
          status: "failed",
          message: `Failed to delete Clerk user ${u.id}`,
          error: m,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }
    return {
      integration: "clerk",
      status: "success",
      message: `Deleted ${deleted} Clerk user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "clerk",
      status: "failed",
      message: "Clerk deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
