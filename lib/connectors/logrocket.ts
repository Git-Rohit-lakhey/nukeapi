import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, LogRocketCredentials } from "@/types/connector";

const LR_BASE = "https://api.logrocket.com/v1";

export async function deleteLogRocket(
  email: string,
  creds: LogRocketCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };
  const appBase = `${LR_BASE}/${creds.app_id}`;

  try {
    const searchRes = await fetchWithRetry(
      `${appBase}/users?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "logrocket",
        status: "failed",
        message: `LogRocket search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // LogRocket returns either { results: [...] } or { users: [...] }.
    const users: Array<{ id: string }> =
      search?.results ?? search?.users ?? [];
    if (users.length === 0) {
      return {
        integration: "logrocket",
        status: "skipped",
        message: "No LogRocket users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `${appBase}/users/${u.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "logrocket",
          status: "failed",
          message: `LogRocket deletion failed for ${u.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "logrocket",
      status: "success",
      message: `Deleted ${deleted} LogRocket user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "logrocket",
      status: "failed",
      message: "LogRocket deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
