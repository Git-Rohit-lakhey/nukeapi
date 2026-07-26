import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, PipedriveCredentials } from "@/types/connector";

/** Pipedrive — find persons by email, then DELETE each. */
export async function deletePipedrive(
  email: string,
  creds: PipedriveCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://${creds.company_domain}.pipedrive.com/api/v1`;
  try {
    const res = await fetchWithRetry(
      `${base}/persons/find?term=${encodeURIComponent(email)}&api_token=${creds.api_token}`,
      {},
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return {
        integration: "pipedrive",
        status: "failed",
        message: `Pipedrive returned ${res.status}`,
        error: b?.error ?? `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(res);
    const persons: Array<{ id: number | string }> = json.data ?? [];
    if (persons.length === 0) {
      return {
        integration: "pipedrive",
        status: "skipped",
        message: "No Pipedrive person matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const p of persons) {
      const d = await fetchWithRetry(
        `${base}/persons/${p.id}?api_token=${creds.api_token}`,
        { method: "DELETE" },
      );
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "pipedrive",
        status: "failed",
        message: "Failed to delete any Pipedrive person",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "pipedrive",
      status: "success",
      message: `Deleted ${deleted} Pipedrive person(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "pipedrive",
      status: "failed",
      message: "Pipedrive deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
