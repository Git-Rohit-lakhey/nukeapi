import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { encryptJSON, decryptJSON } from "@/lib/security/crypto";
import type { EncryptedEnvelope } from "@/types/connector";

export interface NotificationSettings {
  webhook_url: string | null;
  slack_webhook_url: string | null;
  email_alerts: boolean;
}

const EMPTY: NotificationSettings = {
  webhook_url: null,
  slack_webhook_url: null,
  email_alerts: true,
};

/**
 * Validate a user-supplied outbound URL. We only ever POST to https endpoints,
 * and reject obvious SSRF targets (localhost / private ranges) so a stored URL
 * can't be pointed back at internal infrastructure. Returns the trimmed URL if
 * valid, else null.
 */
export function validateOutboundUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    // RFC1918 / link-local ranges
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return null;
  }
  return u.toString();
}

/** Validate a Slack incoming-webhook URL (must be an https hooks.slack.com URL). */
export function validateSlackUrl(raw: string | null | undefined): string | null {
  const v = validateOutboundUrl(raw);
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.hostname.toLowerCase() !== "hooks.slack.com") return null;
    return v;
  } catch {
    return null;
  }
}

/** Encrypt a URL for storage (AES-256-GCM envelope). */
export function encryptUrl(url: string | null): unknown {
  if (!url) return null;
  return encryptJSON({ url });
}

/** Decrypt a stored URL envelope back to plaintext. */
export function decryptUrl(encrypted: unknown): string | null {
  if (!encrypted) return null;
  try {
    const obj = decryptJSON<{ url?: string }>(encrypted as EncryptedEnvelope);
    return obj?.url ?? null;
  } catch {
    return null;
  }
}

/** Load a user's notification settings (decrypts URLs). */
export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("notification_settings")
    .select("webhook_url,slack_webhook_url,email_alerts")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return EMPTY;
  return {
    webhook_url: decryptUrl(data.webhook_url),
    slack_webhook_url: decryptUrl(data.slack_webhook_url),
    email_alerts: data.email_alerts ?? true,
  };
}
