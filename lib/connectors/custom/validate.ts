import type { HttpSpec } from "@/lib/connectors/engine/types";

/**
 * Strictly validate a user-submitted custom HTTP connector spec.
 * Prevents SSRF, injection, and malformed specs from reaching the engine.
 *
 * Returns { valid: true, spec } on success, { valid: false, error } on failure.
 */

const URL_RE = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
const PATH_RE = /^\/[^\s]*$/;
const TEMPLATE_RE = /^\{[a-zA-Z_][a-zA-Z0-9_.]*\}$|^[^{}/]+$/;
const RESULTS_PATH_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

function reject(msg: string): { valid: false; error: string } {
  return { valid: false, error: msg };
}

export function validateCustomSpec(input: unknown): {
  valid: true;
  spec: HttpSpec;
} | { valid: false; error: string } {
  if (!input || typeof input !== "object") return reject("Spec must be a JSON object");

  const s = input as Record<string, unknown>;

  // ── Top-level ──
  if (s.transport !== "http") return reject("Only HTTP transport is supported for custom connectors");
  if (typeof s.label !== "string" || s.label.length < 1 || s.label.length > 80) {
    return reject("Label must be 1-80 characters");
  }

  // ── Base URL ──
  if (typeof s.baseUrl !== "string") return reject("baseUrl is required");
  const baseUrlClean = s.baseUrl.replace(/\{cred\.[^}]+\}/g, "placeholder");
  if (!URL_RE.test(baseUrlClean)) return reject("baseUrl must be a valid https:// URL");

  // SSRF protection — block localhost, private IPs
  try {
    const u = new URL(baseUrlClean);
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return reject("baseUrl must not point to localhost or private networks");
    }
  } catch {
    return reject("baseUrl is not a valid URL");
  }

  // ── Auth ──
  const auth = s.auth as Record<string, unknown> | undefined;
  if (!auth || typeof auth !== "object") return reject("auth is required");
  if (!["none", "bearer", "basic", "header"].includes(auth.type as string)) {
    return reject("auth.type must be one of: none, bearer, basic, header");
  }
  if (auth.type === "header") {
    if (typeof auth.name !== "string" || !auth.name) return reject("auth.header name is required");
    if (typeof auth.value !== "string" || !auth.value) return reject("auth.header value is required");
  }

  // ── Find spec ──
  const find = s.find as Record<string, unknown> | undefined;
  if (!find || typeof find !== "object") return reject("find spec is required");
  if (find.method && !["GET", "POST"].includes(find.method as string)) {
    return reject("find.method must be GET or POST");
  }
  if (typeof find.path !== "string" || !PATH_RE.test(find.path)) {
    return reject("find.path must start with /");
  }
  if (find.resultsPath && !RESULTS_PATH_RE.test(find.resultsPath as string)) {
    return reject("find.resultsPath contains invalid characters");
  }
  if (find.idPath && !RESULTS_PATH_RE.test(find.idPath as string)) {
    return reject("find.idPath contains invalid characters");
  }

  // ── Delete spec ──
  const del = s.delete as Record<string, unknown> | undefined;
  if (!del || typeof del !== "object") return reject("delete spec is required");
  if (del.method && !["DELETE", "POST", "PUT", "PATCH"].includes(del.method as string)) {
    return reject("delete.method must be DELETE, POST, PUT, or PATCH");
  }
  if (typeof del.path !== "string" || !del.path.startsWith("/")) {
    return reject("delete.path must start with /");
  }

  // ── Credential fields (must be non-empty strings) ──
  const credFields = (s.credentialFields as string[] | undefined) ?? [];
  if (!Array.isArray(credFields) || credFields.length === 0) {
    return reject("At least one credential field is required");
  }
  for (const f of credFields) {
    if (typeof f !== "string" || !IDENTIFIER_RE.test(f)) {
      return reject(`Invalid credential field name: ${f}`);
    }
  }

  // Build the validated spec
  const spec: HttpSpec = {
    key: `custom_${Date.now()}` as HttpSpec["key"],
    transport: "http",
    label: s.label as string,
    baseUrl: s.baseUrl as string,
    auth: auth as HttpSpec["auth"],
    headers: s.headers as Record<string, string> | undefined,
    find: {
      method: (find.method as "GET" | "POST") ?? "GET",
      path: find.path as string,
      query: find.query as Record<string, string> | undefined,
      body: find.body as Record<string, unknown> | undefined,
      resultsPath: (find.resultsPath as string) ?? "data",
      idPath: (find.idPath as string) ?? "id",
    },
    delete: {
      method: (del.method as "DELETE" | "POST" | "PUT" | "PATCH") ?? "DELETE",
      path: del.path as string,
      successStatuses: del.successStatuses as number[] | undefined,
      ignoreStatuses: del.ignoreStatuses as number[] | undefined,
      failStatuses: del.failStatuses as number[] | undefined,
      itemNoun: (del.itemNoun as string) ?? "record",
    },
  };

  return { valid: true, spec };
}
