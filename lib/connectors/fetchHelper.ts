/**
 * Shared HTTP helper for all connectors (Section 6.9).
 * - Hard timeout on every outbound call (default 10s) so a hung third-party
 *   API can never hang a deletion request indefinitely.
 * - Retry with exponential backoff, but ONLY on retryable conditions:
 *   network errors and 429/5xx. Never on 4xx (bad request / bad auth won't
 *   succeed on retry — retrying just wastes time and can lock an account).
 */

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRIES = 2;

export class ConnectorHttpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ConnectorHttpError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ConnectorHttpError(`Request timed out after ${timeoutMs}ms`);
    }
    throw new ConnectorHttpError(`Network error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export interface RetryOptions {
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.retries ?? DEFAULT_RETRIES;
  const backoffBase = opts.backoffBaseMs ?? 500;

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);

      // Retryable HTTP statuses: 429 (rate limit) and 5xx (server errors).
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          const retryAfter = res.headers.get("Retry-After");
          const waitMs = retryAfter
            ? Math.min(parseInt(retryAfter, 10) * 1000 || backoffBase, 30_000)
            : backoffBase * 2 ** attempt;
          await sleep(waitMs);
          continue;
        }
        // Exhausted retries — return the response so the connector can record
        // the failure explicitly (never silently swallow).
        return res;
      }

      return res;
    } catch (err) {
      lastErr = err as Error;
      if (attempt < maxRetries) {
        await sleep(backoffBase * 2 ** attempt);
        continue;
      }
      throw lastErr;
    }
  }

  throw lastErr ?? new ConnectorHttpError("Unknown fetch failure");
}

/** Parse JSON, tolerating empty bodies. */
export async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}
