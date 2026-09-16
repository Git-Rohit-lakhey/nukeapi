import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/engine/ratelimit";
import { checkPlanLimit, incrementUsage, getPlanForUser, buildUsageInfo } from "@/lib/engine/metering";
import { runDeletion } from "@/lib/engine/orchestrator";
import { getConnector, REGISTERED_INTEGRATIONS } from "@/lib/connectors/index";
import { isIntegrationAllowed } from "@/lib/constants/compliance";
import { signAudit } from "@/lib/security/signing";
import { updateDeletionRequest } from "@/lib/audit/logger";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { Integration } from "@/types/connector";
import type { DeleteUserRequest, DeleteUserResponse, AuditSubject } from "@/types/deletion";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_PER_MIN = 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = await authenticateRequest(req);
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } } satisfies DeleteUserResponse,
      { status: 401 },
    );
  }

  const rl = await rateLimit(`del:${apiKey.user_id}`, RATE_LIMIT_PER_MIN, 60);
  if (rl.limited) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: `Rate limit exceeded. Retry after ${Math.ceil(rl.resetMs / 1000)}s` } } satisfies DeleteUserResponse,
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  const plan = await getPlanForUser(apiKey.user_id);
  let body: DeleteUserRequest;
  try {
    body = (await req.json()) as DeleteUserRequest;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: "Request body must be valid JSON" } } satisfies DeleteUserResponse,
      { status: 400 },
    );
  }

  const emailRaw = (body.subject_email ?? (body as unknown as Record<string, unknown>).email as string ?? "") as string;
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_EMAIL", message: "subject_email is missing or malformed" } } satisfies DeleteUserResponse,
      { status: 400 },
    );
  }

  const requested: Integration[] = (
    body.integrations && body.integrations.length
      ? body.integrations
      : REGISTERED_INTEGRATIONS.filter((i) => isIntegrationAllowed(plan, i as Integration))
  ) as Integration[];

  const disallowed = requested.filter((i) => !getConnector(i as string) || !isIntegrationAllowed(plan, i));
  if (disallowed.length > 0) {
    return NextResponse.json(
      { success: false, error: { code: "INTEGRATION_NOT_ALLOWED", message: `Plan '${plan}' does not allow: ${disallowed.join(", ")}` } } satisfies DeleteUserResponse,
      { status: 403 },
    );
  }

  const limit = await checkPlanLimit(apiKey.user_id, plan);
  if (!limit.allowed) {
    const usageInfo = await buildUsageInfo(apiKey.user_id, plan);
    return NextResponse.json(
      {
        success: false,
        error: { code: "QUOTA_EXCEEDED", message: `Monthly deletion limit reached (${limit.used}/${limit.limit}). Upgrade or wait for reset.` },
        data: {
          requestId: "",
          status: "failed",
          results: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          elapsedMs: 0,
          auditSignature: "",
          usage: { plan, used: limit.used, limit: limit.limit, remaining: limit.remaining, overageRate: limit.overageRate },
        },
      } satisfies DeleteUserResponse,
      { status: 402 },
    );
  }

  const admin = getSupabaseAdmin();
  const startedAt = new Date().toISOString();
  const { data: inserted, error: insertErr } = await admin
    .from("deletion_requests")
    .insert({
      user_id: apiKey.user_id,
      api_key_id: apiKey.id,
      subject_email: email,
      subject_external_id: body.subject_external_id ?? null,
      integrations_requested: requested,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create deletion request" } } satisfies DeleteUserResponse,
      { status: 500 },
    );
  }
  const requestId = inserted.id;

  const result = await runDeletion({ userId: apiKey.user_id, email, integrations: requested, requestId, startedAt });

  const auditSubject: AuditSubject = {
    requestId,
    subjectEmail: email,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    results: result.results.map((r) => ({ integration: r.integration, status: r.status, message: r.message })),
  };
  const auditSignature = signAudit(auditSubject);

  try {
    await updateDeletionRequest({
      requestId,
      status: result.status as "completed" | "partial" | "failed",
      results: result.results,
      auditSignature,
    });
  } catch (e) {
    console.error("[delete-user] failed to persist outcome:", e);
  }

  if (result.status !== "failed") {
    try {
      await incrementUsage(apiKey.user_id);
    } catch (e) {
      console.error("[delete-user] usage increment failed (result preserved):", e);
    }
  }

  const usage = await buildUsageInfo(apiKey.user_id, plan);
  const success = result.status !== "failed";
  const httpStatus = result.status === "completed" ? 200 : result.status === "partial" ? 207 : 500;

  const response: DeleteUserResponse = {
    success,
    requestId,
    data: {
      requestId,
      status: result.status,
      results: result.results,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      elapsedMs: result.elapsedMs,
      auditSignature,
      usage: { plan, used: usage.used, limit: usage.limit, remaining: usage.remaining, overageRate: usage.overageRate },
    },
  };

  return NextResponse.json(response, { status: httpStatus });
}
