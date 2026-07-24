import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ConvertKitCredentials } from "@/types/connector";

/** ConvertKit — find subscriber by email, then DELETE. */
export async function deleteConvertKit(
  email: string,
  creds: ConvertKitCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = "https://api.convertkit.com/v3";
  try {
    const res = await fetchWithRetry(
      `${base}/subscribers?api_secret=${creds.api_secret}&email=${encodeURIComponent(email)}`,
      {},
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "convertkit",
        status: "failed",
        message: `ConvertKit returned ${res.status}`,
        error: b?.error ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const subs: Array<{ id: number | string }> = json.subscribers ?? [];
    if (subs.length === 0) {
      return {
        integration: "convertkit",
        status: "skipped",
        message: "No ConvertKit subscriber matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const s of subs) {
      const d = await fetchWithRetry(
        `${base}/subscribers/${s.id}?api_secret=${creds.api_secret}`,
        { method: "DELETE" },
      );
      if (d.ok) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "convertkit",
        status: "failed",
        message: "Failed to delete any ConvertKit subscriber",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "convertkit",
      status: "success",
      message: `Deleted ${deleted} ConvertKit subscriber(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "convertkit",
      status: "failed",
      message: "ConvertKit deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
