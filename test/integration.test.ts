import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { encryptString, decryptEnvelope } from "@/lib/security/crypto";
import { signAudit, verifyAudit } from "@/lib/security/signing";
import { generateApiKey, hashApiKey } from "@/lib/auth/keys";
import { validateSqlIdentifier } from "@/lib/connectors/postgresql";
import { resolveEnabled } from "@/lib/connectors/flags";
import { runDeletion } from "@/lib/engine/orchestrator";
import {
  getMaxIntegrations,
  isIntegrationAllowed,
  getPlanLimits,
  FREE_INTEGRATIONS,
} from "@/lib/constants/compliance";
import type { ConnectorResult } from "@/types/connector";
import type { AuditSubject } from "@/types/deletion";

// Server-only crypto/signing modules read these at call time.
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

  // Tamper with the ciphertext -> auth tag must fail.
  const tampered = { ...env, data: Buffer.from(env.data, "base64").toString("base64") };
  // flip a byte in the IV to force a mismatch path
  const ivBuf = Buffer.from(env.iv, "base64");
  ivBuf[0] ^= 0xff;
  const tamperedIv = { ...env, iv: ivBuf.toString("base64") };
  assert.throws(() => decryptEnvelope(tamperedIv), /auth|tag|cipher/i);
});

test("signing: verifies valid signature and rejects tampering", () => {
  const sig = signAudit(subject);
  assert.equal(verifyAudit(subject, sig), true);

  const tampered = {
    ...subject,
    results: [{ ...subject.results[0], message: "Deleted 2" }],
  };
  assert.equal(verifyAudit(tampered, sig), false);
  assert.equal(verifyAudit(subject, "deadbeef"), false);
});

test("api key: fast lookup hash is deterministic SHA-256 and bcrypt verifies", async () => {
  const { raw } = generateApiKey();
  const { keyHash, keyLookupHash } = await hashApiKey(raw);

  const expected = crypto.createHash("sha256").update(raw).digest("hex");
  assert.equal(keyLookupHash, expected);

  const ok = await bcrypt.compare(raw, keyHash);
  assert.equal(ok, true);
});

test("postgresql: SQL identifier validator rejects injection", () => {
  assert.equal(validateSqlIdentifier("users"), true);
  assert.equal(validateSqlIdentifier("user_table_1"), true);
  assert.equal(validateSqlIdentifier("users; DROP TABLE users;--"), false);
  assert.equal(validateSqlIdentifier("bad name"), false);
  assert.equal(validateSqlIdentifier("1users"), false);
  assert.equal(validateSqlIdentifier("a".repeat(64)), false); // exceeds 63-char max
});

test("connector flags: resolveEnabled splits requested by enabled set", () => {
  const enabledSet = new Set(["stripe", "mailchimp", "klaviyo"]);
  const r = resolveEnabled(
    ["stripe", "salesforce", "mailchimp", "segment"],
    enabledSet,
  );
  assert.deepEqual(r.enabled.sort(), ["mailchimp", "stripe"]);
  assert.deepEqual(r.disabled.sort(), ["salesforce", "segment"]);
  // An empty request stays empty.
  assert.deepEqual(resolveEnabled([], enabledSet), { enabled: [], disabled: [] });
});

test("orchestrator: partial-failure handled, results never dropped", async () => {
  const okResult: ConnectorResult = {
    integration: "mailchimp",
    status: "success",
    message: "Deleted 1",
    durationMs: 10,
  };
  const connectors = {
    mailchimp: async () => okResult,
    hubspot: async () => {
      throw new Error("boom");
    },
  };
  const loadCredentials = async (userId: string, integration: string) => {
    if (integration === "hubspot") return { access_token: "tok" } as Record<string, string>;
    return { api_key: "k", server_prefix: "us1" } as Record<string, string>;
  };

  const result = await runDeletion({
    userId: "u1",
    email: "user@example.com",
    integrations: ["mailchimp", "hubspot"],
    requestId: "req_x",
    startedAt: new Date().toISOString(),
    connectors,
    loadCredentials,
  });

  assert.equal(result.results.length, 2);
  const mail = result.results.find((r) => r.integration === "mailchimp");
  const hub = result.results.find((r) => r.integration === "hubspot");
  assert.equal(mail?.status, "success");
  assert.equal(hub?.status, "failed");
  assert.equal(hub?.error, "boom");
  assert.equal(result.status, "partial"); // one ok, one failed
});

test("orchestrator: missing credentials -> skipped (never 'deleted nothing')", async () => {
  const result = await runDeletion({
    userId: "u2",
    email: "noone@example.com",
    integrations: ["intercom"],
    requestId: "req_y",
    startedAt: new Date().toISOString(),
    connectors: { intercom: async () => ({ integration: "intercom", status: "success", message: "x", durationMs: 1 }) },
    loadCredentials: async () => null, // not connected
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, "skipped");
});

test("orchestrator: owner-disabled integration is skipped (enabledSet gate)", async () => {
  const result = await runDeletion({
    userId: "u3",
    email: "x@example.com",
    integrations: ["stripe", "klaviyo"],
    requestId: "req_z",
    startedAt: new Date().toISOString(),
    connectors: {
      stripe: async () => ({ integration: "stripe", status: "success", message: "ok", durationMs: 1 }),
      // Must never run — klaviyo is outside the enabled set.
      klaviyo: async () => ({ integration: "klaviyo", status: "success", message: "should not run", durationMs: 1 }),
    },
    loadCredentials: async () => ({}) as Record<string, string>,
    enabledSet: new Set(["stripe"]),
  });
  assert.equal(result.results.length, 2);
  const s = result.results.find((r) => r.integration === "stripe");
  const k = result.results.find((r) => r.integration === "klaviyo");
  assert.equal(s?.status, "success");
  assert.equal(k?.status, "skipped");
  assert.match(k?.message ?? "", /disabled by the administrator/i);
});

test("compliance: plan integration caps are 3 / 8 / 20 / unlimited", () => {
  assert.equal(getMaxIntegrations("free"), 3);
  assert.equal(getMaxIntegrations("startup"), 8);
  assert.equal(getMaxIntegrations("startup_yearly"), 8);
  assert.equal(getMaxIntegrations("business"), 20);
  assert.equal(getMaxIntegrations("business_yearly"), 20);
  assert.equal(getMaxIntegrations("enterprise"), Infinity);
  assert.equal(getMaxIntegrations("enterprise_yearly"), Infinity);
  assert.equal(getMaxIntegrations("not-a-real-plan"), 3); // falls back to free
});

test("compliance: free is a fixed whitelist, paid plans allow any registered integration", () => {
  // Free: only the 3 fixed integrations, and they must match the homepage example.
  assert.deepEqual(
    [...FREE_INTEGRATIONS].sort(),
    ["hubspot", "stripe", "mailchimp"].sort(),
  );
  assert.equal(isIntegrationAllowed("free", "mailchimp"), true);
  assert.equal(isIntegrationAllowed("free", "stripe"), true);
  assert.equal(isIntegrationAllowed("free", "intercom"), false);
  assert.equal(isIntegrationAllowed("free", "firebaseauth"), false);

  // Paid: allowed regardless of which integration (subject to owner flag + cap).
  assert.equal(isIntegrationAllowed("startup", "firebaseauth"), true);
  assert.equal(isIntegrationAllowed("business", "mysql"), true);
  assert.equal(isIntegrationAllowed("enterprise", "stytch"), true);
  assert.equal(getPlanLimits("startup").maxIntegrations, 8);
});
