import crypto from "crypto";
import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, BrevoCredentials } from "@/types/connector";

const BREVO_BASE = "https://api.brevo.com";

export async function deleteBrevo(
  email: string,
  creds: BrevoCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    // Brevo contact identifier is the MD5 of the lowercased email.
    const id = crypto
      .createHash("md5")
      .update(email.toLowerCase())
      .digest("hex");

    const res = await fetchWithRetry(`${BREVO_BASE}/v3/contacts/${id}`, {
      method: "DELETE",
      headers: { "api-key": creds.api_key },
    });

    if (res.status === 204) {
      return {
        integration: "brevo",
        status: "success",
        message: `Deleted Brevo contact for ${email}`,
        durationMs: Date.now() - start,
      };
    }
    if (res.status === 404) {
      return {
        integration: "brevo",
        status: "skipped",
        message: "No Brevo contact matched that email",
        durationMs: Date.now() - start,
      };
    }

    const b = await parseJsonSafe(res);
    const msg = b?.message ?? `HTTP ${res.status}`;
    return {
      integration: "brevo",
      status: "failed",
      message: "Brevo deletion failed",
      error: msg,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "brevo",
      status: "failed",
      message: "Brevo deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
