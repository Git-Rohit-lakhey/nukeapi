import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, IntercomCredentials } from "@/types/connector";

const IC_BASE = "https://api.intercom.io";

export async function deleteIntercom(
  email: string,
  creds: IntercomCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Intercom-Version": "2.11",
    "Content-Type": "application/json",
  };

  try {
    let deleted = 0;
    let startingAfter: string | undefined;

    do {
      const res = await fetchWithRetry(`${IC_BASE}/contacts/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: { field: "email", operator: "=", value: email },
          pagination: { per_page: 100, starting_after: startingAfter },
        }),
      });

      if (!res.ok) {
        const body = await parseJsonSafe(res);
        return {
          integration: "intercom",
          status: "failed",
          message: `Intercom API returned ${res.status}`,
          error: body?.errors?.[0]?.message ?? `HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }

      const json = await parseJsonSafe(res);
      const contacts: Array<{ id: string }> = json.data ?? [];

      for (const c of contacts) {
        const delRes = await fetchWithRetry(`${IC_BASE}/contacts/${c.id}`, {
          method: "DELETE",
          headers,
        });
        if (delRes.status === 404) continue;
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          return {
            integration: "intercom",
            status: "failed",
            message: `Failed to delete Intercom contact ${c.id}`,
            error: b?.errors?.[0]?.message ?? `HTTP ${delRes.status}`,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      startingAfter = json.pages?.next?.starting_after;
    } while (startingAfter);

    if (deleted === 0) {
      return {
        integration: "intercom",
        status: "skipped",
        message: "No Intercom contacts matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "intercom",
      status: "success",
      message: `Deleted ${deleted} Intercom contact(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "intercom",
      status: "failed",
      message: "Intercom deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
