import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/engine/ratelimit";
import {
  checkPlanLimit,
  incrementUsage,
  getPlanForUser,
  buildUsageInfo,
} from "@/lib/engine/metering";
import { runDeletion } from "@/lib/engine/orchestrator";
import { getConnector, REGISTERED_INTEGRATIONS } from "@/lib/connectors/index";
import { getUsableIntegrationSet, getCustomGrantsForUser } from "@/lib/connectors/flags";
import { isIntegrationAllowed } from "@/lib/constants/compliance";
import { signAudit } from "@/lib/security/signing";
import { updateDeletionRequest } from "@/lib/audit/logger";
import { fireCompletionNotification, deliverWebhook } from "@/lib/notify";
import { validateOutboundUrl } from "@/lib/notify/settings";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { Integration } from "@/types/connector";
import type {
  DeleteUserRequest,
  DeleteUserResponse,
  AuditSubject,
} from "@/types/deletion";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_PER_MIN = 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1) API-key auth (fast indexed lookup).
  const apiKey = await authenticateRequest(req);
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" },
      } satisfies DeleteUserResponse,
      { status: 401 },
    );
  }

  // 2) Rate limit (Redis, fails open if unconfigured).
  const rl = await rateLimit(`del:${apiKey.user_id}`, RATE_LIMIT_PER_MIN, 60);
  if (rl.limited) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Retry after ${Math.ceil(rl.resetMs / 1000)}s`,
        },
      } satisfies DeleteUserResponse,
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  // 3) Plan + body validation.
  const plan = await getPlanForUser(apiKey.user_id);
  let body: DeleteUserRequest;
  try {
    body = (await req.json()) as DeleteUserRequest;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_BODY", message: "Request body must be valid JSON" },
      } satisfies DeleteUserResponse,
      { status: 400 },
    );
  }

  const email = (body.subject_email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_EMAIL", message: "subject_email is missing or malformed" },
      } satisfies DeleteUserResponse,
      { status: 400 },
    );
  }

  // Default to all plan-allowed AND owner-enabled (not in maintenance, not
  // hidden) registered integrations when omitted. Custom-granted connectors
  // (per-user, owner-enabled) are also included regardless of plan.
  const enabledSet = await getUsableIntegrationSet();
  const custom = await getCustomGrantsForUser(apiKey.user_id);
  const allowedSet = new Set<string>([...enabledSet, ...custom]);
  const requested: Integration[] = (body.integrations && body.integrations.length
    ? body.integrations
    : REGISTERED_INTEGRATIONS.filter(
        (i) =>
          allowedSet.has(i) &&
          (custom.has(i) || isIntegrationAllowed(plan, i)),
      )
  ) as Integration[];

  // Reject integrations not on this plan or not registered. A custom grant
  // explicitly bypasses the plan whitelist (owner-enabled for this user).
  const disallowed = requested.filter(
    (i) =>
      !getConnector(i as string) ||
      (!isIntegrationAllowed(plan, i) && !custom.has(i)),
  );
  if (disallowed.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTEGRATION_NOT_ALLOWED",
          message: `Plan '${plan}' does not allow: ${disallowed.join(", ")}`,
        },
      } satisfies DeleteUserResponse,
      { status: 403 },
    );
  }

  // Reject integrations the owner has disabled, hidden, or put into
  // maintenance — unless this user has a specific custom grant for it.
  const disabled = requested.filter((i) => !allowedSet.has(i));
  if (disabled.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONNECTOR_DISABLED",
          message: `Connector(s) currently disabled, hidden, or in maintenance by the administrator: ${disabled.join(", ")}`,
        },
      } satisfies DeleteUserResponse,
      { status: 403 },
    );
  }

  // 4) Plan limit enforcement.
  const limit = await checkPlanLimit(apiKey.user_id, plan);
  if (!limit.allowed) {
    const usageInfo = await buildUsageInfo(apiKey.user_id, plan, false);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "QUOTA_EXCEEDED",
          message: `Monthly deletion limit reached (${limit.used}/${limit.limit}). Upgrade or wait for reset.`,
        },
        data: {
          requestId: "",
          status: "failed",
          results: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          elapsedMs: 0,
          auditSignature: "",
          usage: {
            plan,
            used: limit.used,
            limit: limit.limit,
            remaining: limit.remaining,
            overageRate: limit.overageRate,
          },
        },
      } satisfies DeleteUserResponse,
      { status: 402 },
    );
  }

  // 5) Insert a pending deletion_requests row.
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
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create deletion request" },
      } satisfies DeleteUserResponse,
      { status: 500 },
    );
  }
  const requestId = inserted.id;

  // 6) Run the orchestrator (parallel connectors, partial-failure safe).
  const result = await runDeletion({
    userId: apiKey.user_id,
    email,
    integrations: requested,
    requestId,
    startedAt,
    enabledSet: allowedSet,
  });

  // 7) Sign the canonical result (HMAC-SHA256, Section 6.6).
  const auditSubject: AuditSubject = {
    requestId,
    subjectEmail: email,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    results: result.results.map((r) => ({
      integration: r.integration,
      status: r.status,
      message: r.message,
    })),
  };
  const auditSignature = signAudit(auditSubject);

  // Persist outcome (best-effort — never hide the result if this throws).
  let persisted = true;
  try {
    await updateDeletionRequest({
      requestId,
      status: result.status as "completed" | "partial" | "failed",
      results: result.results,
      auditSignature,
    });
  } catch (e) {
    persisted = false;
    console.error("[delete-user] failed to persist request outcome:", e);
  }

  // 8) Increment usage ONLY on non-failed outcomes (6.7 atomic RPC). A metering
  //    failure must not hide an otherwise-successful deletion.
  let incremented = false;
  if (result.status !== "failed") {
    try {
      await incrementUsage(apiKey.user_id);
      incremented = true;
    } catch (e) {
      console.error("[delete-user] usage increment failed (result preserved):", e);
    }
  }

  const usage = await buildUsageInfo(apiKey.user_id, plan, incremented);

  // 9) Respond — success reflects the REAL outcome (6.15).
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
      usage: {
        plan,
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        overageRate: usage.overageRate,
      },
    },
  };

  // 10) Fire plan-gated completion notifications (webhook / Slack / email).
  //     Fire-and-forget: this never blocks or fails the API response. The
  //     plan gate is enforced inside fireCompletionNotification, but we skip
  //     the owner-email lookup entirely for free plans to avoid a needless
  //     query on the hot path.
  if (plan !== "free") {
    let ownerEmail: string | null = null;
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", apiKey.user_id)
        .maybeSingle();
      ownerEmail = (profile?.email as string | undefined) ?? null;
    } catch {
      ownerEmail = null;
    }
    void fireCompletionNotification({
      userId: apiKey.user_id,
      plan,
      ownerEmail,
      result: response.data!,
    });
  }

  void persisted;

  // 11) Fire a one-off per-request webhook if the caller supplied a valid URL.
  //     SSRF-protected (https-only, no private/loopback hosts) and fire-and-forget
  //     — never blocks or fails the API response. This is in addition to any
  //     account-level webhook configured in the dashboard.
  if (body.webhook) {
    const hookUrl = validateOutboundUrl(body.webhook);
    if (hookUrl) {
      void deliverWebhook(hookUrl, response.data!).catch((e) =>
        console.error("[delete-user] inline webhook delivery failed:", e),
      );
    } else {
      console.warn("[delete-user] rejected invalid inline webhook URL");
    }
  }

  return NextResponse.json(response, { status: httpStatus });
}
