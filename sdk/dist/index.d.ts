import { NukeAPIClient, type NukeAPIClientOptions } from "./client.js";
import { NukeAPIError } from "./errors.js";
import { INTEGRATIONS, INTEGRATION_LIST } from "./integrations.js";
import type { APIErrorBody, ConnectorResult, ConnectorStatus, DeleteUserRequest, DeleteUserResponse, DeleteUserResponseData, GetRequestResponse, Integration, RequestStatus, StatusCheck, SystemStatus, UsageInfo } from "./types.js";
export interface NukeAPICredentials {
    /** API key, e.g. `nk_live_xxxxx` or `nk_test_xxxxx`. */
    apiKey: string;
    /** Defaults to `https://nukeapi.dev`. Use `http://localhost:3000` in dev. */
    baseUrl?: string;
    /** Per-request timeout in ms (default 10000). */
    timeoutMs?: number;
    /** Max retries on transient failures (default 2). */
    maxRetries?: number;
    /** Inject a custom `fetch` (useful for tests / older runtimes). */
    fetch?: typeof fetch;
}
export interface DeleteUserParams {
    subject_email: string;
    integrations?: Integration[];
    subject_external_id?: string;
    /** Optional HTTPS URL fired a signed POST on completion (SSRF-validated server-side). */
    webhook?: string;
}
/**
 * Ergonomic entrypoint for the NukeAPI SDK.
 *
 * ```ts
 * import { NukeAPI } from "@nukeapi/sdk";
 *
 * const nuke = new NukeAPI({ apiKey: process.env.NUKEAPI_KEY! });
 * const result = await nuke.deleteUser({ subject_email: "user@example.com" });
 * ```
 *
 * Connector-credential management (saving Stripe keys, API-key
 * creation, etc.) is a session/cookie flow done in the NukeAPI
 * dashboard — it is intentionally NOT part of this SDK.
 */
export declare class NukeAPI {
    /** The full list of supported integrations. */
    static readonly integrations: Integration[];
    private readonly client;
    constructor(credentials: NukeAPICredentials);
    /**
     * Delete a user across the requested integrations.
     *
     * Returns the `data` payload on success (HTTP 200 `completed` or
     * 207 `partial`). Throws `NukeAPIError` when the server reports
     * failure (HTTP 401/400/402/403/429/500) or on a network error.
     * A `partial` result is NOT an error — inspect `data.status` and
     * each `ConnectorResult.status` to see what failed.
     */
    deleteUser(params: DeleteUserParams): Promise<DeleteUserResponse["data"]>;
    /**
     * Fetch the status of a previously created deletion request.
     * Throws `NukeAPIError` (code `NOT_FOUND`) if the request id is unknown.
     */
    getRequest(requestId: string): Promise<RequestStatus>;
    /**
     * Fetch the public system status (no API key required by the server).
     */
    getStatus(): Promise<SystemStatus>;
}
export { NukeAPIClient, type NukeAPIClientOptions };
export { NukeAPIError };
export { INTEGRATIONS, INTEGRATION_LIST };
export type { Integration, ConnectorResult, ConnectorStatus, DeleteUserRequest, DeleteUserResponse, DeleteUserResponseData, GetRequestResponse, RequestStatus, StatusCheck, SystemStatus, UsageInfo, APIErrorBody, };
//# sourceMappingURL=index.d.ts.map