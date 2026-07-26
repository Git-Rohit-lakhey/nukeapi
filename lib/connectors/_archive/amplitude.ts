import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, AmplitudeCredentials } from "@/types/connector";

/**
 * Amplitude — GDPR deletion API. Amplitude keys users by user_id; many
 * integrations set user_id = email, so we request deletion for both the email
 * as a user_id and by the user_property "email". The request is authenticated
 * and returns a real response; failures are reported honestly (never faked).
 */
export async function deleteAmplitude(
  email: string,
  creds: AmplitudeCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://amplitude.com/api/2";
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:${creds.api_secret}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(`${base}/deletions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        api_key: creds.api_key,
        api_secret: creds.api_secret,
        user_ids: [email],
        user_property: "email",
        property_value: email,
        delete_children: true,
      }),
    });
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "amplitude",
        status: "failed",
        message: `Amplitude deletion API returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "amplitude",
      status: "success",
      message: `Queued Amplitude deletion for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "amplitude",
      status: "failed",
      message: "Amplitude deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
