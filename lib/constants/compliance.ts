import type { Integration } from "@/types/connector";

/**
 * SINGLE SOURCE OF TRUTH for plan limits, pricing, overage and legal figures.
 * Every page, migration, webhook and checkout flow reads from here. There is
 * deliberately NO plan_limits table in the database — keeping the numbers in
 * one code location prevents DB/application drift.
 */

export type PlanSlug =
  | "free"
  | "startup"
  | "startup_yearly"
  | "business"
  | "business_yearly"
  | "enterprise"
  | "enterprise_yearly";

export interface PlanDef {
  slug: PlanSlug;
  label: string;
  priceMonthly: number;
  priceYearly: number;
  /** Included deletions per billing period. Infinity for unlimited. */
  includedDeletions: number;
  /** Overage price per deletion beyond the included amount. null = none. */
  overageRate: number | null;
  /** Max number of integrations a user may connect/use. Infinity = unlimited. */
  maxIntegrations: number;
  /** For the free plan only: the specific fixed set permitted (others rejected). */
  allowedIntegrations?: Integration[];
  billing: "monthly" | "yearly" | "free";
}

export const PLANS: Record<PlanSlug, PlanDef> = {
  free: {
    slug: "free",
    label: "Sandbox",
    priceMonthly: 0,
    priceYearly: 0,
    includedDeletions: 20,
    overageRate: null,
    // Free keeps a fixed 3 — must match the homepage code example so a free
    // user's first copy-pasted call succeeds.
    maxIntegrations: 3,
    allowedIntegrations: ["stripe", "mailchimp", "hubspot"],
    billing: "free",
  },
  startup: {
    slug: "startup",
    label: "Startup",
    priceMonthly: 99,
    priceYearly: 990,
    includedDeletions: 200,
    overageRate: 0.5,
    maxIntegrations: 8,
    billing: "monthly",
  },
  startup_yearly: {
    slug: "startup_yearly",
    label: "Startup (yearly)",
    priceMonthly: 99,
    priceYearly: 990,
    includedDeletions: 200,
    overageRate: 0.5,
    maxIntegrations: 8,
    billing: "yearly",
  },
  business: {
    slug: "business",
    label: "Business",
    priceMonthly: 299,
    priceYearly: 2990,
    includedDeletions: 1000,
    overageRate: 0.35,
    maxIntegrations: 20,
    billing: "monthly",
  },
  business_yearly: {
    slug: "business_yearly",
    label: "Business (yearly)",
    priceMonthly: 299,
    priceYearly: 2990,
    includedDeletions: 1000,
    overageRate: 0.35,
    maxIntegrations: 20,
    billing: "yearly",
  },
  enterprise: {
    slug: "enterprise",
    label: "Enterprise",
    priceMonthly: 699,
    priceYearly: 6990,
    includedDeletions: Infinity,
    overageRate: null,
    maxIntegrations: Infinity,
    billing: "monthly",
  },
  enterprise_yearly: {
    slug: "enterprise_yearly",
    label: "Enterprise (yearly)",
    priceMonthly: 699,
    priceYearly: 6990,
    includedDeletions: Infinity,
    overageRate: null,
    maxIntegrations: Infinity,
    billing: "yearly",
  },
};

export const ALL_PLAN_SLUGS = Object.keys(PLANS) as PlanSlug[];

/** Free trial duration in days. Applies to all paid tiers. */
export const TRIAL_DURATION_DAYS = 14;

/** Paid plan slugs that support free trials (all of them). */
export const TRIAL_ELIGIBLE_PLANS: PlanSlug[] = [
  "startup", "startup_yearly",
  "business", "business_yearly",
  "enterprise", "enterprise_yearly",
];

export const FREE_INTEGRATIONS: Integration[] =
  (PLANS.free.allowedIntegrations as Integration[]) ?? [];

/** Effective plan used for limit lookups (collapses yearly variants). */
export function getPlanLimits(plan: string): {
  plan: PlanSlug;
  limit: number;
  overageRate: number | null;
  maxIntegrations: number;
  allowedIntegrations?: Integration[];
} {
  const slug = (ALL_PLAN_SLUGS as string[]).includes(plan)
    ? (plan as PlanSlug)
    : "free";
  const def = PLANS[slug];
  return {
    plan: slug,
    limit: def.includedDeletions,
    overageRate: def.overageRate,
    maxIntegrations: def.maxIntegrations,
    allowedIntegrations: def.allowedIntegrations,
  };
}

/** Max number of integrations a user may connect on a plan (Infinity = all). */
export function getMaxIntegrations(plan: string): number {
  return getPlanLimits(plan).maxIntegrations;
}

/** Map a plan slug to the Dodo product env var name. */
export function dodoProductEnvFor(plan: PlanSlug): string | null {
  switch (plan) {
    case "startup":
      return "DODO_PRODUCT_STARTUP_MONTHLY";
    case "startup_yearly":
      return "DODO_PRODUCT_STARTUP_YEARLY";
    case "business":
      return "DODO_PRODUCT_BUSINESS_MONTHLY";
    case "business_yearly":
      return "DODO_PRODUCT_BUSINESS_YEARLY";
    case "enterprise":
      return "DODO_PRODUCT_ENTERPRISE_MONTHLY";
    case "enterprise_yearly":
      return "DODO_PRODUCT_ENTERPRISE_YEARLY";
    default:
      return null;
  }
}

/** Whether a given integration is permitted under a plan (ignores the owner's
 *  per-integration availability flag — that is enforced separately). The free
 *  Sandbox plan is limited to its fixed whitelist; paid plans allow any
 *  registered integration subject to the connection-count cap. */
export function isIntegrationAllowed(plan: string, integration: Integration): boolean {
  const { allowedIntegrations } = getPlanLimits(plan);
  if (allowedIntegrations) return allowedIntegrations.includes(integration);
  return true;
}

/** Whether a plan is considered paid/active. */
export function isPaidPlan(plan: string): boolean {
  return plan !== "free";
}

/**
 * Plan-tier helpers used to gate the features promised on the pricing page.
 * Plan slugs arrive as either the base form ("startup") or the yearly variant
 * ("startup_yearly"), so these match on the plan family prefix, not exact slug.
 *   - Startup+  : "startup", "startup_yearly"            (PDF audit reports, webhooks)
 *   - Business+ : "business*", "enterprise*"             (Slack/email alerts, audit export)
 *   - Enterprise: "enterprise", "enterprise_yearly"      (custom connectors, SOC 2, SSO, white-label)
 */
export function isStartupPlus(plan: string): boolean {
  // Startup and above — i.e. every paid plan (Startup, Business, Enterprise).
  return (
    plan === "startup" ||
    plan === "startup_yearly" ||
    isBusinessPlus(plan)
  );
}
export function isBusinessPlus(plan: string): boolean {
  return (
    plan === "business" ||
    plan === "business_yearly" ||
    isEnterprise(plan)
  );
}
export function isEnterprise(plan: string): boolean {
  return plan === "enterprise" || plan === "enterprise_yearly";
}

// ── Legal figures (single source; reused by Terms / Privacy / DPA / homepage) ──
export const LEGAL = {
  gdpr: {
    body: "GDPR",
    maxPenalty: "up to €20M or 4% of global annual revenue, whichever is higher",
    responseDeadlineDays: 30,
    responseDeadlineNote:
      "Extensions of up to two further months are allowed for complex requests, with notice to the data subject.",
  },
  ccpa: {
    body: "CCPA/CPRA",
    maxPenalty: "up to $7,500 per intentional violation",
    responseDeadlineDays: 45,
    responseDeadlineNote: "45-day deadline, extendable by an additional 45 days with notice.",
  },
  lgpd: {
    body: "LGPD",
    maxPenalty:
      "up to 2% of revenue in Brazil, capped at R$50M per infraction (ANPD)",
    responseDeadlineDays: 15,
    responseDeadlineNote:
      "LGPD response timeframes vary by request type: up to 15 days for confirmation of existence of processing, with separate timelines for fulfilling the request itself.",
  },
} as const;

/** Sub-processors — single source shared by Privacy Policy and DPA.
 *  Both legal pages render their sub-processor tables from this array, so
 *  the two lists can never drift apart (spec Section 9). */
export const SUB_PROCESSORS: Array<{
  name: string;
  purpose: string;
  location: string;
}> = [
  { name: "Supabase", purpose: "Primary database, auth and encrypted credential storage", location: "United States" },
  { name: "Upstash", purpose: "Redis-backed rate limiting and abuse protection", location: "United States" },
  { name: "Resend", purpose: "Transactional email delivery", location: "United States" },
  { name: "Dodo Payments", purpose: "Merchant of record for billing (card/PayPal)", location: "United States" },
  { name: "Vercel", purpose: "Hosting and serverless compute", location: "United States" },
];
