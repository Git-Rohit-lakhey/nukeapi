import type { ConnectorResult, Integration } from "@/types/connector";

/**
 * A connector is, at runtime, just this function. The universal engine turns a
 * declarative `ConnectorSpec` into one of these. The orchestrator and every
 * route only ever see this contract — they never care how a connector is
 * implemented.
 */
export type ConnectorFn = (
  email: string,
  creds: Record<string, string>,
) => Promise<ConnectorResult>;

/** A string that may contain {token} / b64(...) interpolation. */
export type Template = string;

/**
 * Auth scheme for HTTP connectors. Resolved against the run context so secret
 * material is interpolated from credentials, never hardcoded.
 *  - none:    no auth
 *  - bearer:  Authorization: Bearer <token>   (default token = {cred.access_token})
 *  - basic:   Authorization: Basic base64(user:pass)
 *  - header:  arbitrary header (e.g. Supabase's dual apikey/Authorization)
 */
export type AuthSpec =
  | { type: "none" }
  | { type: "bearer"; token?: Template }
  | { type: "basic"; user: Template; pass: Template }
  | { type: "header"; name: string; value: Template };

/**
 * Pagination strategies for the find step (Section 6.11 — paginate through ALL
 * matches, never just the first page).
 *  - fullPage:    stop when a page returns fewer than pageSize (e.g. Stripe
 *                 cursor via `starting_after` = last item id)
 *  - offset:      increment an offset query param; stop at `total`
 *  - cursorQuery: read a cursor from the response, send it as a query param
 *  - cursorBody:  read a cursor from the response, send it as a body field
 */
export type PaginationSpec =
  | { type: "fullPage"; pageSize: number; nextParam?: string; nextPath?: string }
  | { type: "offset"; pageSize: number; offsetParam?: string; totalPath?: string }
  | { type: "cursorQuery"; param: string; nextPath: string }
  | { type: "cursorBody"; param: string; nextPath: string };

export interface HttpFindSpec {
  method?: "GET" | "POST";
  /** Path appended to baseUrl. Supports {email}, {cred.x}, {res.x}. */
  path: Template;
  /** Query-string params (interpolated + URL-encoded). */
  query?: Record<string, Template>;
  /** POST body (interpolated if a function). */
  body?: Record<string, unknown> | ((ctx: any) => unknown);
  paginate?: PaginationSpec;
  /** Dotted path to the array of resource items in the response. Default "data". */
  resultsPath?: string;
  /** Dotted path to the resource id within an item. Default "id". */
  idPath?: string;
  /** Dotted path to the total count (offset pagination). */
  totalPath?: string;
}

export interface HttpDeleteSpec {
  method?: "DELETE" | "POST" | "PUT" | "PATCH";
  /** Path appended to baseUrl. Supports {res.<field>} from the found resource. */
  path: Template;
  /** Optional query-string params on the delete call (interpolated + encoded). */
  query?: Record<string, Template>;
  body?: Record<string, unknown> | ((ctx: any) => unknown);
  /** Statuses that count as "deleted". Default [200, 204]. */
  successStatuses?: number[];
  /** Statuses that count as "nothing here" (skip, keep going). Default [404]. */
  ignoreStatuses?: number[];
  /** Statuses that hard-fail the whole connector (e.g. auth). Default [401, 403]. */
  failStatuses?: number[];
  /**
   * If true, a status that is neither success/ignore/fail is tolerated and the
   * loop continues to the next resource (Mailchimp tolerates a per-list error
   * and keeps checking the others). Default false = fail-closed (Section 6.15).
   */
  continueOnOther?: boolean;
  /** Noun used in the success message, e.g. "customer(s)", "contact(s)". */
  itemNoun?: string;
}

export interface HttpSpec {
  key: Integration;
  transport: "http";
  label: string;
  /** Base URL; supports {cred.field} (e.g. Mailchimp host, Supabase project). */
  baseUrl: Template;
  auth: AuthSpec;
  /** Headers applied to BOTH find and delete requests. */
  headers?: Record<string, Template>;
  find: HttpFindSpec;
  delete: HttpDeleteSpec;
}

export interface SqlSpec {
  key: Integration;
  transport: "sql";
  label: string;
  driver: "pg" | "mysql" | "libsql";
  connectionStringField: string;
  /** For libsql (Turso) — the auth token credential field. */
  authTokenField?: string;
  tableField: string;
  columnField: string;
  /** SQL placeholder style. Default "$1" (pg). MySQL/PlanetScale use "?". */
  placeholder?: "$1" | "?";
  /** Human label for the table in messages. Default "rows". */
  itemNoun?: string;
}

export interface CustomSpec {
  key: Integration;
  transport: "custom";
  label: string;
  /** Escape hatch for non-HTTP / driver-based connectors (Mongo, S3, Redis...). */
  run: ConnectorFn;
}

export type ConnectorSpec = HttpSpec | SqlSpec | CustomSpec;
