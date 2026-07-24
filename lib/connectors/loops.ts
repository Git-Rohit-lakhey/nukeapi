import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, LoopsCredentials } from "@/types/connector";

const LOOPS_BASE = "https://app.loops.so";

export async function deleteLoops(
  email: string,
  creds: LoopsCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const res = await fetchWithRetry(`${LOOPS_BASE}/api/v1/contacts/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      return {
        integration: "loops",
        status: "success",
        message: `Requested deletion of Loops contact for ${email}`,
        durationMs: Date.now() - start,
      };
    }
    if (res.status === 404) {
      return {
        integration: "loops",
        status: "skipped",
        message: "No Loops contact matched that email",
        durationMs: Date.now() - start,
      };
    }

    const b = await parseJsonSafe(res);
    const msg = b?.message ?? `HTTP ${res.status}`;
    return {
      integration: "loops",
      status: "failed",
      message: "Loops deletion failed",
      error: msg,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "loops",
      status: "failed",
      message: "Loops deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
