import type { ConnectorSpec } from "../engine/types";
import type { ConnectorResult } from "@/types/connector";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";
import { okResult, skipResult, failResult } from "../engine/util";

/**
 * Batch 2 declarative connector specs — converted faithfully from the
 * original implementations in lib/connectors/<name>.ts.
 *
 *  - HttpSpec entries: convertkit, activecampaign, resend, paddle, chargebee.
 *    Each is a classic find-by-email + delete-by-id flow the universal engine
 *    already handles (Section 6.11 pagination, 6.10 ok-checks, 6.15 fail-closed).
 *  - CustomSpec entries: drip, amplitude, heap, june, fullstory. These cannot be
 *    expressed as a single find→delete: drip deletes by email with no find step;
 *    amplitude/heap/june are single POST "deletion request" calls with no
 *    delete-by-resource-id; fullstory's find returns a root array (the engine's
 *    resultsPath always resolves "data", so a root array would never match) and
 *    additionally filters matches by exact email. Their run() functions mirror
 *    the original logic verbatim, adapted to Record<string,string> creds.
 *
 * Auth notes preserved exactly:
 *  - convertkit / activecampaign: credentials ride as query params (api_secret /
 *    api_key), no auth header → auth: { type: "none" }.
 *  - resend / paddle: Bearer token = api_key.
 *  - chargebee: Basic auth with `api_key:` (empty pass), per the source.
 *  - CustomSpec connectors replicate their exact Basic/Bearer headers inline.
 */

// ── CustomSpec run functions (faithful ports of the originals) ──

/** Drip — single DELETE by email; 404 ⇒ skip, otherwise ok ⇒ success. */
const runDrip = async (
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> => {
  const start = Date.now();
  const base = `https://api.getdrip.com/v2/${creds.account_id}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetchWithRetry(
      `${base}/subscribers/${encodeURIComponent(email)}`,
      { method: "DELETE", headers },
    );
    if (res.status === 404) {
      return skipResult("drip", "No Drip subscriber matched that email", start);
    }
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return failResult("drip", `Drip returned ${res.status}`, start, b?.message ?? `HTTP ${res.status}`);
    }
    return okResult("drip", "Deleted Drip subscriber", start);
  } catch (e) {
    return failResult("drip", "Drip deletion failed", start, (e as Error).message);
  }
};

/** Amplitude — GDPR deletion request POST (queued, no per-resource delete). */
const runAmplitude = async (
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> => {
  const start = Date.now();
  const base = "https://amplitude.com/api/2";
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:${creds.api_secret}`).toString("base64")}`,
    "Content-Type": "application/json",
  }
  try {
    const res = await fetchWithRetry(`${base}/deletions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        api_key: creds.api_key,
        api_secret: creds.api_secret,
        user_ids: [email],
        user_property: "email",
        property_value: email,
        delete_children: true,
      }),
    });
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return failResult(
        "amplitude",
        `Amplitude deletion API returned ${res.status}`,
        start,
        b?.message ?? `HTTP ${res.status}`,
      );
    }
    return okResult("amplitude", `Queued Amplitude deletion for ${email}`, start);
  } catch (e) {
    return failResult("amplitude", "Amplitude deletion failed", start, (e as Error).message);
  }
};

/** Heap — GDPR deletion POST by identity (email). */
const runHeap = async (
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> => {
  const start = Date.now();
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.api_key}:`).toString("base64")}`,
    "Content-Type": "application/json",
  }
  try {
    const res = await fetchWithRetry("https://heapanalytics.com/api/delete", {
      method: "POST",
      headers,
      body: JSON.stringify({ app_id: Number(creds.app_id), identity: email }),
    });
    if (res.status === 404) {
      return skipResult("heap", "No Heap user matched that email", start);
    }
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return failResult("heap", `Heap returned ${res.status}`, start, b?.message ?? `HTTP ${res.status}`);
    }
    return okResult("heap", `Queued Heap deletion for ${email}`, start);
  } catch (e) {
    return failResult("heap", "Heap deletion failed", start, (e as Error).message);
  }
};

/** June — "forget" POST by user_id (email). */
const runJune = async (
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> => {
  const start = Date.now();
  const base = "https://api.june.so/api/v1";
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  }
  const body: Record<string, unknown> = { user_id: email };
  if (creds.workspace_id) body.workspace_id = creds.workspace_id;
  try {
    const res = await fetchWithRetry(`${base}/forget`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return failResult("june", `June returned ${res.status}`, start, b?.message ?? `HTTP ${res.status}`);
    }
    return okResult("june", `Queued June forget request for ${email}`, start);
  } catch (e) {
    return failResult("june", "June deletion failed", start, (e as Error).message);
  }
};

/** FullStory — find users (root array or {users}), filter by exact email, delete each by uid. */
const runFullStory = async (
  email: string,
  creds: Record<string, string>,
): Promise<ConnectorResult> => {
  const start = Date.now();
  const base = "https://api.fullstory.com";
  const headers = {
    Authorization: `Basic ${Buffer.from(`${creds.org_id}:${creds.api_key}`).toString("base64")}`,
    "Content-Type": "application/json",
  }
  try {
    const res = await fetchWithRetry(
      `${base}/users/v2?email=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res.ok) {
      const b = await parseJsonSafe(res);
      return failResult("fullstory", `FullStory returned ${res.status}`, start, b?.message ?? `HTTP ${res.status}`);
    }
    const json = await parseJsonSafe(res);
    const arr: Array<{ uid?: string; email?: string }> = Array.isArray(json)
      ? json
      : json.users ?? [];
    const matches = arr.filter((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matches.length === 0) {
      return skipResult("fullstory", "No FullStory user matched that email", start);
    }
    let deleted = 0;
    for (const u of matches) {
      if (!u.uid) continue;
      const d = await fetchWithRetry(
        `${base}/users/v2/${encodeURIComponent(u.uid)}`,
        { method: "DELETE", headers },
      );
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return failResult("fullstory", "Failed to delete any FullStory user", start);
    }
    return okResult("fullstory", `Deleted ${deleted} FullStory user(s)`, start);
  } catch (e) {
    return failResult("fullstory", "FullStory deletion failed", start, (e as Error).message);
  }
};

// ── Spec array ──

export const HTTP_BATCH_2: ConnectorSpec[] = [
  // ── ConvertKit: GET subscribers by email (api_secret as query), DELETE each ──
  {
    key: "convertkit",
    transport: "http",
    label: "ConvertKit",
    baseUrl: "https://api.convertkit.com/v3",
    auth: { type: "none" },
    find: {
      method: "GET",
      path: "/subscribers",
      query: { api_secret: "{cred.api_secret}", email: "{email}" },
      resultsPath: "subscribers",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/subscribers/{res.id}?api_secret={cred.api_secret}",
      // Source: `if (d.ok) deleted++` → any 2xx counts. No 404 special-casing
      // in the source, so ignoreStatuses is empty (404 would be a hard fail).
      successStatuses: [200, 201, 202, 203, 204],
      ignoreStatuses: [],
      itemNoun: "subscriber",
    },
  },

  // ── ActiveCampaign: GET contacts by email (api_key as query), DELETE each ──
  {
    key: "activecampaign",
    transport: "http",
    label: "ActiveCampaign",
    baseUrl: "https://{cred.account}.api-us1.com/api/3",
    auth: { type: "none" },
    find: {
      method: "GET",
      path: "/contacts",
      query: { email: "{email}", api_key: "{cred.api_key}" },
      resultsPath: "contacts",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/contacts/{res.id}?api_key={cred.api_key}",
      successStatuses: [200, 201, 202, 203, 204],
      ignoreStatuses: [],
      itemNoun: "contact",
    },
  },

  // ── Resend: GET audience contacts by email, DELETE each match ──
  {
    key: "resend",
    transport: "http",
    label: "Resend",
    baseUrl: "https://api.resend.com",
    auth: { type: "bearer", token: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/audiences/{cred.audience_id}/contacts",
      query: { email: "{email}" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: {
      method: "DELETE",
      path: "/audiences/{cred.audience_id}/contacts/{res.id}",
      // Source: `if (d.status < 300 || d.status === 404) deleted++` → 404 is
      // treated as successfully removed, so fold it into successStatuses.
      successStatuses: [200, 201, 202, 203, 204, 404],
      ignoreStatuses: [],
      itemNoun: "contact",
    },
  },

  // ── Paddle: GET customers by email, DELETE each ──
  {
    key: "paddle",
    transport: "http",
    label: "Paddle",
    baseUrl: "https://api.paddle.com",
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
      successStatuses: [200, 201, 202, 203, 204, 404],
      ignoreStatuses: [],
      itemNoun: "customer",
    },
  },

  // ── Chargebee: GET customers by email[is], DELETE each (id nested in customer) ──
  {
    key: "chargebee",
    transport: "http",
    label: "Chargebee",
    baseUrl: "https://{cred.site}.chargebee.com/api/v2",
    auth: { type: "basic", user: "{cred.api_key}", pass: "" },
    find: {
      method: "GET",
      path: "/customers",
      query: { "email[is]": "{email}" },
      resultsPath: "list",
      idPath: "customer.id",
    },
    delete: {
      method: "DELETE",
      path: "/customers/{res.customer.id}",
      successStatuses: [200, 201, 202, 203, 204, 404],
      ignoreStatuses: [],
      itemNoun: "customer",
    },
  },

  // ── Drip: single DELETE by email (no find step) ──
  {
    key: "drip",
    transport: "custom",
    label: "Drip",
    run: runDrip,
  },

  // ── Amplitude: single deletion-request POST (no per-resource delete) ──
  {
    key: "amplitude",
    transport: "custom",
    label: "Amplitude",
    run: runAmplitude,
  },

  // ── Heap: single deletion POST by identity ──
  {
    key: "heap",
    transport: "custom",
    label: "Heap",
    run: runHeap,
  },

  // ── June: single "forget" POST by user_id ──
  {
    key: "june",
    transport: "custom",
    label: "June",
    run: runJune,
  },

  // ── FullStory: root-array find + exact-email filter + delete by uid ──
  {
    key: "fullstory",
    transport: "custom",
    label: "FullStory",
    run: runFullStory,
  },
];
