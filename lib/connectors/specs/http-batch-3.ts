import type { ConnectorSpec } from "../engine/types";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";

/**
 * HTTP_BATCH_3 — declarative specs for batch 3 connectors.
 *
 * Converted faithfully from the original implementations in
 * lib/connectors/<name>.ts. Behavior preserved exactly:
 *   - Source delete loops counted `status < 300 || status === 404` as a
 *     deletion. We encode that as successStatuses = [200..299, 404] with
 *     an explicit ignoreStatuses: [] (so 404 is counted, not silently
 *     skipped). workos is the exception: its source fails on ANY non-2xx
 *     (no 404-ignore), so it omits 404 from success and uses
 *     ignoreStatuses: [].
 *
 * Connectors that cannot be expressed as a single find+delete (Braintree's
 * SDK, Passage's `items ?? data` dual lookup, Keycloak's admin-token
 * exchange pre-step) are encoded as CustomSpec run functions that copy the
 * source logic verbatim, adapted to Record<string,string> creds.
 */

/** Every 2xx status (200–299), used as the success set for deletes. */
const HTTP_SUCCESS_2XX: number[] = Array.from({ length: 100 }, (_, i) => 200 + i);

export const HTTP_BATCH_3: ConnectorSpec[] = [
  // ── Recurly: GET /customers by email, DELETE each ──
  {
    key: "recurly",
    transport: "http",
    label: "Recurly",
    baseUrl: "https://v3.recurly.com",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/customers",
      query: { email: "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/customers/{res.id}",
      successStatuses: [...HTTP_SUCCESS_2XX, 404],
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "customer",
    },
  },

  // ── Pipedrive: GET /persons/find by email (token in query), DELETE each ──
  {
    key: "pipedrive",
    transport: "http",
    label: "Pipedrive",
    baseUrl: "https://{cred.company_domain}.pipedrive.com/api/v1",
    auth: { type: "none" },
    find: {
      method: "GET",
      path: "/persons/find",
      query: { term: "{email}", api_token: "{cred.api_token}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/persons/{res.id}",
      successStatuses: [...HTTP_SUCCESS_2XX, 404],
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "person",
    },
  },

  // ── Freshdesk: GET /contacts?email (Basic api_key:X), DELETE each ──
  {
    key: "freshdesk",
    transport: "http",
    label: "Freshdesk",
    baseUrl: "https://{cred.domain}.freshdesk.com/api/v2",
    auth: { type: "basic", user: "{cred.api_key}", pass: "X" },
    find: {
      method: "GET",
      path: "/contacts",
      query: { email: "{email}" },
      resultsPath: "",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/contacts/{res.id}",
      successStatuses: [...HTTP_SUCCESS_2XX, 404],
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "contact",
    },
  },

  // ── Crisp: GET /search/contacts?query (Basic identifier:api_key), DELETE each ──
  {
    key: "crisp",
    transport: "http",
    label: "Crisp",
    baseUrl: "https://api.crisp.chat/v1/{cred.website_id}",
    auth: { type: "basic", user: "{cred.api_identifier}", pass: "{cred.api_key}" },
    headers: { "Content-Type": "application/json" },
    find: {
      method: "GET",
      path: "/search/contacts",
      query: { query: "{email}" },
      resultsPath: "data.results",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/contacts/{res.id}",
      successStatuses: [...HTTP_SUCCESS_2XX, 404],
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "contact",
    },
  },

  // ── Okta: GET /api/v1/users?search= (SSWS header), DELETE each ──
  {
    key: "okta",
    transport: "http",
    label: "Okta",
    baseUrl: "https://{cred.domain}",
    auth: { type: "header", name: "Authorization", value: "SSWS {cred.api_token}" },
    find: {
      method: "GET",
      path: "/api/v1/users",
      query: { search: 'profile.email eq "{email}"' },
      resultsPath: "",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/api/v1/users/{res.id}",
      successStatuses: [...HTTP_SUCCESS_2XX, 404],
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "user",
    },
  },

  // ── Stytch: POST /v1/users/search (Basic secret:), DELETE each ──
  {
    key: "stytch",
    transport: "http",
    label: "Stytch",
    baseUrl: "https://api.stytch.com",
    auth: { type: "basic", user: "{cred.secret}", pass: "" },
    find: {
      method: "POST",
      path: "/v1/users/search",
      body: () => ({ query: "{email}", limit: 100 }),
      resultsPath: "results",
      idPath: "user_id",
    },
    delete: {
      method: "DELETE",
      path: "/v1/users/{res.user_id}",
      successStatuses: [...HTTP_SUCCESS_2XX, 404],
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "user",
    },
  },

  // ── WorkOS: GET /directory_users (Bearer), DELETE each; any non-2xx fails ──
  {
    key: "workos",
    transport: "http",
    label: "WorkOS",
    baseUrl: "https://api.workos.com",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/directory_users",
      query: { directory: "{cred.directory_id}", email: "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/directory_users/{res.id}",
      successStatuses: HTTP_SUCCESS_2XX,
      ignoreStatuses: [],
      failStatuses: [401, 403],
      itemNoun: "directory user",
    },
  },

  // ── Braintree: official SDK, not a simple REST endpoint — CustomSpec ──
  {
    key: "braintree",
    transport: "custom",
    label: "Braintree",
    run: async (email, creds) => {
      const start = Date.now();
      try {
        const braintree = await import("braintree");
        const gateway = new braintree.BraintreeGateway({
          merchantId: creds.merchant_id,
          publicKey: creds.api_key,
          privateKey: creds.private_key,
        });
        const search = await gateway.customer.search((s: any) => {
          s.email().is(email);
        });
        const ids: string[] = [];
        search.each((c: { id: string }) => ids.push(c.id));
        if (ids.length === 0) {
          return {
            integration: "braintree",
            status: "skipped",
            message: "No Braintree customer matched that email",
            durationMs: Date.now() - start,
          };
        }
        let deleted = 0;
        for (const id of ids) {
          const r = await gateway.customer.delete(id);
          if (r.success) deleted++;
        }
        if (deleted === 0) {
          return {
            integration: "braintree",
            status: "failed",
            message: "Failed to delete any Braintree customer",
            durationMs: Date.now() - start,
          };
        }
        return {
          integration: "braintree",
          status: "success",
          message: `Deleted ${deleted} Braintree customer(s)`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "braintree",
          status: "failed",
          message: "Braintree deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Passage: REST but find reads items ?? data (dual-path) — CustomSpec ──
  {
    key: "passage",
    transport: "custom",
    label: "Passage",
    run: async (email, creds) => {
      const start = Date.now();
      const base = "https://api.passage.id";
      const headers = { Authorization: `Bearer ${creds.api_key}` };
      try {
        const listRes = await fetchWithRetry(
          `${base}/v1/apps/${encodeURIComponent(creds.app_id)}/users?email=${encodeURIComponent(email)}`,
          { method: "GET", headers },
        );
        if (!listRes.ok) {
          const b = await parseJsonSafe(listRes);
          const msg = b?.message ?? `HTTP ${listRes.status}`;
          return {
            integration: "passage",
            status: "failed",
            message: `Passage lookup returned ${listRes.status}`,
            error: msg,
            durationMs: Date.now() - start,
          };
        }
        const list = await parseJsonSafe(listRes);
        const users: Array<{ id: string }> = list.items ?? list.data ?? [];
        if (users.length === 0) {
          return {
            integration: "passage",
            status: "skipped",
            message: "No Passage user matched that email",
            durationMs: Date.now() - start,
          };
        }
        let deleted = 0;
        for (const u of users) {
          const delRes = await fetchWithRetry(
            `${base}/v1/apps/${encodeURIComponent(creds.app_id)}/users/${encodeURIComponent(u.id)}`,
            { method: "DELETE", headers },
          );
          if (!delRes.ok) {
            const b = await parseJsonSafe(delRes);
            const msg = b?.message ?? `HTTP ${delRes.status}`;
            return {
              integration: "passage",
              status: "failed",
              message: `Passage deletion failed for user ${u.id}`,
              error: msg,
              durationMs: Date.now() - start,
            };
          }
          deleted += 1;
        }
        return {
          integration: "passage",
          status: "success",
          message: `Deleted ${deleted} Passage user(s)`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "passage",
          status: "failed",
          message: "Passage deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Keycloak: admin-token exchange pre-step, then find+delete — CustomSpec ──
  {
    key: "keycloak",
    transport: "custom",
    label: "Keycloak",
    run: async (email, creds) => {
      const start = Date.now();
      const base = creds.base_url.replace(/\/$/, "");
      try {
        // Step 1 — obtain an admin access token using the master realm.
        const tokenRes = await fetchWithRetry(
          `${base}/realms/master/protocol/openid-connect/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "password",
              client_id: "admin-cli",
              username: creds.admin_username,
              password: creds.admin_password,
            }).toString(),
          },
        );
        if (!tokenRes.ok) {
          const b = await parseJsonSafe(tokenRes);
          const msg = b?.error_description ?? b?.error ?? `HTTP ${tokenRes.status}`;
          return {
            integration: "keycloak",
            status: "failed",
            message: `Keycloak token request returned ${tokenRes.status}`,
            error: msg,
            durationMs: Date.now() - start,
          };
        }
        const token = await parseJsonSafe(tokenRes);
        const accessToken: string | undefined = token.access_token;
        if (!accessToken) {
          return {
            integration: "keycloak",
            status: "failed",
            message: "Keycloak token request returned no access_token",
            error: "missing access_token in response",
            durationMs: Date.now() - start,
          };
        }

        const authHeaders = { Authorization: `Bearer ${accessToken}` };

        // Step 2 — find users in the target realm matching the email.
        const listRes = await fetchWithRetry(
          `${base}/admin/realms/${encodeURIComponent(creds.realm)}/users?email=${encodeURIComponent(email)}`,
          { method: "GET", headers: authHeaders },
        );
        if (!listRes.ok) {
          const b = await parseJsonSafe(listRes);
          const msg = b?.errorMessage ?? b?.error ?? `HTTP ${listRes.status}`;
          return {
            integration: "keycloak",
            status: "failed",
            message: `Keycloak user lookup returned ${listRes.status}`,
            error: msg,
            durationMs: Date.now() - start,
          };
        }

        const users: Array<{ id: string }> = await parseJsonSafe(listRes);
        if (!Array.isArray(users) || users.length === 0) {
          return {
            integration: "keycloak",
            status: "skipped",
            message: "No Keycloak user matched that email",
            durationMs: Date.now() - start,
          };
        }

        // Step 3 — delete every matching user.
        let deleted = 0;
        for (const u of users) {
          const delRes = await fetchWithRetry(
            `${base}/admin/realms/${encodeURIComponent(creds.realm)}/users/${encodeURIComponent(u.id)}`,
            { method: "DELETE", headers: authHeaders },
          );
          if (!delRes.ok) {
            const b = await parseJsonSafe(delRes);
            const msg = b?.errorMessage ?? b?.error ?? `HTTP ${delRes.status}`;
            return {
              integration: "keycloak",
              status: "failed",
              message: `Keycloak deletion failed for user ${u.id}`,
              error: msg,
              durationMs: Date.now() - start,
            };
          }
          deleted += 1;
        }

        return {
          integration: "keycloak",
          status: "success",
          message: `Deleted ${deleted} Keycloak user(s)`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "keycloak",
          status: "failed",
          message: "Keycloak deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },
];
