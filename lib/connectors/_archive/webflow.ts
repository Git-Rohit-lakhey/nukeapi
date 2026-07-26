import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, WebflowCredentials } from "@/types/connector";

const WF_BASE = "https://api.webflow.com/v2";

/**
 * Webflow: delete site members matched by email. CMS collection items are not
 * reliably email-addressable through the public API, so we only act on the
 * members resource and never claim CMS deletions we did not perform.
 */
export async function deleteWebflow(
  email: string,
  creds: WebflowCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_token}` };

  try {
    const listRes = await fetchWithRetry(
      `${WF_BASE}/sites/${creds.site_id}/members?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? b?.msg ?? `HTTP ${listRes.status}`;
      return {
        integration: "webflow",
        status: "failed",
        message: "Webflow member lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const members: Array<{ id?: string }> = list.members ?? [];
    if (members.length === 0) {
      return {
        integration: "webflow",
        status: "skipped",
        message: "No Webflow site member matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const m of members) {
      if (!m.id) continue;
      const delRes = await fetchWithRetry(
        `${WF_BASE}/sites/${creds.site_id}/members/${m.id}`,
        { method: "DELETE", headers },
      );
      if (delRes.ok) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "webflow",
        status: "skipped",
        message: "No Webflow site member matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "webflow",
      status: "success",
      message: `Deleted ${deleted} Webflow member(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "webflow",
      status: "failed",
      message: "Webflow deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
