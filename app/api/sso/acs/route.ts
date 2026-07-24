import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import {
  buildIdP,
  parseSamlResponse,
  decodeRelayState,
  extractSubjectEmail,
  getSsoConfigForOwner,
  type SsoConfigRow,
} from "@/lib/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function errorPage(title: string, detail: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{background:#0a0a0c;color:#d8d8d8;font-family:ui-monospace,monospace;padding:48px;line-height:1.6}
h1{color:#e06060;font-size:20px}a{color:#c8f135}</style></head>
<body><h1>${title}</h1><p>${detail}</p>
<p><a href="/login">← Back to sign in</a></p></body></html>`;
  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * SAML Assertion Consumer Service. The IdP POSTs the signed SAML response
 * here. We:
 *   1) resolve which Enterprise IdP config to verify against (signed RelayState),
 *   2) verify the assertion signature + conditions via samlify,
 *   3) extract the subject email,
 *   4) provision/find the user and issue a session through the app's existing
 *      proven magic-link auth path (Supabase admin generateLink action link).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return errorPage("Bad request", "Expected a form-encoded SAML response.");

  const samlResponse = (form.get("SAMLResponse") as string | null) ?? undefined;
  const relayState = (form.get("RelayState") as string | null) ?? undefined;

  if (!samlResponse) {
    return errorPage("Missing SAML response", "The identity provider sent no assertion.");
  }

  const ownerUserId = decodeRelayState(relayState);
  if (!ownerUserId) {
    return errorPage("Invalid relay state", "The SSO session token is missing or tampered.");
  }

  const config: SsoConfigRow | null = await getSsoConfigForOwner(ownerUserId);
  if (!config || !config.sso_login_url || !config.x509_cert) {
    return errorPage("SSO not configured", "No valid IdP is configured for this account.");
  }

  let extract;
  try {
    const idp = buildIdP({
      idp_entity_id: config.idp_entity_id ?? "",
      sso_login_url: config.sso_login_url,
      x509_cert: config.x509_cert,
    });
    extract = await parseSamlResponse(idp, { SAMLResponse: samlResponse, RelayState: relayState });
  } catch (e) {
    console.error("[sso/acs] assertion verification failed:", e);
    return errorPage("Assertion rejected", "The SAML assertion failed signature or condition checks.");
  }

  const email = extractSubjectEmail(extract);
  if (!email) {
    return errorPage("No subject", "The assertion did not contain a usable user identifier.");
  }

  // Provision or find the user, then issue a session via the proven magic-link
  // action link (reuses Supabase auth + the app's existing session handling).
  try {
    const admin = getSupabaseAdmin();
    await admin.auth.admin
      .createUser({ email, email_confirm: true, user_metadata: { sso: true } })
      .catch((err) => {
        // Ignore "already exists" — we just need the user present.
        const msg = String(err?.message ?? "");
        if (!/already/.test(msg)) throw err;
      });

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl()}/dashboard` },
    });
    if (error || !data?.properties?.action_link) {
      console.error("[sso/acs] session link generation failed:", error);
      return errorPage("Sign-in failed", "Could not start a session. Please use magic-link sign in.");
    }
    return NextResponse.redirect(data.properties.action_link, 302);
  } catch (e) {
    console.error("[sso/acs] user provisioning failed:", e);
    return errorPage("Provisioning failed", "Could not create or locate the user account.");
  }
}
