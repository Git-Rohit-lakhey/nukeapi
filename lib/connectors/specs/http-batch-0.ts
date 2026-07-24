import type { HttpSpec } from "../engine/types";

/**
 * REFERENCE HTTP SPECS — canonical examples for every other batch.
 *
 * These are hand-verified against the original implementations in
 * lib/connectors/*.ts. When converting another connector, mirror this shape:
 *   - baseUrl may interpolate credentials: "https://{cred.server_prefix}.api..."
 *   - auth: basic(user,pass) / bearer / header(name,value) / none
 *   - find: method + path + (query | body) + paginate + resultsPath + idPath
 *   - delete: method + path (uses {res.<idPath>} from the found resource)
 *             + successStatuses / ignoreStatuses / failStatuses / itemNoun
 *
 * Subagents: copy this file's style exactly. Read the source connector file
 * first; encode its REAL behavior, do not invent endpoints.
 */
export const HTTP_BATCH_0: HttpSpec[] = [
  // ── Stripe: GET customers by email, cursor via starting_after, DELETE each ──
  {
    key: "stripe",
    transport: "http",
    label: "Stripe",
    baseUrl: "https://api.stripe.com",
    auth: { type: "basic", user: "{cred.secret_key}", pass: "" },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    find: {
      method: "GET",
      path: "/v1/customers",
      query: { email: "{email}", limit: "100" },
      paginate: { type: "fullPage", pageSize: 100, nextParam: "starting_after", nextPath: "id" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/v1/customers/{res.id}",
      itemNoun: "customer",
    },
  },

  // ── Mailchimp: list all lists (offset paginated), delete member by md5(email) ──
  {
    key: "mailchimp",
    transport: "http",
    label: "Mailchimp",
    baseUrl: "https://{cred.server_prefix}.api.mailchimp.com/3.0",
    auth: { type: "basic", user: "anystring", pass: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/lists",
      query: { count: "100", offset: "0" },
      paginate: { type: "offset", pageSize: 100, offsetParam: "offset", totalPath: "total" },
      resultsPath: "lists",
      idPath: "id",
    },
    delete: {
      method: "POST",
      path: "/lists/{res.id}/members/{emailMd5}/actions/delete-permanent",
      // 204 = removed; 404 = not a member of this list (skip);
      // 401/403 = auth failure (hard fail); other statuses tolerated per-list.
      successStatuses: [204],
      ignoreStatuses: [404],
      failStatuses: [401, 403],
      continueOnOther: true,
      itemNoun: "subscriber",
    },
  },

  // ── HubSpot: POST contact search (cursor in body), DELETE each contact ──
  {
    key: "hubspot",
    transport: "http",
    label: "HubSpot",
    baseUrl: "https://api.hubapi.com",
    auth: { type: "bearer" },
    find: {
      method: "POST",
      path: "/crm/v3/objects/contacts/search",
      body: () => ({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: "{email}" }] }],
        limit: 100,
      }),
      paginate: { type: "cursorBody", param: "after", nextPath: "paging.next.after" },
      resultsPath: "results",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/crm/v3/objects/contacts/{res.id}",
      itemNoun: "contact",
    },
  },

  // ── Supabase (customer's own project): admin user search + DELETE ──
  {
    key: "supabase",
    transport: "http",
    label: "Supabase",
    baseUrl: "{cred.project_url}",
    auth: { type: "bearer" },
    headers: { apikey: "{cred.service_role_key}" },
    find: {
      method: "GET",
      path: "/auth/v1/admin/users",
      query: { email: "{email}" },
      resultsPath: "users",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/auth/v1/admin/users/{res.id}",
      itemNoun: "user",
    },
  },
];
