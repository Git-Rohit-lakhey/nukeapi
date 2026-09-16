import type { ConnectorResult, Integration } from "./connector";

export type DeletionStatus = "pending" | "completed" | "partial" | "failed";

export interface UsageInfo {
  plan: string;
  used: number;
  limit: number;
  remaining: number;
  overageRate?: number | null;
  overageCharged?: number;
}

export interface DeleteUserRequest {
  subject_email: string;
  integrations?: Integration[];
  subject_external_id?: string;
  /**
   * Optional per-request webhook URL. When provided (and a valid public https
   * URL), NukeAPI POSTs a signed `deletion.completed` payload to it on
   * completion — in addition to any account-level webhook configured in the
   * dashboard. SSRF-protected; fire-and-forget; never blocks the response.
   */
  webhook?: string;
}

export interface DeleteUserResponse {
  success: boolean;
  data?: {
    requestId: string;
    status: DeletionStatus;
    results: ConnectorResult[];
    startedAt: string;
    completedAt: string;
    elapsedMs: number;
    auditSignature: string;
    usage: UsageInfo;
  };
  requestId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/** Canonical payload that gets signed for the audit trail. */
export interface AuditSubject {
  requestId: string;
  subjectEmail: string;
  status: DeletionStatus;
  startedAt: string;
  completedAt: string;
  results: Array<{
    integration: string;
    status: string;
    message: string;
  }>;
}
