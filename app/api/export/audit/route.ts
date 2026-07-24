import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isBusinessPlus } from "@/lib/constants/compliance";
import { toCsv } from "@/lib/audit/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Business+-only: download the account's full audit-log history (every
 * per-integration outcome across every deletion request) as CSV. This is the
 * exclusive "audit log export" feature the Business plan unlocks — the free
 * and Startup tiers can view results in the dashboard but cannot bulk-export
 * the full history.
 */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const plan = await getPlanForUser(user.id);
  if (!isBusinessPlus(plan)) {
    return errorResponse(
      "PLAN_REQUIRED",
      "Audit-log export requires the Business plan or higher",
      403,
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("deletion_requests")
    .select(
      "id,subject_email,status,created_at,completed_at,audit_signature,audit_logs(integration,status,message,error_detail,duration_ms,created_at)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load audit history", 500);
  }

  const rows: Array<Array<unknown>> = [];
  for (const req of data ?? []) {
    const logs = (req.audit_logs ?? []) as Array<{
      integration: string;
      status: string;
      message: string | null;
      error_detail: string | null;
      duration_ms: number | null;
      created_at: string;
    }>;
    if (logs.length === 0) {
      rows.push([
        req.id,
        req.subject_email,
        req.status,
        "",
        "",
        "",
        "",
        "",
        req.created_at,
        req.completed_at,
        req.audit_signature,
      ]);
    }
    for (const l of logs) {
      rows.push([
        req.id,
        req.subject_email,
        req.status,
        l.integration,
        l.status,
        l.message,
        l.error_detail,
        l.duration_ms,
        req.created_at,
        req.completed_at,
        req.audit_signature,
      ]);
    }
  }

  const csv = toCsv(
    [
      "request_id",
      "subject_email",
      "request_status",
      "integration",
      "integration_status",
      "message",
      "error_detail",
      "duration_ms",
      "requested_at",
      "completed_at",
      "audit_signature",
    ],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nukeapi-audit-log-${user.id.slice(0, 8)}-${stamp}.csv"`,
    },
  });
});
