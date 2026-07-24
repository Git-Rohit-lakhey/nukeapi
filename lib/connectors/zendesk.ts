import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ZendeskCredentials } from "@/types/connector";

export async function deleteZendesk(
  email: string,
  creds: ZendeskCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const subdomain = creds.subdomain.replace(/\.$/, "");
  const base = `https://${subdomain}.zendesk.com`;
  const basic = Buffer.from(`${creds.agent_email}/token:${creds.api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${basic}` };

  try {
    const res = await fetchWithRetry(
      `${base}/api/v2/users/search.json?query=${encodeURIComponent(`email:${email}`)}`,
      { method: "GET", headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      const msg = b?.error ?? `HTTP ${res.status}`;
      return {
        integration: "zendesk",
        status: "failed",
        message: `Zendesk API returned ${res.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const users: Array<{ id: number }> = json.users ?? [];
    if (users.length === 0) {
      return {
        integration: "zendesk",
        status: "skipped",
        message: "No Zendesk users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(`${base}/api/v2/users/${u.id}.json`, {
        method: "DELETE",
        headers,
      });
      if (delRes.status === 404) continue;
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const m = b?.error ?? `HTTP ${delRes.status}`;
        return {
          integration: "zendesk",
          status: "failed",
          message: `Failed to delete Zendesk user ${u.id}`,
          error: m,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }
    return {
      integration: "zendesk",
      status: "success",
      message: `Deleted ${deleted} Zendesk user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "zendesk",
      status: "failed",
      message: "Zendesk deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
