import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler, ApiError } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isEnterprise } from "@/lib/constants/compliance";
import {
  buildIdP,
  createAuthnRedirect,
  encodeRelayState,
  getSsoConfigForOwner,
  getSsoConfigByDomain,
  type SsoConfigRow,
} from "@/lib/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIdpConfig(row: SsoConfigRow) {
  return {
    idp_entity_id: row.idp_entity_id ?? "",
    sso_login_url: row.sso_login_url ?? "",
    x509_cert: row.x509_cert ?? "",
  };
}

/**
 * Initiate SAML SSO. Two paths:
 *   1) Domain discovery:  GET /api/sso/login?email=user@acme.com
 *      looks up the active Enterprise SSO config for acme.com and redirects
 *      to that IdP's SSO endpoint.
 *   2) Authenticated Enterprise user: a logged-in Enterprise owner with a
 *      configured IdP is redirected to their own IdP.
 *
 * After a successful IdP login the browser is POSTed back to /api/sso/acs
 * carrying a SAMLResponse (+ our signed RelayState). The RelayState encodes
 * the Enterprise owner id so the ACS knows which IdP config to verify with.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();

  let config: SsoConfigRow | null = null;

  // 1) Domain discovery.
  if (email) {
    const domain = email.split("@")[1];
    if (domain) config = await getSsoConfigByDomain(domain);
  }

  // 2) Fall back to the authenticated Enterprise owner's own config.
  if (!config && email) {
    const user = await getSessionUser();
    if (user) {
      const plan = await getPlanForUser(user.id);
      if (isEnterprise(plan)) {
        config = await getSsoConfigForOwner(user.id);
      }
    }
  }

  if (!config || !config.sso_login_url || !config.x509_cert) {
    throw new ApiError("SSO_NOT_CONFIGURED", "No SSO configuration found for this account", 404);
  }

  const idp = buildIdP(toIdpConfig(config));
  const redirect = createAuthnRedirect(idp, encodeRelayState(config.user_id));

  return NextResponse.redirect(redirect, 302);
});
