import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { AuthedApiKey } from "@/types/api";

const BCRYPT_ROUNDS = 10;
const KEY_PREFIX_LABEL = "nk_live_";
const DISPLAY_PREFIX_LEN = 12;

/** Generate a new raw API key plus its display prefix. Returned once only. */
export function generateApiKey(): { raw: string; prefix: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const raw = `${KEY_PREFIX_LABEL}${random}`;
  return { raw, prefix: raw.slice(0, DISPLAY_PREFIX_LEN) };
}

/** Compute the bcrypt hash and the deterministic SHA-256 lookup hash. */
export async function hashApiKey(raw: string): Promise<{
  keyHash: string;
  keyLookupHash: string;
}> {
  const keyHash = await bcrypt.hash(raw, BCRYPT_ROUNDS);
  const keyLookupHash = crypto.createHash("sha256").update(raw).digest("hex");
  return { keyHash, keyLookupHash };
}

/**
 * Authenticate a raw API key using the fast indexed lookup (6.4):
 *   SHA-256(raw) -> indexed equality scan on key_lookup_hash ->
 *   bcrypt.compare against the single candidate row (defense in depth).
 * Never bcrypt-compares across all keys.
 */
export async function authenticateApiKey(
  raw: string | undefined | null,
): Promise<AuthedApiKey | null> {
  if (!raw) return null;
  const keyLookupHash = crypto.createHash("sha256").update(raw).digest("hex");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .select("id,user_id,name,key_hash,key_prefix,is_active,expires_at")
    .eq("key_lookup_hash", keyLookupHash)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  const ok = await bcrypt.compare(raw, data.key_hash);
  if (!ok) return null;

  // Best-effort last_used_at update — failures must not block the request.
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    key_prefix: data.key_prefix,
    is_active: data.is_active,
    expires_at: data.expires_at,
  };
}
