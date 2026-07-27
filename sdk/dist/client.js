import { NukeAPIError } from "./errors.js";
const DEFAULT_BASE_URL = "https://nukeapi.dev";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
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
export class NukeAPIClient {
    apiKey;
    baseUrl;
    timeoutMs;
    maxRetries;
    fetchImpl;
    constructor(options) {
        if (!options.apiKey || typeof options.apiKey !== "string") {
            throw new Error("NukeAPIClient: `apiKey` is required and must be a string.");
        }
        const fetchImpl = options.fetch ?? globalThis.fetch;
        if (typeof fetchImpl !== "function") {
            throw new Error("NukeAPIClient: global `fetch` is unavailable in this environment. " +
                "Pass a `fetch` implementation via options.");
        }
        this.apiKey = options.apiKey;
        // Trim any trailing slash so path joining is predictable.
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.fetchImpl = fetchImpl;
    }
    /** `POST /api/v1/delete-user` — returns the `data` payload. */
    async deleteUser(body) {
        const res = await this.request("/api/v1/delete-user", { method: "POST", body: JSON.stringify(body) }, true);
        return res.data;
    }
    /** `GET /api/v1/status/{requestId}` — returns the `data` payload. */
    async getRequest(requestId) {
        if (!requestId) {
            throw new Error("NukeAPIClient.getRequest: `requestId` is required.");
        }
        const res = await this.request(`/api/v1/status/${encodeURIComponent(requestId)}`, { method: "GET" }, true);
        return res.data;
    }
    /** `GET /api/status` (public) — returns the `data` payload. */
    async getStatus() {
        const res = await this.request("/api/status", { method: "GET" }, false);
        return res.data;
    }
    async request(path, init, requiresAuth) {
        const url = `${this.baseUrl}${path}`;
        const headers = new Headers(init.headers);
        if (requiresAuth) {
            headers.set("Authorization", `Bearer ${this.apiKey}`);
        }
        headers.set("Accept", "application/json");
        if (init.body != null) {
            headers.set("Content-Type", "application/json");
        }
        let attempt = 0;
        // Retry loop: only re-attempt on transient failures.
        for (;;) {
            let response;
            try {
                response = await this.fetchWithTimeout(url, {
                    ...init,
                    headers,
                });
            }
            catch (err) {
                // Network-level failure (DNS, connection reset, timeout abort).
                if (attempt < this.maxRetries) {
                    attempt += 1;
                    await this.sleep(this.backoffMs(attempt, undefined));
                    continue;
                }
                throw this.wrapNetworkError(err);
            }
            // Retryable HTTP statuses: 429 (rate limit) and 5xx.
            const isRetryableStatus = response.status === 429 ||
                (response.status >= 500 && response.status < 600);
            if (isRetryableStatus && attempt < this.maxRetries) {
                const retryAfterHeader = response.headers.get("Retry-After");
                const retryAfter = retryAfterHeader
                    ? Number(retryAfterHeader)
                    : undefined;
                attempt += 1;
                await this.sleep(this.backoffMs(attempt, retryAfter));
                continue;
            }
            const parsed = await this.parseBody(response);
            if (response.status >= 200 && response.status < 300) {
                return parsed;
            }
            throw this.buildError(response, parsed);
        }
    }
    async fetchWithTimeout(url, init) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this.fetchImpl(url, {
                ...init,
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timer);
        }
    }
    async parseBody(response) {
        const text = await response.text();
        if (!text)
            return null;
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    buildError(response, parsed) {
        let code = `HTTP_${response.status}`;
        let message = response.statusText || `Request failed with status ${response.status}`;
        const body = parsed;
        if (body &&
            typeof body === "object" &&
            "error" in body &&
            body.error &&
            typeof body.error === "object") {
            if (typeof body.error.code === "string")
                code = body.error.code;
            if (typeof body.error.message === "string")
                message = body.error.message;
        }
        else if (typeof parsed === "string" && parsed.length > 0) {
            message = parsed;
        }
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfter = retryAfterHeader
            ? Number(retryAfterHeader)
            : undefined;
        return new NukeAPIError({
            message,
            status: response.status,
            code,
            retryAfter: Number.isNaN(retryAfter) ? undefined : retryAfter,
        });
    }
    wrapNetworkError(err) {
        const message = err instanceof Error ? err.message : "Network request failed";
        return new NukeAPIError({
            message,
            status: 0,
            code: "NETWORK_ERROR",
        });
    }
    backoffMs(attempt, retryAfter) {
        // Honor server-provided Retry-After (seconds) when present.
        if (retryAfter != null && !Number.isNaN(retryAfter) && retryAfter > 0) {
            return retryAfter * 1000;
        }
        // Exponential backoff: 500ms, 1000ms, ... capped at 8s.
        const base = 500 * Math.pow(2, attempt - 1);
        return Math.min(base, 8000);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=client.js.map