import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { verifyWebhookSignature } from "@/lib/billing/webhook";
import { ALL_PLAN_SLUGS, type PlanSlug } from "@/lib/constants/compliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dodo Payments webhook handler.
 *
 * IMPORTANT: We ONLY process subscription lifecycle events. Payment events,
 * refund events, etc. are acknowledged (200) but ignored — they don't
 * affect subscription status.
 */
const SUBSCRIPTION_EVENT_TYPES = new Set([
  "subscription.active",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.on_hold",
  "subscription.plan_changed",
  "subscription.failed",
  "subscription.renewed",
]);

/** Reverse-map a Dodo product_id to our plan slug via env. */
function planSlugFromProductId(productId: string | undefined): PlanSlug | null {
  if (!productId) return null;
  for (const slug of ALL_PLAN_SLUGS) {
    if (slug === "free") continue;
    const envName =
      slug === "startup"
        ? "DODO_PRODUCT_STARTUP_MONTHLY"
        : slug === "startup_yearly"
          ? "DODO_PRODUCT_STARTUP_YEARLY"
          : slug === "business"
            ? "DODO_PRODUCT_BUSINESS_MONTHLY"
            : slug === "business_yearly"
              ? "DODO_PRODUCT_BUSINESS_YEARLY"
              : slug === "enterprise"
                ? "DODO_PRODUCT_ENTERPRISE_MONTHLY"
                : slug === "enterprise_yearly"
                  ? "DODO_PRODUCT_ENTERPRISE_YEARLY"
                  : null;
    if (envName && process.env[envName] === productId) return slug;
  }
  return null;
}

/**
 * Map Dodo subscription status to our DB status.
 *
 * Dodo statuses: pending, active, on_hold, cancelled, expired, failed
 * Our DB CHECK: active, cancelled, past_due, trialing
 *
 * We map carefully:
 * - active → active
 * - cancelled / expired → cancelled
 * - on_hold → past_due (suspended, not cancelled)
 * - failed → cancelled (payment permanently failed)
 * - pending → active (Dodo sends pending briefly before active; safe to activate)
 */
function mapStatus(
  dodoStatus: string | undefined,
  eventType: string,
): "active" | "cancelled" | "past_due" {
  // Event type is the source of truth when available
  if (eventType === "subscription.cancelled") return "cancelled";
  if (eventType === "subscription.expired") return "cancelled";
  if (eventType === "subscription.failed") return "cancelled";
  if (eventType === "subscription.on_hold") return "past_due";

  // Fall back to payload status
  switch (dodoStatus) {
    case "cancelled":
    case "expired":
      return "cancelled";
    case "failed":
      return "cancelled";
    case "on_hold":
      return "past_due";
    case "pending":
      return "active"; // Dodo sends pending briefly; safe to treat as active
    case "active":
    default:
      return "active";
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 6.3 — fail closed. Missing secret => reject all.
  if (!process.env.DODO_WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, error: { code: "WEBHOOK_SECRET_MISSING", message: "rejected" } },
      { status: 503 },
    );
  }
  if (!verifyWebhookSignature(raw, req.headers)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_SIGNATURE", message: "invalid signature" } },
      { status: 403 },
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_JSON", message: "invalid payload" } },
      { status: 400 },
    );
  }

  const eventType: string = payload.type ?? payload.event_type ?? "";
  const data = payload.data ?? {};

  // ── Only process subscription lifecycle events ──────────────────────
  if (!SUBSCRIPTION_EVENT_TYPES.has(eventType)) {
    // Acknowledge non-subscription events (payments, refunds, etc.) —
    // we don't process them but return 200 so Dodo doesn't retry.
    return NextResponse.json({ success: true, data: { eventType, action: "ignored" } });
  }

  // ── Extract fields from the subscription event payload ──────────────
  const externalId: string | undefined =
    data.subscription_id ?? data.id ?? data.entity_id;
  const productId: string | undefined =
    data.product_id ?? data.items?.[0]?.product_id ?? data.product?.id;
  const customerEmail: string | undefined =
    data.customer?.email ?? data.customer_email;
  const metaUserId: string | undefined =
    data.metadata?.user_id ?? payload.metadata?.user_id;

  const admin = getSupabaseAdmin();

  // Resolve user. Prefer metadata, else the SQL lookup (handles any user,
  // no Admin-API pagination limit — Section 6.5).
  let userId: string | null = metaUserId ?? null;
  if (!userId && customerEmail) {
    const { data: u, error: ue } = await admin.rpc("user_id_by_email", {
      p_email: customerEmail,
    });
    if (!ue) userId = (u as string) ?? null;
  }
  if (!userId || !externalId) {
    console.error("[dodo webhook] could not resolve user/subscription", {
      eventType,
      externalId,
      customerEmail,
    });
    return NextResponse.json(
      { success: false, error: { code: "UNRESOLVED", message: "no user match" } },
      { status: 200 }, // 2xx so provider doesn't retry indefinitely on a bad payload
    );
  }

  const status = mapStatus(data.status ?? data.subscription_status, eventType);
  const plan = planSlugFromProductId(productId);
  if (!plan) {
    console.error("[dodo webhook] unknown product_id:", productId, "eventType:", eventType);
    return NextResponse.json(
      { success: false, error: { code: "UNKNOWN_PRODUCT", message: `No plan mapping for product: ${productId}` } },
      { status: 500 }, // let Dodo retry — unknown product may need env config
    );
  }
  const nowIso = new Date().toISOString();

  // 6.2 / 6.5 — upsert the subscription. We CHECK and surface the error so a
  // failed write is not silently swallowed (a charged-but-not-upgraded user
  // would otherwise never retry).
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status,
      external_subscription_id: externalId,
      current_period_start: data.current_period_start
        ? new Date(data.current_period_start).toISOString()
        : null,
      current_period_end: data.current_period_end
        ? new Date(data.current_period_end).toISOString()
        : null,
      cancelled_at: status === "cancelled" ? nowIso : null,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[dodo webhook] subscription upsert FAILED:", error.message);
    return NextResponse.json(
      { success: false, error: { code: "DB_WRITE_FAILED", message: error.message } },
      { status: 500 }, // let Dodo retry
    );
  }

  return NextResponse.json({ success: true, data: { eventType, userId, plan, status } });
}
