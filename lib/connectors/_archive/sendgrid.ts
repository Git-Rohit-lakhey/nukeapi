import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, SendGridCredentials } from "@/types/connector";

const SG_BASE = "https://api.sendgrid.com";

function escapeLike(s: string): string {
  return s.replace(/'/g, "''");
}

export async function deleteSendGrid(
  email: string,
  creds: SendGridCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  try {
    // Search marketing contacts by email.
    const searchRes = await fetchWithRetry(`${SG_BASE}/v3/marketing/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: `email LIKE '${escapeLike(email)}'` }),
    });
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.errors?.[0]?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "sendgrid",
        status: "failed",
        message: `SendGrid search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const search = await parseJsonSafe(searchRes);
    const contacts: Array<{ id: string }> = search.result ?? [];
    if (contacts.length === 0) {
      return {
        integration: "sendgrid",
        status: "skipped",
        message: "No SendGrid contacts matched that email",
        durationMs: Date.now() - start,
      };
    }

    const ids = contacts.map((c) => c.id);
    const delRes = await fetchWithRetry(`${SG_BASE}/v3/marketing/contacts`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!delRes.ok) {
      const b = await parseJsonSafe(delRes);
      const msg = b?.errors?.[0]?.message ?? `HTTP ${delRes.status}`;
      return {
        integration: "sendgrid",
        status: "failed",
        message: "SendGrid deletion failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "sendgrid",
      status: "success",
      message: `Queued deletion of ${ids.length} SendGrid contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "sendgrid",
      status: "failed",
      message: "SendGrid deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
