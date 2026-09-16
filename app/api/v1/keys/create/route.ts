import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { generateApiKey, hashApiKey } from "@/lib/auth/keys";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import type { CreateKeyBody, CreateKeyResponse } from "@/types/api";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const body = (await req.json().catch(() => ({}))) as CreateKeyBody;
  const name = (body.name ?? "").trim();
  if (!name) return errorResponse("INVALID_BODY", "Key name is required", 400);

  const { raw, prefix } = generateApiKey();
  const { keyHash, keyLookupHash } = await hashApiKey(raw);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .insert({
      user_id: user.id,
      name,
      key_hash: keyHash,
      key_prefix: prefix,
      key_lookup_hash: keyLookupHash,
      expires_at: body.expires_at ?? null,
    })
    .select("id,created_at")
    .single();

  if (error || !data) {
    return errorResponse("INTERNAL_ERROR", "Failed to create key", 500);
  }

  // Raw key is returned exactly once and never stored.
  const res: CreateKeyResponse = {
    id: data.id,
    name,
    key: raw,
    prefix,
    key_lookup_hash: keyLookupHash,
    created_at: data.created_at,
  };
  return NextResponse.json({ success: true, data: res });
});
