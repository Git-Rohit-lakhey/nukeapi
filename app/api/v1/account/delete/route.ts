import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";

export const runtime = "nodejs";

/**
 * Self-service full account deletion. Removing the auth.users row cascades to
 * every table with `on delete cascade` (api_keys, deletion_requests,
 * connector_credentials, subscriptions, usage_meters, ...).
 */
export const POST = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to delete account", 500);
  }
  return NextResponse.json({ success: true, data: { deleted: true } });
});
