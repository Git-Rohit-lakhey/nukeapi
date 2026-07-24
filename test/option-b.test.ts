import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  isStartupPlus,
  isBusinessPlus,
  isEnterprise,
} from "@/lib/constants/compliance";
import {
  validateOutboundUrl,
  validateSlackUrl,
} from "@/lib/notify/settings";
import {
  encodeRelayState,
  decodeRelayState,
  extractSubjectEmail,
} from "@/lib/sso";
import { toCsv, csvCell } from "@/lib/audit/csv";

// Ensure the relay-state HMAC has a key to sign with.
process.env.AUDIT_SIGNING_SECRET = crypto.randomBytes(32).toString("hex");

// ── Plan-tier gating (pricing-page claims) ──
test("plan helpers gate tiers correctly across yearly variants", () => {
  assert.equal(isStartupPlus("free"), false);
  assert.equal(isStartupPlus("startup"), true);
  assert.equal(isStartupPlus("startup_yearly"), true);
  assert.equal(isStartupPlus("business"), true); // business+ includes startup features
  assert.equal(isStartupPlus("enterprise"), true);

  assert.equal(isBusinessPlus("free"), false);
  assert.equal(isBusinessPlus("startup"), false);
  assert.equal(isBusinessPlus("business"), true);
  assert.equal(isBusinessPlus("business_yearly"), true);
  assert.equal(isBusinessPlus("enterprise"), true);
  assert.equal(isBusinessPlus("enterprise_yearly"), true);

  assert.equal(isEnterprise("business"), false);
  assert.equal(isEnterprise("enterprise"), true);
  assert.equal(isEnterprise("enterprise_yearly"), true);
});

// ── SSRF-safe outbound URL validation (webhook config) ──
test("validateOutboundUrl: https only, blocks private/loopback hosts", () => {
  assert.equal(validateOutboundUrl("https://hooks.acme.com/x"), "https://hooks.acme.com/x");
  assert.equal(validateOutboundUrl("http://insecure.com"), null); // http rejected
  assert.equal(validateOutboundUrl("https://localhost/hook"), null); // loopback
  assert.equal(validateOutboundUrl("https://127.0.0.1/hook"), null);
  assert.equal(validateOutboundUrl("https://10.0.0.5/hook"), null); // RFC1918
  assert.equal(validateOutboundUrl("https://192.168.1.1/hook"), null);
  assert.equal(validateOutboundUrl("https://172.16.5.5/hook"), null);
  assert.equal(validateOutboundUrl("https://example.internal/hook"), null);
  assert.equal(validateOutboundUrl("not a url"), null);
  assert.equal(validateOutboundUrl(""), null);
});

test("validateSlackUrl: only https hooks.slack.com", () => {
  assert.equal(
    validateSlackUrl("https://hooks.slack.com/services/T/B/X"),
    "https://hooks.slack.com/services/T/B/X",
  );
  assert.equal(validateSlackUrl("https://hooks.evil.com/services/T/B/X"), null);
  assert.equal(validateSlackUrl("http://hooks.slack.com/x"), null);
});

// ── SSO relay-state: signed owner id, tamper-evident ──
test("sso relay state round-trips and rejects tampering", () => {
  const token = encodeRelayState("owner-uuid-123");
  assert.equal(decodeRelayState(token), "owner-uuid-123");
  assert.equal(decodeRelayState("not-a-valid-token"), null);
  assert.equal(decodeRelayState(""), null);
  assert.equal(decodeRelayState(null), null);
  // Flip a character to forge a different owner -> rejected.
  const forged = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");
  assert.equal(decodeRelayState(forged), null);
});

test("sso extractSubjectEmail: pulls email from nameID or attributes", () => {
  assert.equal(
    extractSubjectEmail({ nameID: "jane@acme.com", attributes: {} }),
    "jane@acme.com",
  );
  assert.equal(
    extractSubjectEmail({
      nameID: "subject",
      attributes: {
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":
          "jane@acme.com",
      },
    }),
    "jane@acme.com",
  );
  assert.equal(extractSubjectEmail({ nameID: "no-email-here", attributes: {} }), null);
  assert.equal(extractSubjectEmail({ attributes: {} }), null);
});

// ── CSV escaping (audit/SOC2 exports) ──
test("csvCell escapes commas, quotes and newlines (RFC 4180)", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(42), "42");
});

test("toCsv builds a header row + escaped body rows", () => {
  const csv = toCsv(["a", "b"], [["x", "y,z"], ["1", "2"]]);
  // "x" has no comma so it is NOT quoted; "y,z" is quoted.
  assert.equal(csv, 'a,b\nx,"y,z"\n1,2\n');
});
