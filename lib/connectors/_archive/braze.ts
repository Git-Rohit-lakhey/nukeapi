import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, BrazeCredentials } from "@/types/connector";

/**
 * Braze: there is no direct "delete by email" call. We export the user to
 * resolve their external_id, then issue a user delete for each resolved id.
 * If the export yields no external_id, report skipped honestly.
 */
export async function deleteBraze(
  email: string,
  creds: BrazeCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };
  const instanceUrl = creds.instance_url.replace(/\/$/, "");

  try {
    const exportRes = await fetchWithRetry(
      `${instanceUrl}/users/export/segment?fields_to_export[]=external_id&email_address=${encodeURIComponent(email)}`,
      { method: "POST", headers },
    );
    if (!exportRes.ok) {
      const b = await parseJsonSafe(exportRes);
      const msg = b?.message ?? `HTTP ${exportRes.status}`;
      return {
        integration: "braze",
        status: "failed",
        message: "Braze user export failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const exportBody = await parseJsonSafe(exportRes);
    const externalIds: string[] = Array.isArray(exportBody?.external_ids)
      ? exportBody.external_ids
      : ((exportBody?.users ?? [])
          .map((u: { external_id?: string }) => u.external_id)
          .filter(Boolean) as string[]);

    if (externalIds.length === 0) {
      return {
        integration: "braze",
        status: "skipped",
        message: "No Braze user matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    const failedIds: string[] = [];
    for (const externalId of externalIds) {
      const delRes = await fetchWithRetry(`${instanceUrl}/users/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ external_ids: [externalId] }),
      });
      if (delRes.ok) deleted++;
      else {
        const b = await parseJsonSafe(delRes);
        failedIds.push(`${externalId}: ${b?.message ?? delRes.status}`);
      }
    }

    if (deleted === 0) {
      return {
        integration: "braze",
        status: "failed",
        message: "Braze deletion failed",
        error: failedIds.join("; "),
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "braze",
      status: "success",
      message: `Requested deletion of ${deleted} Braze user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "braze",
      status: "failed",
      message: "Braze deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
