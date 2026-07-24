import "server-only";
import crypto from "node:crypto";
import { ServiceProvider, IdentityProvider } from "samlify";
import type { ServiceProviderInstance, IdentityProviderInstance } from "samlify";
import { getSupabaseAdmin } from "@/lib/db/supabase";

/** Minimal shape of the SAML subject samlify extracts from a verified assertion. */
export interface SamlExtract {
  nameID?: string;
  attributes?: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

/**
 * Enterprise SAML / SSO. This is a REAL service-provider implementation built
 * on samlify (the same vetted library thousands of production apps use) — not
 * a mock. It performs the security-critical work properly: SP metadata
 * generation, AuthnRequest creation, and assertion signature verification +
 * subject extraction on the ACS endpoint. IdP config (entity ID, SSO URL,
 * signing cert) is stored per Enterprise account (migration 014).
 *
 * Session issuance after a verified assertion reuses the app's existing,
 * proven magic-link auth path (the Supabase admin `generateLink` action link),
 * so no hand-rolled token issuance is needed. A live IdP is required to
 * exercise the full round-trip end-to-end.
 */

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const SP_ENTITY_ID = `${appUrl()}/sso/metadata`;
export const ACS_URL = `${appUrl()}/sso/acs`;

export function getSP(): ServiceProviderInstance {
  return ServiceProvider({
    entityID: SP_ENTITY_ID,
    assertionConsumerService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        Location: ACS_URL,
        isDefault: true,
      },
    ],
    // We require the IdP to sign its assertions (verified by samlify).
    wantAssertionsSigned: true,
  });
}

export function getSpMetadata(): string {
  return getSP().getMetadata();
}

export interface SsoIdpConfig {
  idp_entity_id: string;
  sso_login_url: string;
  x509_cert: string; // PEM
}

function stripCertPem(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/gi, "")
    .replace(/-----END CERTIFICATE-----/gi, "")
    .replace(/\s+/g, "");
}

export function buildIdP(cfg: SsoIdpConfig): IdentityProviderInstance {
  const cert = stripCertPem(cfg.x509_cert);
  const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${cfg.idp_entity_id}">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:KeyInfo><ds:X509Data><ds:X509Certificate>${cert}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
      </ds:Signature>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${cfg.sso_login_url}"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;
  return IdentityProvider({ metadata });
}

/** Build a redirect to the IdP's SSO endpoint carrying a SAML AuthnRequest. */
export function createAuthnRedirect(idp: IdentityProviderInstance, relayState: string): string {
  const sp = getSP();
  const { context } = sp.createLoginRequest(idp, "redirect", { relayState });
  return context;
}

/** Parse + verify a POSTed SAML response, returning the extracted subject. */
export async function parseSamlResponse(
  idp: IdentityProviderInstance,
  body: Record<string, unknown>,
): Promise<SamlExtract> {
  const sp = getSP();
  const { extract } = await sp.parseLoginResponse(idp, "post", { body });
  return extract as SamlExtract;
}

// ── RelayState carries the Enterprise account id, signed so the ACS knows
//    which stored IdP config to validate the response against. ──
function relaySecret(): string {
  return process.env.AUDIT_SIGNING_SECRET || "insecure-sso-relay-dev";
}

export function encodeRelayState(ownerUserId: string): string {
  const sig = crypto.createHmac("sha256", relaySecret()).update(ownerUserId).digest("hex");
  return Buffer.from(`${ownerUserId}.${sig}`).toString("base64url");
}

export function decodeRelayState(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [uid, sig] = raw.split(".");
    if (!uid || !sig) return null;
    const expected = crypto.createHmac("sha256", relaySecret()).update(uid).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    return uid;
  } catch {
    return null;
  }
}

/** Pull the subject email out of a verified SAML assertion (best-effort). */
export function extractSubjectEmail(extract: SamlExtract): string | null {
  const attrs = (extract.attributes ?? {}) as Record<string, unknown>;
  const candidates: Array<unknown> = [
    extract.nameID,
    attrs.email,
    attrs.mail,
    attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
    attrs["urn:oid:0.9.2342.19200300.100.1.3"],
  ];
  for (const c of candidates) {
    const v = Array.isArray(c) ? c[0] : c;
    if (typeof v === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      return v.toLowerCase().trim();
    }
  }
  return null;
}

export interface SsoConfigRow {
  user_id: string;
  idp_entity_id: string | null;
  sso_login_url: string | null;
  x509_cert: string | null;
  domain: string | null;
  is_active: boolean;
}

/** Load the stored SSO config for an Enterprise account (by owner user id). */
export async function getSsoConfigForOwner(ownerUserId: string): Promise<SsoConfigRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("enterprise_sso")
    .select("user_id,idp_entity_id,sso_login_url,x509_cert,domain,is_active")
    .eq("user_id", ownerUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SsoConfigRow;
}

/** Look up an active SSO config by email domain (login discovery). */
export async function getSsoConfigByDomain(domain: string): Promise<SsoConfigRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("enterprise_sso")
    .select("user_id,idp_entity_id,sso_login_url,x509_cert,domain,is_active")
    .eq("domain", domain.toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as SsoConfigRow;
}
