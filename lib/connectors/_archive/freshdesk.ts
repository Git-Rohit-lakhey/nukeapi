import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, FreshdeskCredentials } from "@/types/connector";

/** Freshdesk — find contacts by email, then DELETE each. */
export async function deleteFreshdesk(
  email: string,
  creds: FreshdeskCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://${creds.domain}.freshdesk.com/api/v2`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:X`).toString("base64")}`,
  };
  try {
    const res = await fetchWithRetry(
      `${base}/contacts?email=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "freshdesk",
        status: "failed",
        message: `Freshdesk returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const contacts: Array<{ id: number | string }> = await res.json();
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return {
        integration: "freshdesk",
        status: "skipped",
        message: "No Freshdesk contact matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const c of contacts) {
      const d = await fetchWithRetry(`${base}/contacts/${c.id}`, {
        method: "DELETE",
        headers,
      });
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "freshdesk",
        status: "failed",
        message: "Failed to delete any Freshdesk contact",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "freshdesk",
      status: "success",
      message: `Deleted ${deleted} Freshdesk contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "freshdesk",
      status: "failed",
      message: "Freshdesk deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
