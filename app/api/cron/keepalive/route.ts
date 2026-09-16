import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase free-tier keepalive. Protected by CRON_SECRET (Bearer or Vercel cron header). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;

  if (!isVercelCron) {
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
        { status: 401 },
      );
    }
  }

  try {
    const admin = getSupabaseAdmin();
    await admin.from("keepalive_log").insert({ status: "ok" });
    return NextResponse.json({ success: true, data: { pinged: true } });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: (e as Error).message } },
      { status: 500 },
    );
  }
}
