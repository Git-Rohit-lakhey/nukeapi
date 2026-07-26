import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, OmnisendCredentials } from "@/types/connector";

const OMNISEND_BASE = "https://api.omnisend.com";

export async function deleteOmnisend(
  email: string,
  creds: OmnisendCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const searchRes = await fetchWithRetry(
      `${OMNISEND_BASE}/v3/contacts?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { "X-API-KEY": creds.api_key },
      },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "omnisend",
        status: "failed",
        message: "Omnisend lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const contacts: Array<{ id: string }> = search.contacts ?? [];
    if (contacts.length === 0) {
      return {
        integration: "omnisend",
        status: "skipped",
        message: "No Omnisend contact matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of contacts) {
      const delRes = await fetchWithRetry(
        `${OMNISEND_BASE}/v3/contacts/${encodeURIComponent(c.id)}`,
        {
          method: "DELETE",
          headers: { "X-API-KEY": creds.api_key },
        },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "omnisend",
          status: "failed",
          message: "Omnisend deletion failed",
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "omnisend",
      status: "success",
      message: `Deleted ${deleted} Omnisend contact(s) for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "omnisend",
      status: "failed",
      message: "Omnisend deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
