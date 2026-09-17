import crypto from "node:crypto";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";
import type { ConnectorResult, Integration } from "@/types/connector";
import type { ConnectorSpec, CustomSpec } from "../engine/types";

/**
 * HTTP_BATCH_4 — conversion of batch-4 connectors to declarative specs.
 *
 * Split rationale (faithful behavior preservation — see task rules):
 *
 *  ── HttpSpec (clean find → paginate → delete, single resultsPath) ──
 *    omnisend, beehiiv, customerio, helpscout
 *    Each has a list-by-email endpoint returning an array under one known
 *    path, and a per-id DELETE. Encoded exactly with auth/headers/statuses.
 *
 *  ── CustomSpec (find+delete CANNOT express the real behavior) ──
 *    brevo    — deletes directly by md5(lowercased email); no find/id loop.
 *    loops    — single POST /contacts/delete with {email}; no find step.
 *    linear   — GraphQL: delete is a mutation POST to the same endpoint,
 *               success decided by body field, not HTTP status.
 *    gorgias  — results array is `_embedded.customers ?? data` (engine has
 *               no `??` fallback for resultsPath).
 *    groove    — results array is `customers ?? data`.
 *    smartlook — results array is `data ?? visitors`.
 *
 *  The six CustomSpec run functions copy the original lib/connectors/*.ts
 *  logic verbatim (creds accessed as Record<string,string>, keyed by the
 *  field names in lib/connectors/meta.ts), preserving exact status codes,
 *  message strings, and error handling.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CustomSpec run functions (verbatim behavior, creds keyed by meta.ts names)
// ─────────────────────────────────────────────────────────────────────────────

async function runBrevo(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    // Brevo contact identifier is the MD5 of the lowercased email.
    const id = crypto.createHash("md5").update(email.toLowerCase()).digest("hex");

    const res = await fetchWithRetry(`https://api.brevo.com/v3/contacts/${id}`, {
      method: "DELETE",
      headers: { "api-key": creds.api_key },
    });

    if (res.status === 204) {
      return {
        integration: "brevo",
        status: "success",
        message: `Deleted Brevo contact for ${email}`,
        durationMs: Date.now() - start,
      };
    }
    if (res.status === 404) {
      return {
        integration: "brevo",
        status: "skipped",
        message: "No Brevo contact matched that email",
        durationMs: Date.now() - start,
      };
    }

    const b = await parseJsonSafe(res);
    const msg = (b as any)?.message ?? `HTTP ${res.status}`;
    return {
      integration: "brevo",
      status: "failed",
      message: "Brevo deletion failed",
      error: msg,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "brevo",
      status: "failed",
      message: "Brevo deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runLoops(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const res = await fetchWithRetry(`https://app.loops.so/api/v1/contacts/delete`, {
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
    const msg = (b as any)?.message ?? `HTTP ${res.status}`;
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

const LINEAR_GQL = "https://api.linear.app/graphql";

async function runLinear(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };
  const safeEmail = email.replace(/"/g, '\\"');

  try {
    // Find users matching the email.
    const findRes = await fetchWithRetry(LINEAR_GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `query { users(filter: { email: { eq: "${safeEmail}" } }) { nodes { id } } }`,
      }),
    });
    if (!findRes.ok) {
      const b = await parseJsonSafe(findRes);
      const msg = (b as any)?.errors?.[0]?.message ?? `HTTP ${findRes.status}`;
      return {
        integration: "linear",
        status: "failed",
        message: `Linear search returned ${findRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const found = await parseJsonSafe(findRes);
    const nodes: Array<{ id: string }> = (found as any)?.data?.users?.nodes ?? [];
    if (nodes.length === 0) {
      return {
        integration: "linear",
        status: "skipped",
        message: "No Linear users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const node of nodes) {
      const delRes = await fetchWithRetry(LINEAR_GQL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `mutation { userDelete(id: "${node.id}") { success } }`,
        }),
      });
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = (b as any)?.errors?.[0]?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "linear",
          status: "failed",
          message: `Linear deletion failed for ${node.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      const d = await parseJsonSafe(delRes);
      if ((d as any)?.data?.userDelete?.success) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "linear",
        status: "failed",
        message: "Linear users found but deletion did not succeed",
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "linear",
      status: "success",
      message: `Deleted ${deleted} Linear user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "linear",
      status: "failed",
      message: "Linear deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runGorgias(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Basic ${Buffer.from(creds.email + ":" + creds.api_key).toString("base64")}`,
  };
  const base = `https://${creds.domain}.gorgias.com/api`;

  try {
    const searchRes = await fetchWithRetry(
      `${base}/customers?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = (b as any)?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "gorgias",
        status: "failed",
        message: `Gorgias search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Gorgias returns either { _embedded: { customers: [...] } } or { data: [...] }.
    const customers: Array<{ id: number | string }> =
      (search as any)?._embedded?.customers ?? (search as any)?.data ?? [];
    if (customers.length === 0) {
      return {
        integration: "gorgias",
        status: "skipped",
        message: "No Gorgias customers matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `${base}/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = (b as any)?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "gorgias",
          status: "failed",
          message: `Gorgias deletion failed for ${c.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "gorgias",
      status: "success",
      message: `Deleted ${deleted} Gorgias customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "gorgias",
      status: "failed",
      message: "Gorgias deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runGroove(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.access_token}` };

  try {
    const searchRes = await fetchWithRetry(
      `https://api.groovehq.com/v1/customers?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = (b as any)?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "groove",
        status: "failed",
        message: `Groove search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Groove returns either { customers: [...] } or { data: [...] }.
    const customers: Array<{ id: number | string }> =
      (search as any)?.customers ?? (search as any)?.data ?? [];
    if (customers.length === 0) {
      return {
        integration: "groove",
        status: "skipped",
        message: "No Groove customers matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const c of customers) {
      const delRes = await fetchWithRetry(
        `https://api.groovehq.com/v1/customers/${c.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = (b as any)?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "groove",
          status: "failed",
          message: `Groove deletion failed for ${c.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "groove",
      status: "success",
      message: `Deleted ${deleted} Groove customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "groove",
      status: "failed",
      message: "Groove deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function runSmartlook(
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${creds.api_key}` };
  const wsBase = `https://api.smartlook.com/v1/workspaces/${creds.workspace_id}`;

  try {
    const searchRes = await fetchWithRetry(
      `${wsBase}/visitors?email=${encodeURIComponent(email)}`,
      { method: "GET", headers },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = (b as any)?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "smartlook",
        status: "failed",
        message: `Smartlook search returned ${searchRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    // Smartlook returns either { data: [...] } or { visitors: [...] }.
    const visitors: Array<{ id: string }> =
      (search as any)?.data ?? (search as any)?.visitors ?? [];
    if (visitors.length === 0) {
      return {
        integration: "smartlook",
        status: "skipped",
        message: "No Smartlook visitors matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const v of visitors) {
      const delRes = await fetchWithRetry(
        `${wsBase}/visitors/${v.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = (b as any)?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "smartlook",
          status: "failed",
          message: `Smartlook deletion failed for ${v.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "smartlook",
      status: "success",
      message: `Deleted ${deleted} Smartlook visitor(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "smartlook",
      status: "failed",
      message: "Smartlook deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch 4 spec array
// ─────────────────────────────────────────────────────────────────────────────

export const HTTP_BATCH_4: ConnectorSpec[] = [
  // ── HttpSpec: Omnisend ──
  {
    key: "omnisend",
    transport: "http",
    label: "Omnisend",
    baseUrl: "https://api.omnisend.com",
    auth: { type: "header", name: "X-API-KEY", value: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/v3/contacts",
      query: { email: "{email}" },
      resultsPath: "contacts",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/v3/contacts/{res.id}",
      // Original fails on ANY non-ok delete status; clear the default [404]
      // ignore so a 404 on a found id also fails-closed (Section 6.15).
      ignoreStatuses: [],
      itemNoun: "contact",
    },
  },

  // ── HttpSpec: Beehiiv ──
  {
    key: "beehiiv",
    transport: "http",
    label: "Beehiiv",
    baseUrl: "https://api.beehiiv.com",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/v2/publications/{cred.publication_id}/subscriptions",
      query: { email: "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/v2/publications/{cred.publication_id}/subscriptions/{res.id}",
      ignoreStatuses: [],
      itemNoun: "subscription",
    },
  },

  // ── HttpSpec: Customer.io ──
  {
    key: "customerio",
    transport: "http",
    label: "Customer.io",
    baseUrl: "https://api.customer.io",
    auth: { type: "basic", user: "{cred.site_id}", pass: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/v1/customers",
      query: { email: "{email}" },
      resultsPath: "results",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/v1/customers/{res.id}",
      ignoreStatuses: [],
      itemNoun: "customer",
    },
  },

  // ── HttpSpec: Help Scout ──
  {
    key: "helpscout",
    transport: "http",
    label: "Help Scout",
    baseUrl: "https://api.helpscout.net/v2",
    // Help Scout uses API-key Basic auth (api_key is username, password empty).
    auth: { type: "basic", user: "{cred.api_key}", pass: "" },
    find: {
      method: "GET",
      path: "/customers",
      query: { email: "{email}" },
      resultsPath: "_embedded.customers",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/customers/{res.id}",
      ignoreStatuses: [],
      itemNoun: "customer",
    },
  },

  // ── CustomSpec: Brevo (delete-by-md5, no find step) ──
  {
    key: "brevo",
    transport: "custom",
    label: "Brevo",
    run: runBrevo,
  } as CustomSpec,

  // ── CustomSpec: Loops (single POST delete-by-email, no find step) ──
  {
    key: "loops",
    transport: "custom",
    label: "Loops",
    run: runLoops,
  } as CustomSpec,

  // ── CustomSpec: Linear (GraphQL mutation delete) ──
  {
    key: "linear",
    transport: "custom",
    label: "Linear",
    run: runLinear,
  } as CustomSpec,

  // ── CustomSpec: Gorgias (resultsPath `??` fallback) ──
  {
    key: "gorgias",
    transport: "custom",
    label: "Gorgias",
    run: runGorgias,
  } as CustomSpec,

  // ── CustomSpec: Groove (resultsPath `??` fallback) ──
  {
    key: "groove",
    transport: "custom",
    label: "Groove",
    run: runGroove,
  } as CustomSpec,

  // ── CustomSpec: Smartlook (resultsPath `??` fallback) ──
  {
    key: "smartlook",
    transport: "custom",
    label: "Smartlook",
    run: runSmartlook,
  } as CustomSpec,
];
