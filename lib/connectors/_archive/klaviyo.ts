import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, KlaviyoCredentials } from "@/types/connector";

const KLAVIYO_BASE = "https://a.klaviyo.com";

export async function deleteKlaviyo(
  email: string,
  creds: KlaviyoCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Klaviyo-API-Key ${creds.api_key}`,
    revision: "2024-10-15",
  };

  try {
    let deleted = 0;
    let nextUrl: string | undefined =
      `${KLAVIYO_BASE}/api/profiles/?filter=${encodeURIComponent(
        `equals(email,"${email}")`,
      )}&page[size]=100`;

    while (nextUrl) {
      const res = await fetchWithRetry(nextUrl, { method: "GET", headers });
      if (!res.ok) {
        const body = await parseJsonSafe(res);
        const msg = body?.detail ?? JSON.stringify(body).slice(0, 200);
        return {
          integration: "klaviyo",
          status: "failed",
          message: `Klaviyo API returned ${res.status}`,
          error: msg ?? `HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }
      const json = await parseJsonSafe(res);
      const profiles: Array<{ id: string }> = json.data ?? [];

      for (const p of profiles) {
        const delRes = await fetchWithRetry(`${KLAVIYO_BASE}/api/profiles/${p.id}/`, {
          method: "DELETE",
          headers,
        });
        if (delRes.status === 404) continue;
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          const m = b?.detail ?? `HTTP ${delRes.status}`;
          return {
            integration: "klaviyo",
            status: "failed",
            message: `Failed to delete Klaviyo profile ${p.id}`,
            error: m,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      nextUrl = json.links?.next ?? undefined;
    }

    if (deleted === 0) {
      return {
        integration: "klaviyo",
        status: "skipped",
        message: "No Klaviyo profiles matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "klaviyo",
      status: "success",
      message: `Deleted ${deleted} Klaviyo profile(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "klaviyo",
      status: "failed",
      message: "Klaviyo deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
