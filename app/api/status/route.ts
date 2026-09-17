import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

/**
 * Live status feed for the /status page. Returns checks as an ARRAY of
 * {name, ok, detail} plus an overall status of "operational" | "degraded" —
 * exactly the shape the status page renders. Never throws: a failing check
 * is reported as ok:false so the page degrades instead of crashing.
 */
export async function GET() {
  const checks: StatusCheck[] = [{ name: "API", ok: true, detail: "responding" }];

  try {
    const admin = getSupabaseAdmin();
    const started = Date.now();
    const { error } = await admin
      .from("connector_flags")
      .select("integration", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    checks.push({ name: "Database", ok: true, detail: `${Date.now() - started}ms` });
  } catch (e) {
    checks.push({
      name: "Database",
      ok: false,
      detail: (e as Error).message.slice(0, 120),
    });
  }

  const operational = checks.every((c) => c.ok);
  return NextResponse.json({
    success: true,
    data: { status: operational ? "operational" : "degraded", checks },
  });
}
