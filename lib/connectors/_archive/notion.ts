import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, NotionCredentials } from "@/types/connector";

const NOTION_BASE = "https://api.notion.com";

/**
 * Notion has no "delete user by email" API. Best-effort: search the integration's
 * accessible pages for the email string and archive the matching pages. If none
 * are found we report an HONEST "skipped" — a page archive is not a user erase
 * and we never claim one occurred when nothing matched.
 */
export async function deleteNotion(
  email: string,
  creds: NotionCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.integration_token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  try {
    const searchRes = await fetchWithRetry(`${NOTION_BASE}/v1/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: email,
        filter: { property: "object", value: "page" },
      }),
    });
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "notion",
        status: "failed",
        message: "Notion search failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const results: Array<{ id?: string }> = search.results ?? [];
    if (results.length === 0) {
      return {
        integration: "notion",
        status: "skipped",
        message:
          "No Notion pages containing that email were found via the integration's accessible resources.",
        durationMs: Date.now() - start,
      };
    }

    let archived = 0;
    for (const r of results) {
      if (!r.id) continue;
      const patchRes = await fetchWithRetry(`${NOTION_BASE}/v1/pages/${r.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ archived: true }),
      });
      if (patchRes.ok) archived++;
    }

    if (archived === 0) {
      return {
        integration: "notion",
        status: "skipped",
        message:
          "No Notion pages containing that email were found via the integration's accessible resources.",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "notion",
      status: "success",
      message: `Archived ${archived} Notion page(s) referencing that email`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "notion",
      status: "failed",
      message: "Notion deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
