import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { getPlanLimits } from "@/lib/constants/compliance";

/** Resolve the user's current plan slug (defaults to 'free').
 *  If the user is on a 'trialing' subscription that has expired,
 *  auto-downgrade them to 'free' and update the DB. */
export async function getPlanForUser(userId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan,status,trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "free";

  // If on a trial that has expired, downgrade to free
  if (data.status === "trialing" && data.trial_ends_at) {
    const endsAt = new Date(data.trial_ends_at);
    if (endsAt <= new Date()) {
      // Trial expired — downgrade to free
      await admin
        .from("subscriptions")
        .update({
          plan: "free",
          status: "active",
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      return "free";
    }
  }

  return data.plan;
}

/**
 * Usage metering (Section 6.7). Increments go through the atomic increment_usage()
 * Postgres RPC — never a SELECT-then-INSERT/UPDATE in app code, which races
 * under concurrent deletions.
 */

export interface PeriodBounds {
  start: Date; // first of current month, UTC
  end: Date; // first of next month, UTC
}

export function getPeriodBounds(now: Date = new Date()): PeriodBounds {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

export interface UsageSnapshot {
  used: number;
  limit: number; // Infinity for unlimited
  remaining: number;
  overageRate: number | null;
}

export async function getUsage(userId: string): Promise<{
  used: number;
  periodStart: Date;
  periodEnd: Date;
}> {
  const { start, end } = getPeriodBounds();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("usage_meters")
    .select("deletion_count")
    .eq("user_id", userId)
    .eq("period_start", start.toISOString().slice(0, 10))
    .maybeSingle();
  if (error) {
    console.error("[metering] getUsage error:", error.message);
  }
  return { used: data?.deletion_count ?? 0, periodStart: start, periodEnd: end };
}

/**
 * Enforce the plan's deletion limit. Returns whether the NEXT deletion is
 * allowed given current usage.
 */
export async function checkPlanLimit(
  userId: string,
  plan: string,
): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  overageRate: number | null;
}> {
  const { limit, overageRate } = getPlanLimits(plan);
  const { used } = await getUsage(userId);
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    overageRate,
  };
}

/** Atomically increment the user's deletion count for the current period. */
export async function incrementUsage(userId: string): Promise<void> {
  const { start, end } = getPeriodBounds();
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("increment_usage", {
    p_user_id: userId,
    p_period_start: start.toISOString(),
    p_period_end: end.toISOString(),
  });
  if (error) {
    throw new Error(`Usage increment failed: ${error.message}`);
  }
}

/** Compute the usage block returned in the delete-user response. */
export async function buildUsageInfo(
  userId: string,
  plan: string,
  alreadyIncremented: boolean,
): Promise<UsageSnapshot> {
  const { limit, overageRate } = getPlanLimits(plan);
  const { used } = await getUsage(userId);
  const effectiveUsed = alreadyIncremented ? used : Math.max(0, used - 1);
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - effectiveUsed);
  return { used: effectiveUsed, limit, remaining, overageRate };
}
