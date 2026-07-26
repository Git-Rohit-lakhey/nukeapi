import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { cancelSubscription } from "@/lib/billing/dodo";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";

export const runtime = "nodejs";

/**
 * Self-service full account deletion. Cancels any active Dodo subscription
 * first (Section 6.12 — never leave billing active after account deletion),
 * then removes the auth.users row which cascades to every table with
 * `on delete cascade`.
 */
export const POST = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const admin = getSupabaseAdmin();

  // Cancel active subscription before deleting (Section 6.12 / 6.13).
  const { data: sub } = await admin
    .from("subscriptions")
    .select("external_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (sub?.external_subscription_id && sub.status === "active") {
    try {
      await cancelSubscription(sub.external_subscription_id);
    } catch (e) {
      // Log but don't block deletion — the user explicitly requested account
      // removal. The subscription cancel failure is logged for support follow-up.
      console.error("[account/delete] subscription cancel failed:", e);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to delete account", 500);
  }
  return NextResponse.json({ success: true, data: { deleted: true } });
});
