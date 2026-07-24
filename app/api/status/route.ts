import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { getAllConnectorFlags } from "@/lib/connectors/flags";
import { CONNECTOR_META } from "@/lib/connectors/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Live health checks powering the public /status page. */
export async function GET() {
  const checks: Check[] = [];

  // API is responding (this handler ran).
  checks.push({ name: "API", ok: true });

  // Database connectivity.
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("keepalive_log").select("id").limit(1);
    checks.push({ name: "Database", ok: !error, detail: error?.message });
  } catch (e) {
    checks.push({ name: "Database", ok: false, detail: (e as Error).message });
  }

  // Rate limiter (Redis) configured?
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  checks.push({
    name: "Rate limiter",
    ok: redisConfigured,
    detail: redisConfigured ? undefined : "Redis not configured (dev)",
  });

  // Per-integration availability (owner-controlled). Enabled + not in
  // maintenance = operational; in maintenance = degraded. Disabled connectors
  // are omitted (not a system fault) but their count is reported below.
  try {
    const flags = await getAllConnectorFlags();
    const enabled = flags.filter((f) => f.enabled);
    const disabledCount = flags.filter((f) => !f.enabled).length;
    for (const f of enabled) {
      const label = CONNECTOR_META[f.integration as keyof typeof CONNECTOR_META]?.label ?? f.integration;
      checks.push({
        name: `Integration: ${label}`,
        ok: !f.maintenance,
        detail: f.maintenance ? "maintenance" : "operational",
      });
    }
    checks.push({
      name: "Connectors",
      ok: true,
      detail: `${enabled.length} live${disabledCount ? `, ${disabledCount} disabled` : ""}`,
    });
  } catch (e) {
    checks.push({ name: "Connectors", ok: false, detail: (e as Error).message });
  }

  const allOk = checks.every((c) => c.ok);
  return NextResponse.json(
    { success: true, data: { status: allOk ? "operational" : "degraded", checks } },
    { status: 200 },
  );
}
