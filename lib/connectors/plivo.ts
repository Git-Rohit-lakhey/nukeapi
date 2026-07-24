import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, PlivoCredentials } from "@/types/connector";

const PLIVO_BASE = "https://api.plivo.com/v1/Account";

/**
 * Plivo has no documented end-customer "delete by email" endpoint — its API is
 * telephony-first (numbers, calls, messages keyed by phone, not email). We
 * attempt the best-effort documented lookup; if it is unavailable or returns no
 * matches we report an HONEST "skipped" and never fabricate a deletion.
 */
export async function deletePlivo(
  email: string,
  creds: PlivoCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const auth = `Basic ${Buffer.from(creds.auth_id + ":" + creds.auth_token).toString("base64")}`;
  const headers = { Authorization: auth };

  try {
    const listRes = await fetchWithRetry(
      `${PLIVO_BASE}/${creds.auth_id}/Customers?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );

    // A missing resource (404) means Plivo genuinely has no email-addressable
    // customer for this account — an honest skip. But an auth/quota/5xx error is
    // a REAL failure and must NOT be mislabeled as "nothing to delete" (§6.10).
    if (!listRes.ok) {
      if (listRes.status === 404) {
        return {
          integration: "plivo",
          status: "skipped",
          message:
            "Plivo has no email-addressable customer erasure endpoint; message/call records are keyed by phone number, not email.",
          durationMs: Date.now() - start,
        };
      }
      const b = await parseJsonSafe(listRes);
      const msg = b?.error ?? b?.message ?? `HTTP ${listRes.status}`;
      return {
        integration: "plivo",
        status: "failed",
        message: "Plivo customer lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const customers: Array<{ id?: string }> =
      list.customers ?? list.objects ?? [];
    if (customers.length === 0) {
      return {
        integration: "plivo",
        status: "skipped",
        message:
          "Plivo has no email-addressable customer erasure endpoint; message/call records are keyed by phone number, not email.",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of customers) {
      if (!c.id) continue;
      const delRes = await fetchWithRetry(
        `${PLIVO_BASE}/${creds.auth_id}/Customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (delRes.ok) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "plivo",
        status: "skipped",
        message:
          "Plivo has no email-addressable customer erasure endpoint; message/call records are keyed by phone number, not email.",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "plivo",
      status: "success",
      message: `Deleted ${deleted} Plivo customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "plivo",
      status: "failed",
      message: "Plivo deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
