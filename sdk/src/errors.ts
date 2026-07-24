/**
 * Error type thrown by the SDK on any non-2xx response or network
 * failure. Carries the HTTP status, the machine-readable `code`
 * returned by the API (when available), and an optional
 * `requestId` / `retryAfter` for diagnostics and backoff.
 */
export class NukeAPIError extends Error {
  /** HTTP status code (0 for network failures with no response). */
  readonly status: number;
  /** Machine-readable error code, e.g. "UNAUTHORIZED", "RATE_LIMITED". */
  readonly code: string;
  /** Present on some responses (e.g. echoed from the request). */
  readonly requestId?: string;
  /** Seconds to wait before retrying; parsed from `Retry-After`. */
  readonly retryAfter?: number;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    requestId?: string;
    retryAfter?: number;
  }) {
    super(params.message);
    this.name = "NukeAPIError";
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.retryAfter = params.retryAfter;
    // Restore prototype chain (required when targeting ES5/ES2015 + extending built-ins).
    Object.setPrototypeOf(this, NukeAPIError.prototype);
  }

  /** Convenience predicate for `instanceof` checks in consumers. */
  static isNukeAPIError(err: unknown): err is NukeAPIError {
    return err instanceof NukeAPIError;
  }
}
