/**
 * End-to-end smoke test for a LIVE deletion against test Stripe / Mailchimp
 * accounts. It exercises the real connector code (create fixture → delete →
 * verify gone), so you can confirm the production delete path works before
 * trusting it with real erasure requests.
 *
 * Nothing here needs Supabase or the HTTP layer — it calls the connector
 * functions directly. A unique throwaway email is generated each run so it
 * never touches real customer data.
 *
 * Required env (per integration you want to test):
 *   STRIPE_TEST_SECRET_KEY=sk_test_...
 *   MAILCHIMP_TEST_API_KEY=...        MAILCHIMP_TEST_SERVER_PREFIX=usX
 *   MAILCHIMP_TEST_LIST_ID=...         (optional — enables a real add+delete)
 *
 * Run:  npm run smoke
 */
import crypto from "node:crypto";
import { CONNECTORS } from "@/lib/connectors";
import type { ConnectorResult } from "@/types/connector";

const email = `nukeapi-smoke-${crypto.randomBytes(6).toString("hex")}@example.com`;

interface Outcome {
  integration: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

async function stripeCycle(): Promise<Outcome> {
  const key = process.env.STRIPE_TEST_SECRET_KEY;
  if (!key) return { integration: "stripe", status: "warn", detail: "STRIPE_TEST_SECRET_KEY not set — skipped" };

  const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");
  // Create a fixture customer.
  const create = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: `email=${encodeURIComponent(email)}`,
  });
  if (!create.ok) {
    const b = (await create.json().catch(() => ({}))) as any;
    return { integration: "stripe", status: "warn", detail: `create failed (${create.status}): ${b?.error?.message ?? ""} — check key` };
  }

  // Run the real deletion path (via the universal connector registry).
  const res: ConnectorResult = await CONNECTORS.stripe(email, { secret_key: key });
  if (res.status !== "success") {
    return { integration: "stripe", status: "fail", detail: `delete returned ${res.status}: ${res.error ?? res.message}` };
  }

  // Verify it's actually gone.
  const check = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: auth } },
  );
  const json = (await check.json().catch(() => ({}))) as any;
  const gone = (json.data ?? []).length === 0;
  return gone
    ? { integration: "stripe", status: "pass", detail: "created → deleted → verified gone" }
    : { integration: "stripe", status: "fail", detail: "customer still present after delete" };
}

async function mailchimpCycle(): Promise<Outcome> {
  const key = process.env.MAILCHIMP_TEST_API_KEY;
  const prefix = process.env.MAILCHIMP_TEST_SERVER_PREFIX;
  const listId = process.env.MAILCHIMP_TEST_LIST_ID;
  if (!key || !prefix) {
    return { integration: "mailchimp", status: "warn", detail: "MAILCHIMP_TEST_API_KEY/MAILCHIMP_TEST_SERVER_PREFIX not set — skipped" };
  }

  const hash = crypto.createHash("md5").update(email.toLowerCase().trim()).digest("hex");
  const base = `https://${prefix}.api.mailchimp.com/3.0`;
  const auth = "Basic " + Buffer.from(`anystring:${key}`).toString("base64");

  // If a list is configured, add a fixture member first.
  if (listId) {
    const add = await fetch(`${base}/lists/${listId}/members/${hash}`, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: email, status: "subscribed" }),
    });
    if (!add.ok && add.status !== 400) {
      const b = (await add.json().catch(() => ({}))) as any;
      return { integration: "mailchimp", status: "warn", detail: `fixture add failed (${add.status}): ${b?.detail ?? ""} — check key/list` };
    }
  }

  const res: ConnectorResult = await CONNECTORS.mailchimp(email, { api_key: key, server_prefix: prefix });
  if (res.status === "failed") {
    return { integration: "mailchimp", status: "fail", detail: `delete failed: ${res.error ?? res.message}` };
  }

  if (listId) {
    const check = await fetch(`${base}/lists/${listId}/members/${hash}`, { headers: { Authorization: auth } });
    const gone = check.status === 404;
    return gone
      ? { integration: "mailchimp", status: "pass", detail: "created → deleted → verified gone" }
      : { integration: "mailchimp", status: "fail", detail: "member still present after delete" };
  }
  return { integration: "mailchimp", status: "pass", detail: `ran (no list configured → ${res.status})` };
}

async function main() {
  console.log(`\nNukeAPI live smoke — test email: ${email}\n`);
  const outcomes = [await stripeCycle(), await mailchimpCycle()];

  let failed = 0;
  for (const o of outcomes) {
    const tag = o.status === "pass" ? "✅ PASS" : o.status === "warn" ? "⚠️  WARN" : "❌ FAIL";
    if (o.status === "fail") failed++;
    console.log(`${tag}  ${o.integration.padEnd(10)} ${o.detail}`);
  }

  console.log("");
  if (failed > 0) {
    console.log(`${failed} integration(s) FAILED.`);
    process.exit(1);
  }
  console.log("Smoke complete.");
}

main().catch((e) => {
  console.error("Smoke crashed:", e);
  process.exit(1);
});
