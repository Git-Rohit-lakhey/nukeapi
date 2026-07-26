import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, TwilioCredentials } from "@/types/connector";

const TW_BASE = "https://api.twilio.com/2010-04-01";

/**
 * Twilio has no first-class email-indexed erasure endpoint. The best-effort
 * path is the Address/Contact resource, which CAN be keyed by email. SMS
 * message records are keyed by phone number, never by email, so if no
 * email-addressable contact is found we report a HONEST "skipped" — never a
 * fabricated success.
 */
export async function deleteTwilio(
  email: string,
  creds: TwilioCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const auth = `Basic ${Buffer.from(creds.account_sid + ":" + creds.auth_token).toString("base64")}`;
  const headers = { Authorization: auth };

  try {
    const listRes = await fetchWithRetry(
      `${TW_BASE}/Accounts/${creds.account_sid}/Contacts.json?Email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? `HTTP ${listRes.status}`;
      return {
        integration: "twilio",
        status: "failed",
        message: `Twilio contact lookup failed`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const contacts: Array<{ sid?: string }> = list.contacts ?? list.items ?? [];
    if (contacts.length === 0) {
      return {
        integration: "twilio",
        status: "skipped",
        message:
          "No Twilio contact addressable by email; SMS message records are keyed by phone number, not email.",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of contacts) {
      if (!c.sid) continue;
      const delRes = await fetchWithRetry(
        `${TW_BASE}/Accounts/${creds.account_sid}/Contacts/${c.sid}.json`,
        { method: "DELETE", headers },
      );
      if (delRes.ok) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "twilio",
        status: "skipped",
        message:
          "No Twilio contact addressable by email; SMS message records are keyed by phone number, not email.",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "twilio",
      status: "success",
      message: `Deleted ${deleted} Twilio contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "twilio",
      status: "failed",
      message: "Twilio deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
