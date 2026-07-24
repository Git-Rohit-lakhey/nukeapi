import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ChargebeeCredentials } from "@/types/connector";

/** Chargebee — find customers by email, then DELETE each. */
export async function deleteChargebee(
  email: string,
  creds: ChargebeeCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://${creds.site}.chargebee.com/api/v2`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:`).toString("base64")}`,
  };
  try {
    const res = await fetchWithRetry(
      `${base}/customers?email[is]=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "chargebee",
        status: "failed",
        message: `Chargebee returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const list: Array<{ customer?: { id: string } }> = json.list ?? [];
    const ids = list.map((x) => x.customer?.id).filter(Boolean) as string[];
    if (ids.length === 0) {
      return {
        integration: "chargebee",
        status: "skipped",
        message: "No Chargebee customer matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const id of ids) {
      const d = await fetchWithRetry(`${base}/customers/${id}`, {
        method: "DELETE",
        headers,
      });
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "chargebee",
        status: "failed",
        message: "Failed to delete any Chargebee customer",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "chargebee",
      status: "success",
      message: `Deleted ${deleted} Chargebee customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "chargebee",
      status: "failed",
      message: "Chargebee deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
