import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, HubSpotCredentials } from "@/types/connector";

const HS_BASE = "https://api.hubapi.com";

export async function deleteHubSpot(
  email: string,
  creds: HubSpotCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    let deleted = 0;
    let after: string | undefined;

    do {
      const res = await fetchWithRetry(`${HS_BASE}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filterGroups: [
            { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
          ],
          limit: 100,
          after: after ? Number(after) : undefined,
        }),
      });

      if (!res.ok) {
        const body = await parseJsonSafe(res);
        return {
          integration: "hubspot",
          status: "failed",
          message: `HubSpot API returned ${res.status}`,
          error: body?.message ?? `HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }

      const json = await parseJsonSafe(res);
      const contacts: Array<{ id: string }> = json.results ?? [];

      for (const c of contacts) {
        const delRes = await fetchWithRetry(
          `${HS_BASE}/crm/v3/objects/contacts/${c.id}`,
          { method: "DELETE", headers },
        );
        if (delRes.status === 404) continue; // already gone
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          return {
            integration: "hubspot",
            status: "failed",
            message: `Failed to delete HubSpot contact ${c.id}`,
            error: b?.message ?? `HTTP ${delRes.status}`,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      after = json.paging?.next?.after;
    } while (after);

    if (deleted === 0) {
      return {
        integration: "hubspot",
        status: "skipped",
        message: "No HubSpot contacts matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "hubspot",
      status: "success",
      message: `Deleted ${deleted} HubSpot contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "hubspot",
      status: "failed",
      message: "HubSpot deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
