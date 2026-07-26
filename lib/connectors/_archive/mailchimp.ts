import crypto from "node:crypto";
import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, MailchimpCredentials } from "@/types/connector";

function md5Email(email: string): string {
  return crypto.createHash("md5").update(email.toLowerCase().trim()).digest("hex");
}

export async function deleteMailchimp(
  email: string,
  creds: MailchimpCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://${creds.server_prefix}.api.mailchimp.com/3.0`;
  const auth = "Basic " + Buffer.from(`anystring:${creds.api_key}`).toString("base64");
  const headers = { Authorization: auth };

  try {
    const hash = md5Email(email);
    let deleted = 0;
    let offset = 0;

    // 6.11 — paginate through ALL lists (an account can have >100 lists).
    do {
      const listsRes = await fetchWithRetry(
        `${base}/lists?count=100&offset=${offset}`,
        { method: "GET", headers },
      );
      if (!listsRes.ok) {
        const body = await parseJsonSafe(listsRes);
        return {
          integration: "mailchimp",
          status: "failed",
          message: `Mailchimp API returned ${listsRes.status}`,
          error: body?.detail ?? `HTTP ${listsRes.status}`,
          durationMs: Date.now() - start,
        };
      }
      const listsJson = await parseJsonSafe(listsRes);
      const lists: Array<{ id: string; name?: string }> = listsJson.lists ?? [];

      for (const list of lists) {
        const delRes = await fetchWithRetry(
          `${base}/lists/${list.id}/members/${hash}/actions/delete-permanent`,
          { method: "POST", headers },
        );
        // 204 = removed; 404 = not a member of this list (not an error).
        if (delRes.status === 204) {
          deleted++;
        } else if (delRes.status !== 404) {
          if (delRes.status === 401 || delRes.status === 403) {
            const b = await parseJsonSafe(delRes);
            return {
              integration: "mailchimp",
              status: "failed",
              message: "Mailchimp authentication failed",
              error: b?.detail ?? `HTTP ${delRes.status}`,
              durationMs: Date.now() - start,
            };
          }
          // Non-fatal for this list; keep checking the others.
        }
      }

      offset += 100;
      if (!listsJson.total || offset >= listsJson.total) break;
    } while (true);

    if (deleted === 0) {
      return {
        integration: "mailchimp",
        status: "skipped",
        message: "Email not found on any Mailchimp list",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "mailchimp",
      status: "success",
      message: `Deleted subscriber from ${deleted} Mailchimp list(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "mailchimp",
      status: "failed",
      message: "Mailchimp deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
