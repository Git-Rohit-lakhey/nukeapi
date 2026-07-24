import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, BeehiivCredentials } from "@/types/connector";

const BEEHIIV_BASE = "https://api.beehiiv.com";

export async function deleteBeehiiv(
  email: string,
  creds: BeehiivCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const searchRes = await fetchWithRetry(
      `${BEEHIIV_BASE}/v2/publications/${encodeURIComponent(
        creds.publication_id,
      )}/subscriptions?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${creds.api_key}` },
      },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "beehiiv",
        status: "failed",
        message: "beehiiv lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const subs: Array<{ id: string }> = search.data ?? [];
    if (subs.length === 0) {
      return {
        integration: "beehiiv",
        status: "skipped",
        message: "No beehiiv subscription matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const sub of subs) {
      const delRes = await fetchWithRetry(
        `${BEEHIIV_BASE}/v2/publications/${encodeURIComponent(
          creds.publication_id,
        )}/subscriptions/${encodeURIComponent(sub.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${creds.api_key}` },
        },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "beehiiv",
          status: "failed",
          message: "beehiiv deletion failed",
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "beehiiv",
      status: "success",
      message: `Deleted ${deleted} beehiiv subscription(s) for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "beehiiv",
      status: "failed",
      message: "beehiiv deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
