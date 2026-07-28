import "server-only";
import crypto from "node:crypto";
import type { AuditSubject } from "@/types/deletion";

function getSecret(): string {
  const s = process.env.AUDIT_SIGNING_SECRET;
  if (!s) {
    console.warn("[signing] AUDIT_SIGNING_SECRET not configured — using fallback (non-production only)");
    return "fallback-dev-secret-do-not-use-in-production";
  }
  return s;
}

/** Deterministic, key-sorted JSON so the same result always yields the same string. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/** Build the canonical string that gets signed for the audit trail. */
export function canonicalize(subject: AuditSubject): string {
  // Sort results by integration name for stability.
  const results = [...subject.results].sort((a, b) =>
    a.integration < b.integration ? -1 : a.integration > b.integration ? 1 : 0,
  );
  return stableStringify({
    requestId: subject.requestId,
    subjectEmail: subject.subjectEmail,
    status: subject.status,
    startedAt: subject.startedAt,
    completedAt: subject.completedAt,
    results,
  });
}

export function signAudit(subject: AuditSubject): string {
  const secret = getSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(canonicalize(subject))
    .digest("hex");
}

export function verifyAudit(subject: AuditSubject, signature: string): boolean {
  const expected = signAudit(subject);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
