import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { decryptJSON } from "@/lib/security/crypto";
import { validateCustomSpec } from "./validate";
import { httpConnector } from "@/lib/connectors/engine/http";
import type { ConnectorFn } from "@/lib/connectors/engine/types";
import type { Integration } from "@/types/connector";

/**
 * Load a user's active custom connectors and return them as ConnectorFn entries
 * keyed by `custom_<slug>`. The orchestrator merges these with the built-in
 * registry before running deletions.
 *
 * Security:
 *   - Encrypted spec + credentials decrypted server-side only
 *   - Spec re-validated before building (defense in depth)
 *   - Only active connectors are loaded
 *   - Result is scoped to a single user_id (no cross-user leakage)
 */
export async function loadCustomConnectors(
  userId: string,
): Promise<Record<string, ConnectorFn>> {
  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("custom_connectors")
    .select("id, slug, spec, credentials, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !rows || rows.length === 0) return {};

  const result: Record<string, ConnectorFn> = {};

  for (const row of rows) {
    try {
      // Decrypt spec
      const rawSpec = decryptJSON(row.spec);
      const specResult = validateCustomSpec(rawSpec);
      if (!specResult.valid) {
        console.warn(`[custom-connectors] Invalid spec for ${row.slug}: ${specResult.error}`);
        continue;
      }

      // Decrypt credentials
      const creds = decryptJSON<Record<string, string>>(row.credentials);

      // Override the key with the custom connector's slug
      const spec = { ...specResult.spec, key: `custom_${row.slug}` as Integration };

      // Build the connector function from the validated spec
      const fn = httpConnector(spec);

      // Wrap to inject decrypted credentials
      const wrappedFn: ConnectorFn = async (email: string) => {
        return fn(email, creds);
      };

      result[`custom_${row.slug}`] = wrappedFn;
    } catch (e) {
      console.error(`[custom-connectors] Failed to load ${row.slug}:`, e);
      // Never let one bad connector crash the others (Section 6.16)
    }
  }

  return result;
}
