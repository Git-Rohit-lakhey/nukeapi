import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, SupabaseTargetCredentials } from "@/types/connector";

/**
 * Deletes the user from the CUSTOMER's own Supabase project (not NukeAPI's).
 * Uses the admin user endpoint with their service-role key.
 */
export async function deleteSupabaseUser(
  email: string,
  creds: SupabaseTargetCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = creds.project_url.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${creds.service_role_key}`,
    apikey: creds.service_role_key,
  };

  try {
    const res = await fetchWithRetry(
      `${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!res.ok) {
      const body = await parseJsonSafe(res);
      return {
        integration: "supabase",
        status: "failed",
        message: `Supabase admin API returned ${res.status}`,
        error: body?.message ?? body?.msg ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }

    const json = await parseJsonSafe(res);
    const users: Array<{ id: string }> =
      json?.data?.users ?? json?.users ?? json?.data ?? [];

    if (!Array.isArray(users) || users.length === 0) {
      return {
        integration: "supabase",
        status: "skipped",
        message: "No Supabase users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `${base}/auth/v1/admin/users/${u.id}`,
        { method: "DELETE", headers },
      );
      if (delRes.status === 404) continue;
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        return {
          integration: "supabase",
          status: "failed",
          message: `Failed to delete Supabase user ${u.id}`,
          error: b?.message ?? `HTTP ${delRes.status}`,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "supabase",
      status: "success",
      message: `Deleted ${deleted} Supabase user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "supabase",
      status: "failed",
      message: "Supabase deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
