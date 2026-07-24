import type { DeleteUserResponse, GetRequestResponse, SystemStatusResponse } from "./types.js";
export interface NukeAPIClientOptions {
    /** API key, e.g. `nk_live_xxxxx` or `nk_test_xxxxx`. */
    apiKey: string;
    /** Defaults to `https://app.nukeapi.com`. Use `http://localhost:3000` in dev. */
    baseUrl?: string;
    /** Per-request timeout in ms (default 10000). */
    timeoutMs?: number;
    /** Max retries on network errors / 429 / 5xx (default 2). */
    maxRetries?: number;
    /** Inject a custom `fetch` (useful for tests / older runtimes). */
    fetch?: typeof fetch;
}
/**
 * Low-level HTTP client for the NukeAPI REST surface.
 *
 * - Sets the `Authorization: Bearer <apiKey>` header when `requiresAuth`.
 * - Uses the global `fetch` (Node 18+ / browsers).
 * - Retries on network errors, HTTP 429, and 5xx with exponential
 *   backoff (2 retries by default), honoring `Retry-After`.
 * - Throws `NukeAPIError` for any non-2xx response, surfacing the
 *   API's `error.code` / `error.message` honestly (never pretends
 *   success when the server reported failure).
 */
export declare class NukeAPIClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly fetchImpl;
    constructor(options: NukeAPIClientOptions);
    /** `POST /api/v1/delete-user` — returns the `data` payload. */
    deleteUser(body: unknown): Promise<DeleteUserResponse["data"]>;
    /** `GET /api/v1/status/{requestId}` — returns the `data` payload. */
    getRequest(requestId: string): Promise<GetRequestResponse["data"]>;
    /** `GET /api/status` (public) — returns the `data` payload. */
    getStatus(): Promise<SystemStatusResponse["data"]>;
    private request;
    private fetchWithTimeout;
    private parseBody;
    private buildError;
    private wrapNetworkError;
    private backoffMs;
    private sleep;
}
//# sourceMappingURL=client.d.ts.map