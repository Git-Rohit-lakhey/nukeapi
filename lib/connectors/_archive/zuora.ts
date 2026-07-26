import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, ZuoraCredentials } from "@/types/connector";

const ZUORA_AUTH = "https://rest.zuora.com/oauth/token";
const ZUORA_API = "https://rest.zuora.com/v1";

export async function deleteZuora(
  email: string,
  creds: ZuoraCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();

  try {
    // 1) Client-credentials grant.
    const tokenBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    });
    const tokenRes = await fetchWithRetry(ZUORA_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    if (!tokenRes.ok) {
      const b = await parseJsonSafe(tokenRes);
      const msg = b?.error_description ?? b?.error ?? `HTTP ${tokenRes.status}`;
      return {
        integration: "zuora",
        status: "failed",
        message: "Zuora auth failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const tokenJson = await parseJsonSafe(tokenRes);
    const access_token: string | undefined = tokenJson?.access_token;
    if (!access_token) {
      return {
        integration: "zuora",
        status: "failed",
        message: "Zuora auth failed",
        error: "No access_token in token response",
        durationMs: Date.now() - start,
      };
    }

    const headers = { Authorization: `Bearer ${access_token}` };

    // 2) Find accounts by email.
    const searchRes = await fetchWithRetry(
      `${ZUORA_API}/accounts?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? b?.error ?? `HTTP ${searchRes.status}`;
      return {
        integration: "zuora",
        status: "failed",
        message: "Zuora account lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const search = await parseJsonSafe(searchRes);
    const accounts: Array<{ id: string | number }> =
      search?.accounts ?? search?.data ?? [];
    if (accounts.length === 0) {
      return {
        integration: "zuora",
        status: "skipped",
        message: `No Zuora accounts matched ${email}`,
        durationMs: Date.now() - start,
      };
    }

    // 3) Hard-delete each account.
    let deleted = 0;
    let lastErr: string | undefined;
    for (const a of accounts) {
      const delRes = await fetchWithRetry(
        `${ZUORA_API}/accounts/${a.id}?forceDelete=true`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        lastErr = b?.message ?? b?.error ?? `HTTP ${delRes.status}`;
        continue;
      }
      deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "zuora",
        status: "failed",
        message: "Failed to delete any Zuora account",
        error: lastErr,
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "zuora",
      status: "success",
      message: `Deleted ${deleted} Zuora account(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "zuora",
      status: "failed",
      message: "Zuora deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
