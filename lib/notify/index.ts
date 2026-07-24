import "server-only";
import crypto from "node:crypto";
import { fetchWithRetry } from "@/lib/connectors/fetchHelper";
import { isStartupPlus, isBusinessPlus } from "@/lib/constants/compliance";
import { getNotificationSettings } from "@/lib/notify/settings";
import { sendEmail } from "@/lib/notify/email";
import type { DeleteUserResponse } from "@/types/deletion";

/**
 * Completion notifications — the real code behind the pricing-page claims:
 *   - "Webhook callbacks"     (Startup+):  outbound signed POST of the result.
 *   - "Slack & email alerts"  (Business+): Slack incoming-webhook + email.
 *
 * All delivery is best-effort and fire-and-forget: every channel is wrapped in
 * its own try/catch, gated by plan, and MUST NOT block or fail the deletion
 * API response (called with `void` from the route).
 */

export interface CompletionNotifyInput {
  userId: string;
  plan: string;
  ownerEmail: string | null;
  result: NonNullable<DeleteUserResponse["data"]>;
}

/** HMAC-SHA256 over the JSON body so receivers can verify authenticity. */
function signWebhookBody(body: string): string {
  const secret =
    process.env.NUKEAPI_WEBHOOK_SIGNING_SECRET ??
    process.env.AUDIT_SIGNING_SECRET;
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverWebhook(url: string, result: CompletionNotifyInput["result"]) {
  const payload = {
    type: "deletion.completed",
    requestId: result.requestId,
    status: result.status,
    results: result.results.map((r) => ({
      integration: r.integration,
      status: r.status,
      message: r.message,
    })),
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    auditSignature: result.auditSignature,
  };
  const body = JSON.stringify(payload);
  const signature = signWebhookBody(body);
  await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "NukeAPI-Webhook/1",
        ...(signature ? { "X-NukeAPI-Signature": `sha256=${signature}` } : {}),
      },
      body,
    },
    { timeoutMs: 8000, retries: 2 },
  );
}

async function deliverSlack(url: string, result: CompletionNotifyInput["result"]) {
  const ok = result.status === "completed";
  const icon = ok ? ":white_check_mark:" : result.status === "partial" ? ":warning:" : ":x:";
  const lines = result.results
    .map((r) => `• *${r.integration}* — ${r.status}`)
    .join("\n");
  const text =
    `${icon} NukeAPI deletion *${result.status}* (request \`${result.requestId}\`)\n` +
    `${lines}`;
  await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    { timeoutMs: 8000, retries: 1 },
  );
}

function emailBody(result: CompletionNotifyInput["result"]): { subject: string; text: string } {
  const subject = `NukeAPI deletion ${result.status} — ${result.requestId}`;
  const lines = result.results
    .map((r) => `  [${r.status.toUpperCase()}] ${r.integration} — ${r.message}`)
    .join("\n");
  const text =
    `Your NukeAPI deletion request completed with status: ${result.status.toUpperCase()}.\n\n` +
    `Request ID: ${result.requestId}\n` +
    `Started:    ${result.startedAt}\n` +
    `Completed:  ${result.completedAt}\n\n` +
    `Per-integration results:\n${lines}\n\n` +
    `Audit signature (HMAC-SHA256): ${result.auditSignature}\n\n` +
    `— NukeAPI`;
  return { subject, text };
}

/**
 * Fire the plan-gated completion notifications. Never throws. Intended to be
 * called fire-and-forget: `void fireCompletionNotification(...)`.
 */
export async function fireCompletionNotification(
  input: CompletionNotifyInput,
): Promise<void> {
  try {
    const settings = await getNotificationSettings(input.userId);

    // Webhook callbacks — Startup and above.
    if (isStartupPlus(input.plan) && settings.webhook_url) {
      try {
        await deliverWebhook(settings.webhook_url, input.result);
      } catch (e) {
        console.error("[notify] webhook delivery failed:", e);
      }
    }

    // Slack + email alerts — Business and above.
    if (isBusinessPlus(input.plan)) {
      if (settings.slack_webhook_url) {
        try {
          await deliverSlack(settings.slack_webhook_url, input.result);
        } catch (e) {
          console.error("[notify] slack delivery failed:", e);
        }
      }
      if (settings.email_alerts && input.ownerEmail) {
        try {
          const { subject, text } = emailBody(input.result);
          await sendEmail({ to: input.ownerEmail, subject, text });
        } catch (e) {
          console.error("[notify] email delivery failed:", e);
        }
      }
    }
  } catch (e) {
    // Loading settings failed — swallow; notifications are best-effort.
    console.error("[notify] fireCompletionNotification failed:", e);
  }
}
