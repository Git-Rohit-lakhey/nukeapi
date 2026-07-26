import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, SmartlookCredentials } from "@/types/connector";

const SL_BASE = "https://api.smartlook.com/v1";

export async function deleteSmartlook(
  email: string,
  creds: SmartlookCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };
  const wsBase = `${SL_BASE}/workspaces/${creds.workspace_id}`;

  try {
    const searchRes = await fetchWithRetry(
      `${wsBase}/visitors?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "smartlook",
        status: "failed",
        message: `Smartlook search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Smartlook returns either { data: [...] } or { visitors: [...] }.
    const visitors: Array<{ id: string }> =
      search?.data ?? search?.visitors ?? [];
    if (visitors.length === 0) {
      return {
        integration: "smartlook",
        status: "skipped",
        message: "No Smartlook visitors matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const v of visitors) {
      const delRes = await fetchWithRetry(
        `${wsBase}/visitors/${v.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "smartlook",
          status: "failed",
          message: `Smartlook deletion failed for ${v.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "smartlook",
      status: "success",
      message: `Deleted ${deleted} Smartlook visitor(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "smartlook",
      status: "failed",
      message: "Smartlook deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
