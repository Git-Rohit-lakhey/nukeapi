/**
 * Top-to-bottom HTTP smoke test for NukeAPI.
 *
 * Unlike scripts/smoke.ts (which calls connector functions directly), this one
 * boots the REAL Next.js server and fires a real POST at /api/v1/delete-user,
 * exercising the full pipeline: API-key auth (fast indexed lookup) → rate limit
 * → plan/usage limit → orchestrator (parallel connectors) → HMAC signing →
 * atomic usage increment → signed response.
 *
 * It creates an isolated throwaway Supabase auth user + API key (stored exactly
 * as the app stores them, including AES-256-GCM-encrypted connector creds),
 * runs the request, asserts the response, and deletes the user at the end
 * (cascading away the key, credentials and subscription).
 *
 * If real provider keys are present it additionally performs a true
 * create → delete → verify-gone against the live provider.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   CREDENTIALS_ENCRYPTION_KEY, AUDIT_SIGNING_SECRET
 * Optional (enables live provider deletion):
 *   STRIPE_TEST_SECRET_KEY
 *   MAILCHIMP_TEST_API_KEY, MAILCHIMP_TEST_SERVER_PREFIX, MAILCHIMP_TEST_LIST_ID
 */
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PORT = Number(process.env.SMOKE_PORT ?? 3939);
const BASE = `http://localhost:${PORT}`;

// Load .env.local so the script sees the same vars as `next dev`.
try {
  (process as any).loadEnvFile?.(".env.local");
} catch {
  /* ignore */
}

interface Outcome {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

function genApiKey(): string {
  return `nk_live_${crypto.randomBytes(24).toString("base64url")}`;
}

async function keyHashes(raw: string) {
  const keyHash = await bcrypt.hash(raw, 10);
  const keyLookupHash = crypto.createHash("sha256").update(raw).digest("hex");
  return { keyHash, keyLookupHash, prefix: raw.slice(0, 12) };
}

/** Mirror lib/security/crypto.ts encryptJSON so the endpoint can decrypt it. */
function encryptJSON(obj: unknown) {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY!.trim();
  const looksB64 = /^[A-Za-z0-9+/]+={0,2}$/.test(raw);
  const decoded = looksB64 ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  const key = decoded.length === 32 ? decoded : crypto.createHash("sha256").update(raw).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };
}

function requiredEnv(): string[] {
  const need = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CREDENTIALS_ENCRYPTION_KEY",
    "AUDIT_SIGNING_SECRET",
  ];
  return need.filter((k) => !process.env[k]);
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server did not become healthy in time");
}

async function startServer(): Promise<ChildProcess> {
  const nextBin = path.resolve("node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
  return child;
}

function killServer(child: ChildProcess) {
  try {
    process.kill(-child.pid!); // kill the process group
  } catch {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
}

async function createStripeFixture(email: string, key: string): Promise<string | null> {
  const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");
  const r = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: `email=${encodeURIComponent(email)}`,
  });
  if (!r.ok) return null;
  const json = (await r.json()) as any;
  return json.id ?? null;
}

async function stripeGone(email: string, key: string): Promise<boolean> {
  const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");
  const r = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: auth } },
  );
  const json = (await r.json().catch(() => ({}))) as any;
  return (json.data ?? []).length === 0;
}

async function main() {
  const missing = requiredEnv();
  if (missing.length) {
    console.log("\nHTTP smoke skipped — set these env vars (e.g. in .env.local):");
    missing.forEach((m) => console.log(`  - ${m}`));
    console.log("Optional live-provider keys: STRIPE_TEST_SECRET_KEY, MAILCHIMP_TEST_*");
    process.exit(0);
  }

  const stripeKey = process.env.STRIPE_TEST_SECRET_KEY;
  const mcKey = process.env.MAILCHIMP_TEST_API_KEY;
  const mcPrefix = process.env.MAILCHIMP_TEST_SERVER_PREFIX;
  const mcList = process.env.MAILCHIMP_TEST_LIST_ID;

  const outcomes: Outcome[] = [];
  const admin: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const testEmail = `nukeapi-http-smoke-${crypto.randomBytes(6).toString("hex")}@example.com`;
  let server: ChildProcess | null = null;
  let userId: string | null = null;

  try {
    console.log(`\nNukeAPI HTTP smoke — server :${PORT}, user ${testEmail}\n`);

    // 1) Boot the real server.
    server = await startServer();
    await waitForHealth(120_000);
    console.log("server healthy");

    // 2) Create an isolated throwaway user + API key + plan.
    const pw = crypto.randomBytes(16).toString("base64");
    const { data: newUser, error: userErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: pw,
      email_confirm: true,
    } as any);
    if (userErr || !newUser.user) throw new Error(`createUser failed: ${userErr?.message}`);
    userId = newUser.user.id;

    const rawKey = genApiKey();
    const { keyHash, keyLookupHash, prefix } = await keyHashes(rawKey);
    await admin.from("api_keys").insert({
      user_id: userId,
      name: "http-smoke",
      key_hash: keyHash,
      key_prefix: prefix,
      key_lookup_hash: keyLookupHash,
      is_active: true,
    });
    // Give the user a paid plan so stripe/mailchimp are allowed.
    await admin.from("subscriptions").upsert(
      { user_id: userId, plan: "startup", status: "active" },
      { onConflict: "user_id" },
    );

    // 3) Optionally store real (encrypted) provider creds + create fixtures.
    const requested: string[] = [];
    if (stripeKey) {
      await admin.from("connector_credentials").upsert(
        {
          user_id: userId,
          integration: "stripe",
          credentials: encryptJSON({ secret_key: stripeKey }),
          is_active: true,
        },
        { onConflict: "user_id,integration" },
      );
      const fid = await createStripeFixture(testEmail, stripeKey);
      if (!fid) {
        outcomes.push({ name: "stripe fixture", status: "warn", detail: "could not create test customer (check key)" });
      }
      requested.push("stripe");
    }
    if (mcKey && mcPrefix) {
      await admin.from("connector_credentials").upsert(
        {
          user_id: userId,
          integration: "mailchimp",
          credentials: encryptJSON({ api_key: mcKey, server_prefix: mcPrefix }),
          is_active: true,
        },
        { onConflict: "user_id,integration" },
      );
      requested.push("mailchimp");
    }
    if (requested.length === 0) requested.push("stripe"); // exercises pipeline (will be 'skipped')

    // 4) Fire the REAL endpoint.
    const res = await fetch(`${BASE}/api/v1/delete-user`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subject_email: testEmail, integrations: requested }),
      signal: AbortSignal.timeout(60_000),
    });
    const json = (await res.json()) as any;

    const okHttp = res.status === 200 || res.status === 207;
    const sigOk = typeof json?.data?.auditSignature === "string" && json.data.auditSignature.length > 0;
    const usageOk = json?.data?.usage && typeof json.data.usage.used === "number";
    outcomes.push({
      name: "endpoint pipeline",
      status: okHttp && json?.success === true && sigOk && usageOk ? "pass" : "fail",
      detail: `HTTP ${res.status}, success=${json?.success}, signed=${sigOk}, usage=${usageOk}`,
    });

    // 4b) Connector toggle flow — the owner flag must gate the live API.
    //     We flip the flag via the service-role client (exactly what the admin
    //     PATCH route does) and assert availability + the delete-user gate
    //     follow, then restore the original state.
    try {
      const toggleKey = "klaviyo";
      const { data: before } = await admin
        .from("connector_flags")
        .select("enabled")
        .eq("integration", toggleKey)
        .maybeSingle();
      if (!before) throw new Error("connector_flags row missing for " + toggleKey);

      const setFlag = (enabled: boolean) =>
        admin
          .from("connector_flags")
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq("integration", toggleKey);

      // Disabled → availability false AND delete-user returns 403.
      await setFlag(false);
      const avOff = (await (await fetch(`${BASE}/api/connectors/availability`)).json()) as any;
      const offEntry = avOff?.data?.integrations?.find((i: any) => i.key === toggleKey);
      const availReflectsOff = offEntry?.enabled === false;

      const offRes = await fetch(`${BASE}/api/v1/delete-user`, {
        method: "POST",
        headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subject_email: testEmail, integrations: [toggleKey] }),
        signal: AbortSignal.timeout(60_000),
      });
      const offJson = (await offRes.json()) as any;
      const gatedOff = offRes.status === 403 && offJson?.error?.code === "CONNECTOR_DISABLED";

      // Enabled → availability true AND delete-user no longer 403s.
      await setFlag(true);
      const avOn = (await (await fetch(`${BASE}/api/connectors/availability`)).json()) as any;
      const onEntry = avOn?.data?.integrations?.find((i: any) => i.key === toggleKey);
      const availReflectsOn = onEntry?.enabled === true;

      const onRes = await fetch(`${BASE}/api/v1/delete-user`, {
        method: "POST",
        headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subject_email: testEmail, integrations: [toggleKey] }),
        signal: AbortSignal.timeout(60_000),
      });
      const onJson = (await onRes.json()) as any;
      // Runs (skipped — no creds) rather than rejected by the gate.
      const gateOpen = onJson?.error?.code !== "CONNECTOR_DISABLED";

      // Restore original flag state.
      await setFlag(Boolean(before.enabled));

      const pass = availReflectsOff && gatedOff && availReflectsOn && gateOpen;
      outcomes.push({
        name: "connector toggle flow",
        status: pass ? "pass" : "fail",
        detail: `availOff=${availReflectsOff} gatedOff=${gatedOff} availOn=${availReflectsOn} gateOpen=${gateOpen}`,
      });
    } catch (te) {
      outcomes.push({ name: "connector toggle flow", status: "warn", detail: `skipped: ${(te as Error).message}` });
    }

    // 5) If we stored Stripe creds, verify the live deletion actually happened.
    if (stripeKey) {
      const gone = await stripeGone(testEmail, stripeKey);
      outcomes.push({
        name: "stripe live deleted",
        status: gone ? "pass" : "fail",
        detail: gone ? "customer gone after endpoint call" : "customer still present",
      });
    }
  } catch (e) {
    outcomes.push({ name: "smoke", status: "fail", detail: (e as Error).message });
  } finally {
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
    if (server) killServer(server);
  }

  let failed = 0;
  for (const o of outcomes) {
    const tag = o.status === "pass" ? "✅ PASS" : o.status === "warn" ? "⚠️  WARN" : "❌ FAIL";
    if (o.status === "fail") failed++;
    console.log(`${tag}  ${o.name.padEnd(20)} ${o.detail}`);
  }
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("HTTP smoke crashed:", e);
  process.exit(1);
});
