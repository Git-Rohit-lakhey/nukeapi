import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, OutsetaCredentials } from "@/types/connector";

const OS_BASE = "https://api.outseta.com/v1";

/**
 * Outseta: CRM people are keyed by email. Look up by email and delete each
 * match by its `Uid`.
 */
export async function deleteOutseta(
  email: string,
  creds: OutsetaCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };

  try {
    const listRes = await fetchWithRetry(
      `${OS_BASE}/crm/people?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.message ?? b?.Detail ?? `HTTP ${listRes.status}`;
      return {
        integration: "outseta",
        status: "failed",
        message: "Outseta people lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const list = await parseJsonSafe(listRes);
    const people: Array<{ Uid?: string }> = list.items ?? [];
    if (people.length === 0) {
      return {
        integration: "outseta",
        status: "skipped",
        message: "No Outseta person matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const p of people) {
      if (!p.Uid) continue;
      const delRes = await fetchWithRetry(`${OS_BASE}/crm/people/${p.Uid}`, {
        method: "DELETE",
        headers,
      });
      if (delRes.ok) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "outseta",
        status: "skipped",
        message: "No Outseta person matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "outseta",
      status: "success",
      message: `Deleted ${deleted} Outseta person(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "outseta",
      status: "failed",
      message: "Outseta deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
