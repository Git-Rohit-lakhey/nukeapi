import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, CrispCredentials } from "@/types/connector";

/** Crisp — search contacts by email, then DELETE each match. */
export async function deleteCrisp(
  email: string,
  creds: CrispCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://api.crisp.chat/v1/${creds.website_id}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_identifier}:${creds.api_key}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/search/contacts?query=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "crisp",
        status: "failed",
        message: `Crisp returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const results: Array<{ id?: string }> = json.data?.results ?? [];
    if (results.length === 0) {
      return {
        integration: "crisp",
        status: "skipped",
        message: "No Crisp contact matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const r of results) {
      if (!r.id) continue;
      const d = await fetchWithRetry(`${base}/contacts/${r.id}`, {
        method: "DELETE",
        headers,
      });
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "crisp",
        status: "failed",
        message: "Failed to delete any Crisp contact",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "crisp",
      status: "success",
      message: `Deleted ${deleted} Crisp contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "crisp",
      status: "failed",
      message: "Crisp deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
