import type { ConnectorSpec } from "../engine/types";
import type { ConnectorResult } from "@/types/connector";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";

/**
 * Batch 5 of declarative connector specs.
 *
 * Converted from the original hand-written implementations in
 * lib/connectors/<name>.ts. Endpoints, auth schemes, id fields, and
 * status semantics are copied verbatim from those sources.
 *
 * All but one of these are standard REST find→delete flows and are
 * expressed as HttpSpec. The single exception is Zuora, which performs
 * an OAuth client-credentials token-exchange pre-step before any
 * find/delete — a flow the generic engine cannot express (it supports
 * only a single find call + per-resource delete), so it is encoded as
 * a CustomSpec run function (source logic preserved verbatim).
 *
 * Fidelity notes (resolved ambiguities) are documented inline and in
 * the task hand-off report. In particular, several sources probe more
 * than one response shape (e.g. `results ?? users`); the engine
 * supports a single `resultsPath`, so the primary shape is encoded and
 * documented as a known (rarely-hit) fallback gap.
 */
export const HTTP_BATCH_5: ConnectorSpec[] = [
  // ── LogRocket: GET users by email, DELETE each ──
  {
    key: "logrocket",
    transport: "http",
    label: "LogRocket",
    baseUrl: "https://api.logrocket.com/v1",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/{cred.app_id}/users",
      query: { email: "{email}" },
      resultsPath: "results", // source also checks `users`; primary shape used
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/{cred.app_id}/users/{res.id}",
      itemNoun: "user",
    },
  },

  // ── Datadog: two static headers (API key + Application key), find→delete ──
  {
    key: "datadog",
    transport: "http",
    label: "Datadog",
    baseUrl: "https://api.datadoghq.com/api/v2",
    auth: { type: "none" },
    headers: {
      "DD-API-KEY": "{cred.api_key}",
      "DD-APPLICATION-KEY": "{cred.app_key}",
    },
    find: {
      method: "GET",
      path: "/users",
      query: { "filter[email]": "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/users/{res.id}",
      itemNoun: "user",
    },
  },

  // ── Pendo: GET visitor by email, POST delete by id ──
  {
    key: "pendo",
    transport: "http",
    label: "Pendo",
    baseUrl: "https://app.pendo.io/api/v1",
    auth: { type: "none" },
    headers: { "x-pendo-integration-key": "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/visitor",
      query: { email: "{email}" },
      resultsPath: "visitor", // source also checks `data` / array[0]; primary used
      idPath: "id",
    },
    delete: {
      method: "POST",
      path: "/visitor/{res.id}/delete",
      itemNoun: "visitor",
    },
  },

  // ── Lemon Squeezy: GET customers by email filter, DELETE each ──
  {
    key: "lemonsqueezy",
    transport: "http",
    label: "Lemon Squeezy",
    baseUrl: "https://api.lemonsqueezy.com/v1",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/customers",
      query: { "filter[email]": "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/customers/{res.id}",
      itemNoun: "customer",
    },
  },

  // ── Gumroad: GET customers by email, DELETE each ──
  {
    key: "gumroad",
    transport: "http",
    label: "Gumroad",
    baseUrl: "https://api.gumroad.com/v2",
    auth: { type: "bearer", token: "{cred.access_token}" },
    find: {
      method: "GET",
      path: "/customers.json",
      query: { email: "{email}" },
      resultsPath: "customers", // source also checks `results`; primary used
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/customers/{res.id}",
      itemNoun: "customer",
    },
  },

  // ── Twilio: Basic auth (account_sid:auth_token), Contacts keyed by email ──
  {
    key: "twilio",
    transport: "http",
    label: "Twilio",
    baseUrl: "https://api.twilio.com/2010-04-01",
    auth: { type: "basic", user: "{cred.account_sid}", pass: "{cred.auth_token}" },
    find: {
      method: "GET",
      path: "/Accounts/{cred.account_sid}/Contacts.json",
      query: { Email: "{email}" },
      resultsPath: "contacts", // source also checks `items`; primary used
      idPath: "sid", // Twilio Contact identifier is `sid`, not `id`
    },
    delete: {
      method: "DELETE",
      path: "/Accounts/{cred.account_sid}/Contacts/{res.sid}.json",
      itemNoun: "contact",
    },
  },

  // ── Vonage (nexmo): Basic auth (api_key:api_secret), users by email ──
  {
    key: "vonage",
    transport: "http",
    label: "Vonage",
    baseUrl: "https://api.nexmo.com",
    auth: { type: "basic", user: "{cred.api_key}", pass: "{cred.api_secret}" },
    find: {
      method: "GET",
      path: "/v2/users",
      query: { email: "{email}" },
      resultsPath: "_embedded.users",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/v2/users/{res.id}",
      itemNoun: "user",
    },
  },

  // ── Plivo: Basic auth (auth_id:auth_token), Customers by email ──
  {
    key: "plivo",
    transport: "http",
    label: "Plivo",
    baseUrl: "https://api.plivo.com/v1/Account",
    auth: { type: "basic", user: "{cred.auth_id}", pass: "{cred.auth_token}" },
    find: {
      method: "GET",
      path: "/{cred.auth_id}/Customers",
      query: { email: "{email}" },
      resultsPath: "customers", // source also checks `objects`; primary used
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/{cred.auth_id}/Customers/{res.id}",
      itemNoun: "customer",
    },
  },

  // ── Notion: bearer integration token + Notion-Version header; search→archive ──
  {
    key: "notion",
    transport: "http",
    label: "Notion",
    baseUrl: "https://api.notion.com",
    auth: { type: "bearer", token: "{cred.integration_token}" },
    headers: {
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    find: {
      method: "POST",
      path: "/v1/search",
      body: () => ({
        query: "{email}",
        filter: { property: "object", value: "page" },
      }),
      resultsPath: "results",
      idPath: "id",
    },
    delete: {
      method: "PATCH",
      path: "/v1/pages/{res.id}",
      body: { archived: true },
      successStatuses: [200], // Notion returns 200 on successful archive
      itemNoun: "page",
    },
  },

  // ── Zuora: OAuth client-credentials pre-step, then find accounts→delete ──
  // The generic engine supports only a single find + per-resource delete, so
  // the token exchange is preserved verbatim as a CustomSpec run function.
  {
    key: "zuora",
    transport: "custom",
    label: "Zuora",
    run: async function deleteZuora(
      email: string,
      creds: Record<string, string>,
    ): Promise<ConnectorResult> {
      const start = Date.now();
      const ZUORA_AUTH = "https://rest.zuora.com/oauth/token";
      const ZUORA_API = "https://rest.zuora.com/v1";

      try {
        // 1) Client-credentials grant.
        const tokenBody = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: creds["client_id"],
          client_secret: creds["client_secret"],
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
    },
  },
];
