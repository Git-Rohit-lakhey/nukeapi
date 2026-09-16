import "server-only";
import crypto from "node:crypto";

/**
 * Standard Webhooks (Svix-compatible) signature verification for Dodo webhooks.
 * Signature = base64( HMAC-SHA256(secret, "{id}.{timestamp}.{body}") ).
 *
 * FAILS CLOSED (Section 6.3): if the secret is missing we return false and the
 * caller rejects the request (503) — we never accept unsigned payloads.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
): boolean {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) return false;

  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  const payload = `${id}.${ts}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64");

  // Header format: "v1=<sig>[,v1=<sig>]".
  const parts = sigHeader.split(",");
  for (const part of parts) {
    const [version, sig] = part.split("=");
    if (version !== "v1" || !sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
