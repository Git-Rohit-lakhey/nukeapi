import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, PendoCredentials } from "@/types/connector";

const PENDO_BASE = "https://app.pendo.io/api/v1";

export async function deletePendo(
  email: string,
  creds: PendoCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  // Pendo accepts the integration key as either a Basic auth header
  // (api_key as username, empty password) or via x-pendo-integration-key.
  // We use the x-pendo-integration-key header per the documented visitor API.
  const headers = { "x-pendo-integration-key": creds.api_key };

  try {
    // Find the visitor by email to obtain its id.
    const searchRes = await fetchWithRetry(
      `${PENDO_BASE}/visitor?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "pendo",
        status: "failed",
        message: `Pendo search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Pendo may return the visitor under various shapes; normalize to an id.
    const visitor: { id?: string } | undefined =
      search?.visitor ?? search?.data ?? (Array.isArray(search) ? search[0] : undefined);

    // NOTE: Pendo's exact visitor lookup response shape varies by account
    // configuration. We only proceed if a concrete visitor id was returned;
    // otherwise we report skipped rather than fabricating a deletion.
    const visitorId = visitor?.id;
    if (!visitorId) {
      return {
        integration: "pendo",
        status: "skipped",
        message: "No Pendo visitor matched that email",
        durationMs: Date.now() - start,
      };
    }

    // Delete the visitor by id.
    const delRes = await fetchWithRetry(
      `${PENDO_BASE}/visitor/${encodeURIComponent(visitorId)}/delete`,
      { method: "POST", headers },
    );
    if (!delRes.ok) {
      const b = await parseJsonSafe(delRes);
      const msg = b?.message ?? `HTTP ${delRes.status}`;
      return {
        integration: "pendo",
        status: "failed",
        message: `Pendo deletion failed for ${visitorId}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "pendo",
      status: "success",
      message: `Deleted 1 Pendo visitor`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "pendo",
      status: "failed",
      message: "Pendo deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
