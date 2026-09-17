import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { TRIAL_DURATION_DAYS, TRIAL_ELIGIBLE_PLANS, type PlanSlug } from "@/lib/constants/compliance";

export const runtime = "nodejs";

/**
 * Start a free trial on any paid plan. No credit card required.
 * Creates or updates the user's subscription row with status='trialing'
 * and trial_ends_at set to 14 days from now. If the user already has an
 * active trial or paid subscription, this is a no-op (returns current state).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = (body.plan ?? "").trim() as PlanSlug;

  if (!TRIAL_ELIGIBLE_PLANS.includes(plan)) {
    return errorResponse("INVALID_PLAN", "Trial only available for paid plans", 400);
  }

  const admin = getSupabaseAdmin();

  // Check existing subscription
  const { data: existing } = await admin
    .from("subscriptions")
    .select("plan,status,trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // If already on an active trial or paid plan, don't start another
  if (existing && existing.status === "active") {
    return NextResponse.json({
      success: true,
      data: {
        plan: existing.plan,
        status: "active",
        message: "Already on an active subscription",
      },
    });
  }

  if (existing && existing.status === "trialing" && existing.trial_ends_at) {
    const endsAt = new Date(existing.trial_ends_at);
    if (endsAt > new Date()) {
      return NextResponse.json({
        success: true,
        data: {
          plan: existing.plan,
          status: "trialing",
          trial_ends_at: existing.trial_ends_at,
          days_remaining: Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          message: "Trial already active",
        },
      });
    }
    // Trial expired — fall through to start a new one
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: user.id,
      plan,
      status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[trial] upsert failed:", error.message);
    return errorResponse("INTERNAL_ERROR", "Failed to start trial", 500);
  }

  return NextResponse.json({
    success: true,
    data: {
      plan,
      status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
      days_remaining: TRIAL_DURATION_DAYS,
    },
  });
});
