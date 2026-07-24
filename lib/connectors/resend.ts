import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ResendCredentials } from "@/types/connector";

/** Resend — list audience contacts by email, then DELETE each match. */
export async function deleteResend(
  email: string,
  creds: ResendCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://api.resend.com";
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/audiences/${creds.audience_id}/contacts?email=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "resend",
        status: "failed",
        message: `Resend returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const contacts: Array<{ id: string; email?: string }> = json.data ?? [];
    const matches = contacts.filter(
      (c) => c.email?.toLowerCase() === email.toLowerCase(),
    );
    if (matches.length === 0) {
      return {
        integration: "resend",
        status: "skipped",
        message: "No Resend contact matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const c of matches) {
      const d = await fetchWithRetry(
        `${base}/audiences/${creds.audience_id}/contacts/${c.id}`,
        { method: "DELETE", headers },
      );
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "resend",
        status: "failed",
        message: "Failed to delete any Resend contact",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "resend",
      status: "success",
      message: `Deleted ${deleted} Resend contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "resend",
      status: "failed",
      message: "Resend deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
