import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isStartupPlus, isBusinessPlus } from "@/lib/constants/compliance";
import {
  getNotificationSettings,
  validateOutboundUrl,
  validateSlackUrl,
  encryptUrl,
} from "@/lib/notify/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Session-authenticated notification-settings management.
 *   GET  — return the current settings + which channels the plan unlocks.
 *   PUT  — update webhook_url (Startup+), slack_webhook_url / email_alerts
 *          (Business+). Fields the plan does not unlock are rejected.
 */

export const GET = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const [plan, settings] = await Promise.all([
    getPlanForUser(user.id),
    getNotificationSettings(user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      settings,
      capabilities: {
        webhook: isStartupPlus(plan),
        slack: isBusinessPlus(plan),
        email: isBusinessPlus(plan),
      },
      plan,
    },
  });
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const plan = await getPlanForUser(user.id);
  const body = (await req.json().catch(() => ({}))) as {
    webhook_url?: string | null;
    slack_webhook_url?: string | null;
    email_alerts?: boolean;
  };

  const update: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  // Webhook — Startup and above.
  if ("webhook_url" in body) {
    if (!isStartupPlus(plan)) {
      return errorResponse(
        "PLAN_REQUIRED",
        "Webhook callbacks require the Startup plan or higher",
        403,
      );
    }
    const raw = body.webhook_url;
    if (raw === null || raw === "") {
      update.webhook_url = null;
    } else {
      const valid = validateOutboundUrl(raw);
      if (!valid) {
        return errorResponse(
          "INVALID_URL",
          "webhook_url must be a public https URL",
          400,
        );
      }
      update.webhook_url = encryptUrl(valid);
    }
  }

  // Slack + email alerts — Business and above.
  if ("slack_webhook_url" in body) {
    if (!isBusinessPlus(plan)) {
      return errorResponse(
        "PLAN_REQUIRED",
        "Slack alerts require the Business plan or higher",
        403,
      );
    }
    const raw = body.slack_webhook_url;
    if (raw === null || raw === "") {
      update.slack_webhook_url = null;
    } else {
      const valid = validateSlackUrl(raw);
      if (!valid) {
        return errorResponse(
          "INVALID_URL",
          "slack_webhook_url must be an https hooks.slack.com URL",
          400,
        );
      }
      update.slack_webhook_url = encryptUrl(valid);
    }
  }

  if ("email_alerts" in body) {
    if (!isBusinessPlus(plan)) {
      return errorResponse(
        "PLAN_REQUIRED",
        "Email alerts require the Business plan or higher",
        403,
      );
    }
    update.email_alerts = Boolean(body.email_alerts);
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("notification_settings")
    .upsert(update, { onConflict: "user_id" });
  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to save settings", 500);
  }

  const settings = await getNotificationSettings(user.id);
  return NextResponse.json({ success: true, data: { settings } });
});
