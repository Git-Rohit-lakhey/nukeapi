import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { cancelSubscription } from "@/lib/billing/dodo";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";

export const runtime = "nodejs";

/**
 * Cancel the user's subscription. Must actually call Dodo's cancel API
 * (Section 6.12); we only mark the local row cancelled IF that succeeds —
 * never the reverse, which would leave billing active after telling the user
 * they've cancelled.
 */
export const POST = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const admin = getSupabaseAdmin();
  const { data: sub, error: readErr } = await admin
    .from("subscriptions")
    .select("external_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) return errorResponse("INTERNAL_ERROR", "Failed to read subscription", 500);
  if (!sub || !sub.external_subscription_id) {
    return errorResponse("NO_SUBSCRIPTION", "No active subscription to cancel", 404);
  }

  // Call the provider first.
  try {
    await cancelSubscription(sub.external_subscription_id);
  } catch (e) {
    return errorResponse(
      "CANCEL_FAILED",
      `Payment provider cancel failed: ${(e as Error).message}`,
      502,
    );
  }

  // Only now update the local record.
  const { error: updErr } = await admin
    .from("subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updErr) return errorResponse("INTERNAL_ERROR", "Failed to update subscription", 500);

  return NextResponse.json({ success: true, data: { cancelled: true } });
});
