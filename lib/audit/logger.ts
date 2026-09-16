import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { ConnectorResult } from "@/types/connector";

/**
 * Write per-integration audit rows. Best-effort: callers (the orchestrator)
 * wrap this in its OWN try/catch so a logging failure can never drop a
 * connector result from the audit trail (Section 6.16).
 */
export async function writeAuditLogs(
  deletionRequestId: string,
  results: ConnectorResult[],
): Promise<void> {
  const admin = getSupabaseAdmin();
  const rows = results.map((r) => ({
    deletion_request_id: deletionRequestId,
    integration: r.integration,
    status: r.status,
    message: r.message,
    error_detail: r.error ?? null,
    duration_ms: r.durationMs,
  }));
  const { error } = await admin.from("audit_logs").insert(rows);
  if (error) throw error;
}

/** Persist the overall deletion_requests row outcome. */
export async function updateDeletionRequest(params: {
  requestId: string;
  status: "completed" | "partial" | "failed";
  results: ConnectorResult[];
  auditSignature: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const completed = params.results
    .filter((r) => r.status === "success")
    .map((r) => r.integration);
  const failed = params.results
    .filter((r) => r.status === "failed")
    .map((r) => r.integration);
  const { error } = await admin
    .from("deletion_requests")
    .update({
      status: params.status,
      completed_at: new Date().toISOString(),
      integrations_completed: completed,
      integrations_failed: failed,
      audit_signature: params.auditSignature,
    })
    .eq("id", params.requestId);
  if (error) throw error;
}
