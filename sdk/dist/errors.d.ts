/**
 * Error type thrown by the SDK on any non-2xx response or network
 * failure. Carries the HTTP status, the machine-readable `code`
 * returned by the API (when available), and an optional
 * `requestId` / `retryAfter` for diagnostics and backoff.
 */
export declare class NukeAPIError extends Error {
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
    });
    /** Convenience predicate for `instanceof` checks in consumers. */
    static isNukeAPIError(err: unknown): err is NukeAPIError;
}
//# sourceMappingURL=errors.d.ts.map