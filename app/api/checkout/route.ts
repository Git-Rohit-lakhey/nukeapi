import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/db/supabase";
import { createCheckoutSession } from "@/lib/billing/dodo";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { ALL_PLAN_SLUGS, type PlanSlug } from "@/lib/constants/compliance";

export const runtime = "nodejs";

function resolvePlanSlug(plan: string, billing: string): PlanSlug | null {
  if (plan === "free") return null;
  let slug = plan as PlanSlug;
  if (billing === "yearly" && !slug.endsWith("_yearly")) {
    slug = `${plan}_yearly` as PlanSlug;
  }
  return (ALL_PLAN_SLUGS as string[]).includes(slug) ? slug : null;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const body = (await req.json().catch(() => ({}))) as {
    plan?: string;
    billing?: string;
  };
  const slug = resolvePlanSlug(body.plan ?? "", body.billing ?? "monthly");
  if (!slug) {
    return errorResponse("INVALID_PLAN", "Unknown or free plan", 400);
  }

  const baseUrl = process.env.DODO_PAYMENTS_RETURN_URL ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings`;
  const returnUrl = baseUrl.includes("?") ? `${baseUrl}&checkout=success` : `${baseUrl}?checkout=success`;

  const { checkoutUrl, checkoutId } = await createCheckoutSession({
    userId: user.id,
    email: user.email,
    plan: slug,
    returnUrl,
  });

  return NextResponse.json({ success: true, data: { checkoutUrl, checkoutId } });
});
