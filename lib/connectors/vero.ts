import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, VeroCredentials } from "@/types/connector";

const VERO_BASE = "https://api.getvero.com/api/v2";

/**
 * Vero: the auth token is passed as a query param (not a header) per Vero's API
 * convention. First resolve the user id by email, then delete that user. If no
 * user resolves, report skipped honestly.
 *
 * NOTE: Vero's REST API documents `auth_token` as a query-string parameter for
 * these endpoints (e.g. ?auth_token=...). It is intentionally NOT sent in an
 * Authorization header here to match Vero's expected auth scheme.
 */
export async function deleteVero(
  email: string,
  creds: VeroCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const token = creds.auth_token;

  try {
    const listRes = await fetchWithRetry(
      `${VERO_BASE}/users/?email=${encodeURIComponent(email)}&auth_token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? `HTTP ${listRes.status}`;
      return {
        integration: "vero",
        status: "failed",
        message: "Vero user lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    // Vero returns users under `users` (array) or a single `user` object.
    const users: Array<{ id?: string | number }> = Array.isArray(list.users)
      ? list.users
      : list.user
        ? [list.user]
        : [];
    const ids = users
      .map((u) => u.id)
      .filter((id): id is string | number => id !== undefined);

    if (ids.length === 0) {
      return {
        integration: "vero",
        status: "skipped",
        message: "No Vero user matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      const delRes = await fetchWithRetry(
        `${VERO_BASE}/users/${encodeURIComponent(String(id))}?auth_token=${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
      if (delRes.ok) deleted++;
      else {
        const b = await parseJsonSafe(delRes);
        failed.push(`${id}: ${b?.message ?? delRes.status}`);
      }
    }

    if (deleted === 0) {
      return {
        integration: "vero",
        status: "failed",
        message: "Vero deletion failed",
        error: failed.join("; "),
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "vero",
      status: "success",
      message: `Deleted ${deleted} Vero user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "vero",
      status: "failed",
      message: "Vero deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
