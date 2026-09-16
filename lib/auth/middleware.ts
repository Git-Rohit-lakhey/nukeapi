import "server-only";
import { authenticateApiKey } from "@/lib/auth/keys";
import type { AuthedApiKey } from "@/types/api";

/** Extract a Bearer token from an Authorization header. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Validate the API key on an incoming /api/v1/* request using the fast
 * indexed lookup. Returns the authenticated key, or null if missing/invalid.
 */
export async function authenticateRequest(
  req: Request,
): Promise<AuthedApiKey | null> {
  const token = getBearerToken(req);
  return authenticateApiKey(token);
}
