import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import {
  grantCustomIntegration,
  revokeCustomIntegration,
  getAllCustomGrants,
} from "@/lib/connectors/flags";
import { isRegisteredIntegration } from "@/lib/connectors/index";
import { CONNECTOR_META } from "@/lib/connectors/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only check, mirroring the /owner page and OWNER_EMAILS allowlist. */
function isOwner(email: string): boolean {
  const ownerEmails = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return ownerEmails.includes(email.toLowerCase());
}

/** Resolve a user email to an id via the profiles table. */
async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * GET — list every active custom (per-user) grant. Owner only.
 */
export const GET = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user || !isOwner(user.email)) {
    return errorResponse("FORBIDDEN", "Admin only", 403);
  }
  const grants = await getAllCustomGrants();
  const rows = grants.map((g) => ({
    userId: g.user_id,
    integration: g.integration,
    label: CONNECTOR_META[g.integration as keyof typeof CONNECTOR_META]?.label ?? g.integration,
    grantedBy: g.granted_by,
    createdAt: g.created_at,
  }));
  return NextResponse.json({ success: true, data: { grants: rows } });
});

/**
 * POST — grant a built connector to a specific user (by email). Owner only.
 * The target account must be on the Enterprise plan (custom connectors are an
 * Enterprise-only feature — enforced in grantCustomIntegration).
 * Body: { email: string, integration: string }.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user || !isOwner(user.email)) {
    return errorResponse("FORBIDDEN", "Admin only", 403);
  }
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    integration?: string;
  };
  const email = (body.email ?? "").trim();
  const integration = (body.integration ?? "").trim();

  if (!isRegisteredIntegration(integration)) {
    return errorResponse("INVALID_INTEGRATION", `Unknown integration: ${integration}`, 400);
  }
  if (!email) {
    return errorResponse("INVALID_BODY", "Provide a user email", 400);
  }
  const userId = await resolveUserIdByEmail(email);
  if (!userId) {
    return errorResponse("USER_NOT_FOUND", `No user with email ${email}`, 404);
  }
  await grantCustomIntegration(integration, userId, user.id);
  return NextResponse.json({
    success: true,
    data: { userId, integration, granted: true },
  });
});

/**
 * DELETE — revoke a custom grant. Owner only.
 * Body: { email: string, integration: string } (or userId instead of email).
 */
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user || !isOwner(user.email)) {
    return errorResponse("FORBIDDEN", "Admin only", 403);
  }
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    userId?: string;
    integration?: string;
  };
  const integration = (body.integration ?? "").trim();
  if (!isRegisteredIntegration(integration)) {
    return errorResponse("INVALID_INTEGRATION", `Unknown integration: ${integration}`, 400);
  }
  let userId = (body.userId ?? "").trim();
  if (!userId && body.email) {
    userId = (await resolveUserIdByEmail(body.email)) ?? "";
  }
  if (!userId) {
    return errorResponse("USER_NOT_FOUND", "Provide a valid email or userId", 404);
  }
  await revokeCustomIntegration(integration, userId, user.id);
  return NextResponse.json({
    success: true,
    data: { userId, integration, revoked: true },
  });
});
