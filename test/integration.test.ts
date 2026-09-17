import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { encryptString, decryptEnvelope, encryptJSON, decryptJSON } from "@/lib/security/crypto";
import { signAudit, verifyAudit, canonicalize } from "@/lib/security/signing";
import { generateApiKey, hashApiKey } from "@/lib/auth/keys";
import { validateSqlIdentifier } from "@/lib/connectors/engine/sql";
import { runDeletion } from "@/lib/engine/orchestrator";
import { getMaxIntegrations, isIntegrationAllowed, getPlanLimits, FREE_INTEGRATIONS } from "@/lib/constants/compliance";
import type { ConnectorResult } from "@/types/connector";
import type { AuditSubject } from "@/types/deletion";

process.env.CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
process.env.AUDIT_SIGNING_SECRET = crypto.randomBytes(32).toString("hex");

const subject: AuditSubject = {
  requestId: "req_123",
  subjectEmail: "user@example.com",
  status: "completed",
  startedAt: "2026-07-17T00:00:00.000Z",
  completedAt: "2026-07-17T00:00:01.000Z",
  results: [
    { integration: "mailchimp", status: "success", message: "Deleted 1" },
    { integration: "hubspot", status: "success", message: "Deleted 1" },
  ],
};

test("crypto: round-trips and fails tamper detection", () => {
  const plain = JSON.stringify({ secret_key: "sk_live_abc123" });
  const env = encryptString(plain);
  assert.equal(decryptEnvelope(env), plain);

  // JSON envelope round-trip
  const obj = { secret_key: "sk_live_abc123", extra: "hello" };
  const env2 = encryptJSON(obj);
  assert.deepEqual(decryptJSON<typeof obj>(env2), obj);

  // Tamper IV must fail
  const ivBuf = Buffer.from(env.iv, "base64");
  ivBuf[0] ^= 0xff;
  const tamperedIv = { ...env, iv: ivBuf.toString("base64") };
  assert.throws(() => decryptEnvelope(tamperedIv));

  // Tamper tag must fail
  const tagBuf = Buffer.from(env.tag, "base64");
  tagBuf[0] ^= 0xff;
  const tamperedTag = { ...env, tag: tagBuf.toString("base64") };
  assert.throws(() => decryptEnvelope(tamperedTag));
});

test("signing: verifies valid signature and rejects tampering", () => {
  const sig = signAudit(subject);
  assert.equal(verifyAudit(subject, sig), true);
  assert.equal(typeof sig, "string");
  assert.equal(sig.length, 64); // hex sha256

  const tampered = { ...subject, results: [{ ...subject.results[0], message: "Deleted 2" }] };
  assert.equal(verifyAudit(tampered, sig), false);
  assert.equal(verifyAudit(subject, "deadbeef".repeat(8)), false);

  // canonicalize is stable regardless of result order
  const reversed: AuditSubject = { ...subject, results: [...subject.results].reverse() };
  assert.equal(canonicalize(subject), canonicalize(reversed));
});

test("api key: fast lookup hash is deterministic SHA-256 and bcrypt verifies", async () => {
  const { raw } = generateApiKey();
  assert.match(raw, /^nk_live_/);
  const { keyHash, keyLookupHash } = await hashApiKey(raw);
  const expected = crypto.createHash("sha256").update(raw).digest("hex");
  assert.equal(keyLookupHash, expected);
  assert.equal(await bcrypt.compare(raw, keyHash), true);
  assert.equal(await bcrypt.compare("wrong", keyHash), false);
  // deterministic: same raw -> same lookup hash
  const { keyLookupHash: h2 } = await hashApiKey(raw);
  assert.equal(h2, expected);
});

test("postgresql: SQL identifier validator rejects injection", () => {
  assert.equal(validateSqlIdentifier("users"), true);
  assert.equal(validateSqlIdentifier("user_table_1"), true);
  assert.equal(validateSqlIdentifier("_private"), true);
  assert.equal(validateSqlIdentifier("users; DROP TABLE users;--"), false);
  assert.equal(validateSqlIdentifier("bad name"), false);
  assert.equal(validateSqlIdentifier("1users"), false);
  assert.equal(validateSqlIdentifier(""), false);
  assert.equal(validateSqlIdentifier("a".repeat(64)), false);
  assert.equal(validateSqlIdentifier("a".repeat(63)), true);
  assert.equal(validateSqlIdentifier("users--"), false);
});

test("orchestrator: partial-failure handled, results never dropped", async () => {
  const okResult: ConnectorResult = { integration: "mailchimp", status: "success", message: "Deleted 1", durationMs: 10 };
  const connectors = {
    mailchimp: async () => okResult,
    hubspot: async () => {
      throw new Error("boom");
    },
  };
  const loadCredentials = async () => ({}) as Record<string, string>;
  const result = await runDeletion({
    userId: "u1",
    email: "user@example.com",
    integrations: ["mailchimp", "hubspot"],
    requestId: "req_x",
    startedAt: new Date().toISOString(),
    connectors: connectors as any,
    loadCredentials: loadCredentials as any,
  });
  assert.equal(result.results.length, 2);
  const mail = result.results.find((r) => r.integration === "mailchimp");
  const hub = result.results.find((r) => r.integration === "hubspot");
  assert.equal(mail?.status, "success");
  assert.equal(hub?.status, "failed");
  assert.equal(hub?.error, "boom");
  assert.equal(result.status, "partial");
});

test("orchestrator: missing credentials -> skipped", async () => {
  const result = await runDeletion({
    userId: "u2",
    email: "noone@example.com",
    integrations: ["intercom"],
    requestId: "req_y",
    startedAt: new Date().toISOString(),
    connectors: { intercom: async () => ({ integration: "intercom", status: "success", message: "x", durationMs: 1 }) } as any,
    loadCredentials: async () => null,
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, "skipped");
  assert.match(result.results[0].message, /No intercom credentials/i);
});

test("orchestrator: all succeeded -> completed, all failed -> failed", async () => {
  const ok = await runDeletion({
    userId: "u3",
    email: "x@example.com",
    integrations: ["stripe"],
    requestId: "req_z",
    startedAt: new Date().toISOString(),
    connectors: { stripe: async () => ({ integration: "stripe", status: "success", message: "ok", durationMs: 1 }) } as any,
    loadCredentials: async () => ({}) as Record<string, string>,
  });
  assert.equal(ok.status, "completed");
  const fail = await runDeletion({
    userId: "u3",
    email: "x@example.com",
    integrations: ["stripe"],
    requestId: "req_z2",
    startedAt: new Date().toISOString(),
    connectors: { stripe: async () => ({ integration: "stripe", status: "failed", message: "bad", error: "auth", durationMs: 1 }) } as any,
    loadCredentials: async () => ({}) as Record<string, string>,
  });
  assert.equal(fail.status, "failed");
});

test("compliance: plan integration caps are 3 / 12 / 25 / unlimited (lightweight v2)", () => {
  assert.equal(getMaxIntegrations("free"), 3);
  assert.equal(getMaxIntegrations("startup"), 12);
  assert.equal(getMaxIntegrations("startup_yearly"), 12);
  assert.equal(getMaxIntegrations("business"), 25);
  assert.equal(getMaxIntegrations("business_yearly"), 25);
  assert.equal(getMaxIntegrations("enterprise"), Infinity);
  assert.equal(getMaxIntegrations("enterprise_yearly"), Infinity);
  assert.equal(getMaxIntegrations("not-a-real-plan"), 3);
});

test("compliance: free is fixed whitelist stripe/mailchimp/hubspot, paid allow all 6", () => {
  assert.deepEqual([...FREE_INTEGRATIONS].sort(), ["hubspot", "mailchimp", "stripe"].sort());
  assert.equal(isIntegrationAllowed("free", "mailchimp"), true);
  assert.equal(isIntegrationAllowed("free", "stripe"), true);
  assert.equal(isIntegrationAllowed("free", "hubspot"), true);
  assert.equal(isIntegrationAllowed("free", "intercom"), false);
  assert.equal(isIntegrationAllowed("free", "supabase"), false);
  assert.equal(isIntegrationAllowed("free", "postgresql"), false);
  assert.equal(isIntegrationAllowed("startup", "intercom"), true);
  assert.equal(isIntegrationAllowed("startup", "postgresql"), true);
  assert.equal(isIntegrationAllowed("enterprise", "postgresql"), true);
  assert.equal(getPlanLimits("startup").maxIntegrations, 12);
});
