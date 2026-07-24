import "server-only";
import crypto from "node:crypto";
import type { EncryptedEnvelope } from "@/types/connector";

const ALG = "aes-256-gcm";
const IV_LEN = 12;

/**
 * Resolve the 32-byte AES key from CREDENTIALS_ENCRYPTION_KEY.
 * Accepts a base64 string (preferred: `openssl rand -base64 32`) and falls
 * back to a SHA-256 of the raw value so misconfigured dev keys still work.
 */
function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not configured");
  }
  const trimmed = raw.trim();
  // base64 of 32 bytes is 44 chars (may have padding). Try to decode.
  const looksBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
  const decoded = looksBase64 ? Buffer.from(trimmed, "base64") : Buffer.alloc(0);
  if (decoded.length === 32) return decoded;
  return crypto.createHash("sha256").update(trimmed).digest();
}

export function encryptString(plaintext: string): EncryptedEnvelope {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };
}

export function decryptEnvelope(env: EncryptedEnvelope): string {
  if (env.v !== 1 || env.alg !== "AES-256-GCM") {
    throw new Error("Unsupported encryption envelope");
  }
  const key = getKey();
  const iv = Buffer.from(env.iv, "base64");
  const tag = Buffer.from(env.tag, "base64");
  const data = Buffer.from(env.data, "base64");
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** Encrypt any JSON-serializable object (e.g. connector credentials). */
export function encryptJSON(obj: unknown): EncryptedEnvelope {
  return encryptString(JSON.stringify(obj));
}

/** Decrypt an envelope back into a typed object. */
export function decryptJSON<T = Record<string, string>>(
  env: EncryptedEnvelope,
): T {
  return JSON.parse(decryptEnvelope(env)) as T;
}
