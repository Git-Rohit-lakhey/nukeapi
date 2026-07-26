import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { encryptJSON, decryptJSON } from "@/lib/security/crypto";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isBusinessPlus } from "@/lib/constants/compliance";
import { validateCustomSpec } from "@/lib/connectors/custom/validate";
import { validateOutboundUrl } from "@/lib/notify/settings";
import type { EncryptedEnvelope } from "@/types/connector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * GET  — list the user's custom connectors (decrypts specs for display).
 * POST — create a new custom connector (Business+ only, encrypted storage).
 */
export const GET = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("custom_connectors")
    .select("id,name,slug,is_active,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return errorResponse("INTERNAL_ERROR", "Failed to load connectors", 500);

  return NextResponse.json({ success: true, data: data ?? [] });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  // Business+ only (Section 6.12).
  const plan = await getPlanForUser(user.id);
  if (!isBusinessPlus(plan)) {
    return errorResponse("PLAN_REQUIRED", "Custom connectors require the Business plan or higher", 403);
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    slug?: string;
    spec?: unknown;
    credentials?: Record<string, string>;
  };

  // ── Validate name ──
  if (!body.name || typeof body.name !== "string" || body.name.length < 2 || body.name.length > 80) {
    return errorResponse("VALIDATION", "Name must be 2-80 characters", 400);
  }

  // ── Validate slug ──
  const slug = (body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")).slice(0, 64);
  if (!SLUG_RE.test(slug)) {
    return errorResponse("VALIDATION", "Slug must be lowercase alphanumeric with underscores, starting with a letter", 400);
  }

  // ── Validate spec ──
  const specResult = validateCustomSpec(body.spec);
  if (!specResult.valid) {
    return errorResponse("VALIDATION", specResult.error, 400);
  }

  // ── Validate credentials ──
  if (!body.credentials || typeof body.credentials !== "object" || Object.keys(body.credentials).length === 0) {
    return errorResponse("VALIDATION", "At least one credential value is required", 400);
  }
  for (const [k, v] of Object.entries(body.credentials)) {
    if (typeof v !== "string" || v.length === 0) {
      return errorResponse("VALIDATION", `Credential field '${k}' must be a non-empty string`, 400);
    }
  }

  // ── Encrypt spec + credentials server-side (Section 6.1) ──
  const encryptedSpec = encryptJSON(specResult.spec);
  const encryptedCreds = encryptJSON(body.credentials);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("custom_connectors").insert({
    user_id: user.id,
    name: body.name.trim(),
    slug,
    spec: encryptedSpec as unknown as Record<string, string>,
    credentials: encryptedCreds as unknown as Record<string, string>,
  });

  if (error) {
    if (error.code === "23505") {
      return errorResponse("CONFLICT", `A connector with slug '${slug}' already exists`, 409);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to save connector", 500);
  }

  return NextResponse.json({ success: true, data: { slug, name: body.name.trim() } }, { status: 201 });
});
