import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, PostHogCredentials } from "@/types/connector";

export async function deletePostHog(
  email: string,
  creds: PostHogCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = creds.host.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  try {
    let deleted = 0;
    let nextUrl: string | undefined =
      `${base}/api/projects/${creds.project_id}/persons/?email=${encodeURIComponent(
        email,
      )}&limit=100`;

    while (nextUrl) {
      const res = await fetchWithRetry(nextUrl, { method: "GET", headers });
      if (!res.ok) {
        const b = await parseJsonSafe(res);
        const msg = b?.detail ?? `HTTP ${res.status}`;
        return {
          integration: "posthog",
          status: "failed",
          message: `PostHog API returned ${res.status}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      const json = await parseJsonSafe(res);
      const persons: Array<{ id: number | string }> = json.results ?? [];

      for (const p of persons) {
        const delRes = await fetchWithRetry(
          `${base}/api/projects/${creds.project_id}/persons/${p.id}/`,
          { method: "DELETE", headers },
        );
        if (delRes.status === 404) continue;
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          const m = b?.detail ?? `HTTP ${delRes.status}`;
          return {
            integration: "posthog",
            status: "failed",
            message: `Failed to delete PostHog person ${p.id}`,
            error: m,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      nextUrl = json.next ?? undefined;
    }

    if (deleted === 0) {
      return {
        integration: "posthog",
        status: "skipped",
        message: "No PostHog persons matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "posthog",
      status: "success",
      message: `Deleted ${deleted} PostHog person(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "posthog",
      status: "failed",
      message: "PostHog deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
