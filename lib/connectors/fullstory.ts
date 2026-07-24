import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, FullStoryCredentials } from "@/types/connector";

/** FullStory — find users by email, then DELETE each by uid. */
export async function deleteFullStory(
  email: string,
  creds: FullStoryCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://api.fullstory.com";
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.org_id}:${creds.api_key}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/users/v2?email=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "fullstory",
        status: "failed",
        message: `FullStory returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const arr: Array<{ uid?: string; email?: string }> = Array.isArray(json)
      ? json
      : json.users ?? [];
    const matches = arr.filter((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matches.length === 0) {
      return {
        integration: "fullstory",
        status: "skipped",
        message: "No FullStory user matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const u of matches) {
      if (!u.uid) continue;
      const d = await fetchWithRetry(
        `${base}/users/v2/${encodeURIComponent(u.uid)}`,
        { method: "DELETE", headers },
      );
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "fullstory",
        status: "failed",
        message: "Failed to delete any FullStory user",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "fullstory",
      status: "success",
      message: `Deleted ${deleted} FullStory user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "fullstory",
      status: "failed",
      message: "FullStory deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
