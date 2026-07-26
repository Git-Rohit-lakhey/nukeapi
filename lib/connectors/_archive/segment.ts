import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, SegmentCredentials } from "@/types/connector";

const SEGMENT_BASE = "https://platform.segmentapis.com";

export async function deleteSegment(
  email: string,
  creds: SegmentCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const url = `${SEGMENT_BASE}/v1beta/workspaces/${encodeURIComponent(
    creds.workspace,
  )}/users/delete`;
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    // Segment's Regulation API deletes by user_id (no server-side email
    // lookup exists), so the email is used as the user_id — the common pattern
    // when the external id equals the email. This is the real deletion call.
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: email }),
    });
    if (!res.ok) {
      const body = await parseJsonSafe(res);
      const msg = body?.message ?? JSON.stringify(body).slice(0, 200);
      return {
        integration: "segment",
        status: "failed",
        message: `Segment API returned ${res.status}`,
        error: msg ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "segment",
      status: "success",
      message: `Queued deletion for Segment user "${email}"`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "segment",
      status: "failed",
      message: "Segment deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
