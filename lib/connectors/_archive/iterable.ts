import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, IterableCredentials } from "@/types/connector";

const IT_BASE = "https://api.iterable.com/api";

/**
 * Iterable: POST /users/delete with the email. A 2xx means the deletion was
 * queued; a 404 (no such user) is an honest skip, anything else is a failure.
 */
export async function deleteIterable(
  email: string,
  creds: IterableCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };

  try {
    const delRes = await fetchWithRetry(`${IT_BASE}/users/delete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    });

    // 404 / 400 indicating no such user -> honest skip, not a success.
    if (delRes.status === 404 || delRes.status === 400) {
      const b = await parseJsonSafe(delRes);
      return {
        integration: "iterable",
        status: "skipped",
        message: b?.message ?? "No Iterable user matched that email",
        durationMs: Date.now() - start,
      };
    }

    if (!delRes.ok) {
      const b = await parseJsonSafe(delRes);
      const msg = b?.message ?? b?.msg ?? `HTTP ${delRes.status}`;
      return {
        integration: "iterable",
        status: "failed",
        message: "Iterable deletion failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "iterable",
      status: "success",
      message: `Requested deletion of Iterable user for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "iterable",
      status: "failed",
      message: "Iterable deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
