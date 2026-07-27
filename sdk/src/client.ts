import { NukeAPIError } from "./errors.js";
import type {
  APIErrorBody,
  DeleteUserResponse,
  GetRequestResponse,
  SystemStatusResponse,
} from "./types.js";

export interface NukeAPIClientOptions {
  /** API key, e.g. `nk_live_xxxxx` or `nk_test_xxxxx`. */
  apiKey: string;
  /** Defaults to `https://nukeapi.dev`. Use `http://localhost:3000` in dev. */
  baseUrl?: string;
  /** Per-request timeout in ms (default 10000). */
  timeoutMs?: number;
  /** Max retries on network errors / 429 / 5xx (default 2). */
  maxRetries?: number;
  /** Inject a custom `fetch` (useful for tests / older runtimes). */
  fetch?: typeof fetch;
}

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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NukeAPIClientOptions) {
    if (!options.apiKey || typeof options.apiKey !== "string") {
      throw new Error("NukeAPIClient: `apiKey` is required and must be a string.");
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error(
        "NukeAPIClient: global `fetch` is unavailable in this environment. " +
          "Pass a `fetch` implementation via options.",
      );
    }
    this.apiKey = options.apiKey;
    // Trim any trailing slash so path joining is predictable.
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = fetchImpl;
  }

  /** `POST /api/v1/delete-user` — returns the `data` payload. */
  async deleteUser(body: unknown): Promise<DeleteUserResponse["data"]> {
    const res = await this.request<DeleteUserResponse>(
      "/api/v1/delete-user",
      { method: "POST", body: JSON.stringify(body) },
      true,
    );
    return res.data;
  }

  /** `GET /api/v1/status/{requestId}` — returns the `data` payload. */
  async getRequest(requestId: string): Promise<GetRequestResponse["data"]> {
    if (!requestId) {
      throw new Error("NukeAPIClient.getRequest: `requestId` is required.");
    }
    const res = await this.request<GetRequestResponse>(
      `/api/v1/status/${encodeURIComponent(requestId)}`,
      { method: "GET" },
      true,
    );
    return res.data;
  }

  /** `GET /api/status` (public) — returns the `data` payload. */
  async getStatus(): Promise<SystemStatusResponse["data"]> {
    const res = await this.request<SystemStatusResponse>(
      "/api/status",
      { method: "GET" },
      false,
    );
    return res.data;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    requiresAuth: boolean,
  ): Promise<T> {
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
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          ...init,
          headers,
        });
      } catch (err) {
        // Network-level failure (DNS, connection reset, timeout abort).
        if (attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(this.backoffMs(attempt, undefined));
          continue;
        }
        throw this.wrapNetworkError(err);
      }

      // Retryable HTTP statuses: 429 (rate limit) and 5xx.
      const isRetryableStatus =
        response.status === 429 ||
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
        return parsed as T;
      }

      throw this.buildError(response, parsed);
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private buildError(response: Response, parsed: unknown): NukeAPIError {
    let code = `HTTP_${response.status}`;
    let message =
      response.statusText || `Request failed with status ${response.status}`;

    const body = parsed as APIErrorBody | null;
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object"
    ) {
      if (typeof body.error.code === "string") code = body.error.code;
      if (typeof body.error.message === "string") message = body.error.message;
    } else if (typeof parsed === "string" && parsed.length > 0) {
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
      retryAfter: Number.isNaN(retryAfter as number) ? undefined : retryAfter,
    });
  }

  private wrapNetworkError(err: unknown): NukeAPIError {
    const message =
      err instanceof Error ? err.message : "Network request failed";
    return new NukeAPIError({
      message,
      status: 0,
      code: "NETWORK_ERROR",
    });
  }

  private backoffMs(attempt: number, retryAfter?: number): number {
    // Honor server-provided Retry-After (seconds) when present.
    if (retryAfter != null && !Number.isNaN(retryAfter) && retryAfter > 0) {
      return retryAfter * 1000;
    }
    // Exponential backoff: 500ms, 1000ms, ... capped at 8s.
    const base = 500 * Math.pow(2, attempt - 1);
    return Math.min(base, 8000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
