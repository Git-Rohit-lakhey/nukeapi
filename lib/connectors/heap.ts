import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, HeapCredentials } from "@/types/connector";

/** Heap — GDPR data deletion by identity (email). */
export async function deleteHeap(
  email: string,
  creds: HeapCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry("https://heapanalytics.com/api/delete", {
      method: "POST",
      headers,
      body: JSON.stringify({ app_id: Number(creds.app_id), identity: email }),
    });
    if (res.status === 404) {
      return {
        integration: "heap",
        status: "skipped",
        message: "No Heap user matched that email",
        durationMs: Date.now() - start,
      };
    }
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "heap",
        status: "failed",
        message: `Heap returned ${res.status}`,
        error: b?.message ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "heap",
      status: "success",
      message: `Queued Heap deletion for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "heap",
      status: "failed",
      message: "Heap deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
