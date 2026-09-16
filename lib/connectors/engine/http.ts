import "server-only";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";
import type { ConnectorResult, Integration } from "@/types/connector";
import type { AuthSpec, ConnectorFn, HttpSpec, HttpFindSpec, HttpDeleteSpec } from "./types";
import { getPath, interpolate, interpRecord, makeCtx, type RunCtx } from "./interp";
import { failResult, okResult, skipResult, toArray } from "./util";

const DEFAULT_SUCCESS = [200, 204];
const DEFAULT_IGNORE = [404];
const DEFAULT_FAIL = [401, 403];

interface PageState {
  startingAfter?: string;
  startingAfterParam?: string;
  offset?: number;
  offsetParam?: string;
  cursorQuery?: string;
  cursorBody?: string;
  cursorParam?: string;
}

function buildAuthHeaders(auth: AuthSpec, ctx: RunCtx): Record<string, string> {
  switch (auth.type) {
    case "none":
      return {};
    case "bearer":
      return { Authorization: `Bearer ${interpolate(auth.token ?? "{cred.access_token}", ctx)}` };
    case "basic":
      return {
        Authorization: `Basic ${Buffer.from(
          `${interpolate(auth.user, ctx)}:${interpolate(auth.pass, ctx)}`,
        ).toString("base64")}`,
      };
    case "header":
      return { [auth.name]: interpolate(auth.value, ctx) };
  }
}

function buildFindUrl(base: string, spec: HttpFindSpec, ctx: RunCtx, state: PageState): string {
  const path = interpolate(spec.path, ctx);
  const query: Record<string, string> = {};
  if (spec.query) {
    for (const [k, v] of Object.entries(spec.query)) query[k] = interpolate(v, ctx);
  }
  if (state.startingAfter && state.startingAfterParam) {
    query[state.startingAfterParam] = state.startingAfter;
  }
  if (state.offset !== undefined && state.offsetParam) {
    query[state.offsetParam] = String(state.offset);
  }
  if (state.cursorQuery !== undefined && state.cursorParam) {
    query[state.cursorParam] = state.cursorQuery;
  }
  const qs = new URLSearchParams(query).toString();
  return base + path + (qs ? `?${qs}` : "");
}

function buildFindBody(spec: HttpFindSpec, ctx: RunCtx, state: PageState): string | undefined {
  if (!spec.body) return undefined;
  let body = typeof spec.body === "function" ? spec.body(ctx) : spec.body;
  if (body && state.cursorBody !== undefined && state.cursorParam) {
    body = { ...(body as Record<string, unknown>), [state.cursorParam]: state.cursorBody };
  }
  // Interpolate the serialized body so {email}/{cred.x} tokens inside JSON
  // values (POST search filters, etc.) are resolved.
  return body ? interpolate(JSON.stringify(body), ctx) : undefined;
}

/**
 * The universal REST connector. One declarative spec produces a fully
 * correct find → paginate → delete flow with:
 *   - hard timeouts + retry/backoff (via fetchWithRetry, Section 6.9)
 *   - response.ok checks before reading bodies (Section 6.10)
 *   - pagination through ALL matches (Section 6.11)
 *   - defensive fail-closed status semantics (Section 6.15)
 *   - consistent ConnectorResult shape
 */
export function httpConnector(spec: HttpSpec): ConnectorFn {
  const key = spec.key;
  const label = spec.label;

  return async function run(email: string, creds: Record<string, string>): Promise<ConnectorResult> {
    const start = Date.now();
    const ctx = makeCtx(email, creds);
    const base = interpolate(spec.baseUrl, ctx).replace(/\/$/, "");
    const headers: Record<string, string> = {
      ...buildAuthHeaders(spec.auth, ctx),
      ...interpRecord(spec.headers, ctx),
    };
    if (!headers["Content-Type"] && spec.find.method === "POST") {
      headers["Content-Type"] = "application/json";
    }

    // ── 1. FIND every matching resource (paginated) ──
    const items: any[] = [];
    let state: PageState = {};
    let done = false;
    for (let guard = 0; guard < 1000 && !done; guard++) {
      const url = buildFindUrl(base, spec.find, ctx, state);
      const res = await fetchWithRetry(url, {
        method: spec.find.method ?? "GET",
        headers,
        body: buildFindBody(spec.find, ctx, state),
      });

      // 6.10 / 6.15 — never treat an error body as "nothing found".
      if (!res.ok) {
        const body = await parseJsonSafe(res);
        const errMsg =
          body?.error?.message ?? body?.message ?? body?.detail ?? `HTTP ${res.status}`;
        return failResult(key, `${label} API returned ${res.status}`, start, errMsg);
      }

      const json = await parseJsonSafe(res);
      const pageItems = toArray(getPath(json, spec.find.resultsPath ?? "data"));
      items.push(...pageItems);

      const pag = spec.find.paginate;
      if (!pag) {
        done = true;
      } else if (pag.type === "fullPage") {
        if (pageItems.length < pag.pageSize) {
          done = true;
        } else {
          const last = pageItems[pageItems.length - 1];
          state = {
            startingAfter: String(getPath(last, pag.nextPath ?? "id")),
            startingAfterParam: pag.nextParam ?? "starting_after",
          };
        }
      } else if (pag.type === "offset") {
        const total = pag.totalPath ? Number(getPath(json, pag.totalPath)) : Number.POSITIVE_INFINITY;
        const nextOffset = (state.offset ?? 0) + pag.pageSize;
        state = { offset: nextOffset, offsetParam: pag.offsetParam ?? "offset" };
        if (pageItems.length === 0 || (Number.isFinite(total) && nextOffset >= total)) done = true;
      } else {
        const next = getPath(json, pag.nextPath);
        if (!next) {
          done = true;
        } else if (pag.type === "cursorQuery") {
          state = { cursorQuery: String(next), cursorParam: pag.param };
        } else {
          state = { cursorBody: String(next), cursorParam: pag.param };
        }
      }
    }

    if (items.length === 0) {
      return skipResult(key, `No ${label} records matched that email`, start);
    }

    // ── 2. DELETE every matched resource ──
    const del: HttpDeleteSpec = spec.delete;
    const success = del.successStatuses ?? DEFAULT_SUCCESS;
    const ignore = del.ignoreStatuses ?? DEFAULT_IGNORE;
    const hardFail = del.failStatuses ?? DEFAULT_FAIL;
    const continueOnOther = del.continueOnOther ?? false;
    const itemNoun = del.itemNoun ?? "record";
    let deleted = 0;

    for (const resItem of items) {
      const dctx: RunCtx = { ...ctx, res: resItem };
      let durl = base + interpolate(del.path, dctx);
      // Append delete query params if specified.
      if (del.query) {
        const dqs = new URLSearchParams();
        for (const [k, v] of Object.entries(del.query)) dqs.set(k, interpolate(v, dctx));
        const qs = dqs.toString();
        if (qs) durl += `?${qs}`;
      }
      const dbodyRaw = del.body
        ? typeof del.body === "function"
          ? del.body(dctx)
          : del.body
        : undefined;
      const dbody = dbodyRaw ? interpolate(JSON.stringify(dbodyRaw), dctx) : undefined;
      const dres = await fetchWithRetry(durl, {
        method: del.method ?? "DELETE",
        headers,
        body: dbody,
      });
      const st = dres.status;

      if (success.includes(st)) {
        deleted++;
        continue;
      }
      if (ignore.includes(st)) {
        continue; // 404 = not present here; keep checking others
      }
      const b = await parseJsonSafe(dres);
      const errMsg = b?.error?.message ?? b?.message ?? b?.detail ?? `HTTP ${st}`;
      if (hardFail.includes(st)) {
        return failResult(key, `${label} authentication failed`, start, errMsg);
      }
      if (continueOnOther) {
        continue; // tolerate this resource's non-fatal error, keep going
      }
      return failResult(key, `Failed to delete ${label} ${itemNoun}`, start, errMsg);
    }

    if (deleted === 0) {
      return skipResult(key, `No ${label} records matched that email`, start);
    }
    return okResult(
      key,
      `Deleted ${deleted} ${itemNoun}${deleted === 1 ? "" : "s"}`,
      start,
    );
  };
}
