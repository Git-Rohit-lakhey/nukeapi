import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ success: true, data: { status: "ok", checks: { api: "ok", time: new Date().toISOString() } } });
}
