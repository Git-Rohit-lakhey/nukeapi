import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler, ApiError } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isEnterprise } from "@/lib/constants/compliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertEnterprise(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new ApiError("UNAUTHORIZED", "Sign in required", 401);
  const ownerEmails = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!ownerEmails.includes(user.email.toLowerCase())) {
    throw new ApiError("FORBIDDEN", "Enterprise SSO is owner-configured only", 403);
  }
  const plan = await getPlanForUser(user.id);
  if (!isEnterprise(plan)) {
    throw new ApiError("PLAN_REQUIRED", "SSO / SAML requires an Enterprise plan", 403);
  }
  return user.id;
}

function looksLikePem(s: string): boolean {
  return /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(s.trim());
}

function isValidHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDomain(s: string): boolean {
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(s.trim());
}

/** GET — return the current SSO config (never the signing cert). */
export const GET = withErrorHandler(async () => {
  const userId = await assertEnterprise();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("enterprise_sso")
    .select("idp_entity_id,domain,is_active,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return errorResponse("INTERNAL_ERROR", "Failed to load SSO config", 500);
  return NextResponse.json({ success: true, data: { configured: !!data, config: data ?? null } });
});

/** PUT — create/update the IdP config for this Enterprise account. */
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const userId = await assertEnterprise();
  const body = (await req.json().catch(() => ({}))) as {
    idp_entity_id?: string;
    sso_login_url?: string;
    x509_cert?: string;
    domain?: string;
  };

  const idp_entity_id = (body.idp_entity_id ?? "").trim();
  const sso_login_url = (body.sso_login_url ?? "").trim();
  const x509_cert = (body.x509_cert ?? "").trim();
  const domain = (body.domain ?? "").trim().toLowerCase();

  if (!idp_entity_id || !sso_login_url || !x509_cert) {
    return errorResponse("INVALID_BODY", "idp_entity_id, sso_login_url and x509_cert are required", 400);
  }
  if (!isValidHttpsUrl(sso_login_url)) {
    return errorResponse("INVALID_URL", "sso_login_url must be a valid https URL", 400);
  }
  if (!looksLikePem(x509_cert)) {
    return errorResponse("INVALID_CERT", "x509_cert must be a PEM-encoded X.509 certificate", 400);
  }
  if (domain && !isValidDomain(domain)) {
    return errorResponse("INVALID_DOMAIN", "domain must be a valid hostname (e.g. acme.com)", 400);
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("enterprise_sso").upsert(
    {
      user_id: userId,
      idp_entity_id,
      sso_login_url,
      x509_cert,
      domain: domain || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return errorResponse("INTERNAL_ERROR", "Failed to save SSO config", 500);

  return NextResponse.json({
    success: true,
    data: { configured: true, idp_entity_id, domain: domain || null, is_active: true },
  });
});

/** DELETE — remove the IdP config. */
export const DELETE = withErrorHandler(async () => {
  const userId = await assertEnterprise();
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("enterprise_sso").delete().eq("user_id", userId);
  if (error) return errorResponse("INTERNAL_ERROR", "Failed to delete SSO config", 500);
  return NextResponse.json({ success: true, data: { configured: false } });
});
