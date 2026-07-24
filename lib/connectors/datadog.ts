import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, DatadogCredentials } from "@/types/connector";

const DD_BASE = "https://api.datadoghq.com/api/v2";

export async function deleteDatadog(
  email: string,
  creds: DatadogCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  // Datadog authenticates via two separate headers (API key + Application key).
  const headers = {
    "DD-API-KEY": creds.api_key,
    "DD-APPLICATION-KEY": creds.app_key,
  };

  try {
    const searchRes = await fetchWithRetry(
      `${DD_BASE}/users?filter[email]=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.errors?.[0]?.detail ?? `HTTP ${searchRes.status}`;
      return {
        integration: "datadog",
        status: "failed",
        message: `Datadog search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const users: Array<{ id: string }> = search?.data ?? [];
    if (users.length === 0) {
      // Datadog has no single email-indexed erasure endpoint; if no user
      // record is addressable by email, we must report this honestly and NOT
      // claim success. Log/trace retention is governed by Datadog's own
      // retention policies and may require manual scrubbing.
      return {
        integration: "datadog",
        status: "skipped",
        message:
          "No Datadog user record addressable by email; log/trace retention is governed by Datadog's retention policies and may require manual scrubbing.",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `${DD_BASE}/users/${u.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.errors?.[0]?.detail ?? `HTTP ${delRes.status}`;
        return {
          integration: "datadog",
          status: "failed",
          message: `Datadog deletion failed for ${u.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "datadog",
      status: "success",
      message: `Deleted ${deleted} Datadog user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "datadog",
      status: "failed",
      message: "Datadog deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
