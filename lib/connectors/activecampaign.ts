import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ActiveCampaignCredentials } from "@/types/connector";

/** ActiveCampaign — find contact by email, then DELETE. */
export async function deleteActiveCampaign(
  email: string,
  creds: ActiveCampaignCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://${creds.account}.api-us1.com/api/3`;
  try {
    const res = await fetchWithRetry(
      `${base}/contacts?email=${encodeURIComponent(email)}&api_key=${creds.api_key}`,
      {},
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "activecampaign",
        status: "failed",
        message: `ActiveCampaign returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const contacts: Array<{ id: number | string }> = json.contacts ?? [];
    if (contacts.length === 0) {
      return {
        integration: "activecampaign",
        status: "skipped",
        message: "No ActiveCampaign contact matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const c of contacts) {
      const d = await fetchWithRetry(
        `${base}/contacts/${c.id}?api_key=${creds.api_key}`,
        { method: "DELETE" },
      );
      if (d.ok) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "activecampaign",
        status: "failed",
        message: "Failed to delete any ActiveCampaign contact",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "activecampaign",
      status: "success",
      message: `Deleted ${deleted} ActiveCampaign contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "activecampaign",
      status: "failed",
      message: "ActiveCampaign deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
