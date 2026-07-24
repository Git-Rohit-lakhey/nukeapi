import crypto from "node:crypto";

/**
 * Template interpolation context for declarative connector specs.
 * Every connector run gets one, pre-computed from the subject email + creds.
 */
export interface RunCtx {
  email: string;
  emailLower: string;
  emailTrim: string;
  emailLowerTrim: string;
  emailMd5: string;
  creds: Record<string, string>;
  /** Set when interpolating a per-resource delete URL. */
  res?: any;
}

export function makeCtx(email: string, creds: Record<string, string>): RunCtx {
  const emailTrim = email.trim();
  return {
    email,
    emailLower: email.toLowerCase(),
    emailTrim,
    emailLowerTrim: emailTrim.toLowerCase(),
    emailMd5: crypto.createHash("md5").update(emailTrim.toLowerCase()).digest("hex"),
    creds,
  };
}

/**
 * Resolve a dotted path inside an object (e.g. "paging.next.after").
 * Returns undefined when any segment is missing.
 */
export function getPath(obj: any, path?: string): any {
  if (obj == null) return undefined;
  if (!path) return obj;
  return path.split(".").reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

const TOKEN_RE = /b64\(([^)]*)\)|\{([a-zA-Z0-9_.]+)\}/g;

/**
 * Interpolate a template string against the run context.
 *
 * Supported tokens:
 *   {cred.field}        -> credential value
 *   {res.field.sub}     -> field of the current resource item (delete URLs)
 *   {email}             -> raw email
 *   {emailLower}        -> lowercased email
 *   {emailTrim}         -> trimmed email
 *   {emailLowerTrim}    -> lowercased + trimmed email
 *   {emailMd5}          -> md5(lowercased + trimmed email)  (Mailchimp member id)
 *   b64(EXPR)           -> base64(EXPR) where EXPR may itself contain tokens
 *                          (used for Basic auth: b64({cred.secret_key}:))
 */
export function interpolate(template: string, ctx: RunCtx): string {
  if (!template) return template;
  return template.replace(TOKEN_RE, (_whole, b64inner: string | undefined, simple: string | undefined) => {
    if (b64inner !== undefined) {
      // Recursive interpolation inside the base64 payload (no nested b64).
      const inner = b64inner.replace(TOKEN_RE, (_w, _b, s: string | undefined) => (s ? resolveSimple(s, ctx) : ""));
      return Buffer.from(inner).toString("base64");
    }
    return resolveSimple(simple as string, ctx);
  });
}

function resolveSimple(token: string, ctx: RunCtx): string {
  if (token.startsWith("cred.")) return ctx.creds[token.slice(5)] ?? "";
  if (token.startsWith("res.")) {
    const v = getPath(ctx.res, token.slice(4));
    return v == null ? "" : String(v);
  }
  switch (token) {
    case "email":
      return ctx.email;
    case "emailLower":
      return ctx.emailLower;
    case "emailTrim":
      return ctx.emailTrim;
    case "emailLowerTrim":
      return ctx.emailLowerTrim;
    case "emailMd5":
      return ctx.emailMd5;
    default:
      return "";
  }
}

/** Interpolate every value in a record (for header maps). */
export function interpRecord(
  record: Record<string, string> | undefined,
  ctx: RunCtx,
): Record<string, string> {
  if (!record) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) out[k] = interpolate(v, ctx);
  return out;
}
