import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isEnterprise } from "@/lib/constants/compliance";
import { toCsv } from "@/lib/audit/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enterprise-only: SOC 2 export — a downloadable compliance artifact covering
 * the account's full deletion history and the signed per-integration audit
 * trail. This is evidence an Enterprise customer can hand to auditors; it is
 * NOT a SOC 2 attestation (NukeAPI does not issue attestations). The naming
 * is kept precise: "SOC 2 export" = exportable audit evidence, which is what
 * the product can honestly deliver.
 */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const plan = await getPlanForUser(user.id);
  if (!isEnterprise(plan)) {
    return errorResponse(
      "PLAN_REQUIRED",
      "SOC 2 export requires an Enterprise plan",
      403,
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("deletion_requests")
    .select(
      "id,subject_email,status,integrations_requested,integrations_completed,integrations_failed,created_at,completed_at,audit_signature,audit_logs(integration,status,message,error_detail,duration_ms,created_at)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load export data", 500);
  }

  const rows: Array<Array<unknown>> = [];
  for (const req of data ?? []) {
    const logs = (req.audit_logs ?? []) as Array<{
      integration: string;
      status: string;
      message: string | null;
      error_detail: string | null;
      duration_ms: number | null;
    }>;
    rows.push([
      req.id,
      req.subject_email,
      req.status,
      (req.integrations_requested ?? []).join("|"),
      (req.integrations_completed ?? []).join("|"),
      (req.integrations_failed ?? []).join("|"),
      (logs.length ? `${logs.length} steps` : "no steps"),
      req.created_at,
      req.completed_at,
      req.audit_signature,
      logs
        .map((l) => `${l.integration}:${l.status}`)
        .join("|"),
    ]);
  }

  const csv = toCsv(
    [
      "request_id",
      "subject_email",
      "status",
      "integrations_requested",
      "integrations_completed",
      "integrations_failed",
      "steps",
      "requested_at",
      "completed_at",
      "audit_signature",
      "per_integration",
    ],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nukeapi-soc2-export-${user.id.slice(0, 8)}-${stamp}.csv"`,
    },
  });
});
