import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { generateAuditPdf } from "@/lib/audit/pdf";
import { signAudit } from "@/lib/security/signing";
import { errorResponse } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isPaidPlan, isEnterprise } from "@/lib/constants/compliance";
import type { AuditSubject } from "@/types/deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  // PDF audit reports are a paid feature (Startup and above). Free/Sandbox
  // accounts can view per-integration results in the dashboard but cannot
  // download the signed PDF.
  const plan = await getPlanForUser(user.id);
  if (!isPaidPlan(plan)) {
    return errorResponse(
      "PLAN_REQUIRED",
      "Downloadable PDF audit reports require the Startup plan or higher",
      403,
    );
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: req, error: reqErr } = await admin
    .from("deletion_requests")
    .select("id,subject_email,status,created_at,completed_at,audit_signature")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (reqErr || !req) return errorResponse("NOT_FOUND", "Request not found", 404);

  const { data: logs } = await admin
    .from("audit_logs")
    .select("integration,status,message")
    .eq("deletion_request_id", id)
    .order("created_at", { ascending: true });

  const auditSubject: AuditSubject = {
    requestId: req.id,
    subjectEmail: req.subject_email,
    status: req.status,
    startedAt: req.created_at,
    completedAt: req.completed_at ?? req.created_at,
    results: (logs ?? []).map((l) => ({
      integration: l.integration,
      status: l.status,
      message: l.message ?? "",
    })),
  };

  // Re-sign to guarantee the embedded signature matches the canonical result.
  const signature = req.audit_signature ?? signAudit(auditSubject);

  const pdf = await generateAuditPdf({
    ...auditSubject,
    auditSignature: signature,
    generatedAt: new Date().toISOString(),
    // White-label reports (no NukeAPI wordmark) are an Enterprise feature.
    whiteLabel: isEnterprise(plan),
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nukeapi-audit-${req.id}.pdf"`,
    },
  });
}
