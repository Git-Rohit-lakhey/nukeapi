import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse } from "@/lib/engine/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/status/:jobId
 * API-key-authenticated lookup of a deletion request's status. Mirrors the
 * reference build's per-job status endpoint. PDF export is served by
 * /api/requests/:id/pdf, so this returns structured JSON only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return errorResponse("UNAUTHORIZED", "Invalid or missing API key", 401);
  }

  const { jobId } = await params;
  if (!jobId) {
    return errorResponse("BAD_REQUEST", "Missing jobId", 400);
  }

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("deletion_requests")
    .select(
      "id,subject_email,status,integrations_requested,integrations_completed,integrations_failed,created_at,completed_at,audit_signature",
    )
    .eq("id", jobId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error || !request) {
    return errorResponse("NOT_FOUND", "Request not found", 404);
  }

  return NextResponse.json({
    success: true,
    data: {
      requestId: request.id,
      status: request.status,
      subjectEmail: request.subject_email,
      integrationsRequested: request.integrations_requested ?? [],
      integrationsCompleted: request.integrations_completed ?? [],
      integrationsFailed: request.integrations_failed ?? [],
      createdAt: request.created_at,
      completedAt: request.completed_at,
      auditSignature: request.audit_signature,
    },
  });
}
