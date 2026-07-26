import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { decryptJSON } from "@/lib/security/crypto";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET    — fetch a single custom connector (spec decrypted for display).
 * DELETE — remove a custom connector.
 */
export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("custom_connectors")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return errorResponse("NOT_FOUND", "Connector not found", 404);

  // Decrypt spec for display (never expose raw encrypted blob).
  let spec: unknown = null;
  try {
    spec = decryptJSON(data.spec);
  } catch {
    spec = null;
  }

  // Decrypt credentials keys only (show which fields exist, not the values).
  const credFields: string[] = [];
  try {
    const creds = decryptJSON<Record<string, string>>(data.credentials);
    credFields.push(...Object.keys(creds));
  } catch {
    // ignore
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      is_active: data.is_active,
      spec,
      credentialFields: credFields,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  });
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("custom_connectors")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return errorResponse("INTERNAL_ERROR", "Failed to delete connector", 500);

  return NextResponse.json({ success: true, data: { deleted: true } });
});
