import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin/debug endpoint. OPT-IN and FAILS CLOSED (Section 6.13): unless
 * ENABLE_DEBUG_ENDPOINT === "true" it 404s. A forgotten env var always fails
 * toward "disabled".
 */
function debugEnabled(): boolean {
  return process.env.ENABLE_DEBUG_ENDPOINT === "true";
}

export async function GET() {
  if (!debugEnabled()) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({
    success: true,
    data: {
      env: {
        hasRedis: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        hasEncryptionKey: Boolean(process.env.CREDENTIALS_ENCRYPTION_KEY),
        hasSigningSecret: Boolean(process.env.AUDIT_SIGNING_SECRET),
        dodoEnv: process.env.DODO_PAYMENTS_ENVIRONMENT ?? null,
      },
      time: new Date().toISOString(),
    },
  });
}
