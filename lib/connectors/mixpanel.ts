import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, MixpanelCredentials } from "@/types/connector";

const MP_BASE = "https://mixpanel.com";

export async function deleteMixpanel(
  email: string,
  creds: MixpanelCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const basic = Buffer.from(`${creds.api_secret}:`).toString("base64");
  const headers = {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
  };

  try {
    // Find the user's $distinct_id(s) by the $email profile property.
    const searchUrl =
      `${MP_BASE}/api/2.0/engage/?project_id=${encodeURIComponent(creds.project_id)}` +
      `&where=${encodeURIComponent(JSON.stringify({ $email: email }))}`;
    const searchRes = await fetchWithRetry(searchUrl, { method: "GET", headers });
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.error ?? JSON.stringify(b).slice(0, 200) ?? `HTTP ${searchRes.status}`;
      return {
        integration: "mixpanel",
        status: "failed",
        message: `Mixpanel API returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const search = await parseJsonSafe(searchRes);
    const results: Array<{ $distinct_id?: string; distinct_id?: string }> =
      search.results ?? [];
    const ids = results
      .map((r) => r.$distinct_id ?? r.distinct_id)
      .filter((x): x is string => typeof x === "string");

    if (ids.length === 0) {
      return {
        integration: "mixpanel",
        status: "skipped",
        message: "No Mixpanel profiles matched that email",
        durationMs: Date.now() - start,
      };
    }

    // Delete each People profile by distinct_id.
    let deleted = 0;
    for (const id of ids) {
      const delRes = await fetchWithRetry(
        `${MP_BASE}/api/2.0/engage/?project_id=${encodeURIComponent(creds.project_id)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ $delete: "", $distinct_id: id }),
        },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const m = b?.error ?? `HTTP ${delRes.status}`;
        return {
          integration: "mixpanel",
          status: "failed",
          message: `Failed to delete Mixpanel profile ${id}`,
          error: m,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }
    return {
      integration: "mixpanel",
      status: "success",
      message: `Deleted ${deleted} Mixpanel profile(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "mixpanel",
      status: "failed",
      message: "Mixpanel deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
