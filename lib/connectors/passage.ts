import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, PassageCredentials } from "@/types/connector";

const PASSAGE_BASE = "https://api.passage.id";

export async function deletePassage(
  email: string,
  creds: PassageCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  try {
    // List users in the Passage app matching the email. Passage returns the
    // array under `items` (or `data` in some versions) — accept both.
    const listRes = await fetchWithRetry(
      `${PASSAGE_BASE}/v1/apps/${encodeURIComponent(creds.app_id)}/users?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? `HTTP ${listRes.status}`;
      return {
        integration: "passage",
        status: "failed",
        message: `Passage lookup returned ${listRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const users: Array<{ id: string }> = list.items ?? list.data ?? [];
    if (users.length === 0) {
      return {
        integration: "passage",
        status: "skipped",
        message: "No Passage user matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `${PASSAGE_BASE}/v1/apps/${encodeURIComponent(creds.app_id)}/users/${encodeURIComponent(u.id)}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "passage",
          status: "failed",
          message: `Passage deletion failed for user ${u.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted += 1;
    }

    return {
      integration: "passage",
      status: "success",
      message: `Deleted ${deleted} Passage user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "passage",
      status: "failed",
      message: "Passage deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
