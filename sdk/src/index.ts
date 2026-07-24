import { NukeAPIClient, type NukeAPIClientOptions } from "./client.js";
import { NukeAPIError } from "./errors.js";
import { INTEGRATIONS, INTEGRATION_LIST } from "./integrations.js";
import type {
  APIErrorBody,
  ConnectorResult,
  ConnectorStatus,
  DeleteUserRequest,
  DeleteUserResponse,
  DeleteUserResponseData,
  GetRequestResponse,
  Integration,
  RequestStatus,
  StatusCheck,
  SystemStatus,
  UsageInfo,
} from "./types.js";

export interface NukeAPICredentials {
  /** API key, e.g. `nk_live_xxxxx` or `nk_test_xxxxx`. */
  apiKey: string;
  /** Defaults to `https://app.nukeapi.com`. Use `http://localhost:3000` in dev. */
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
export class NukeAPI {
  /** The full list of supported integrations. */
  static readonly integrations: Integration[] = INTEGRATIONS;

  private readonly client: NukeAPIClient;

  constructor(credentials: NukeAPICredentials) {
    this.client = new NukeAPIClient(credentials);
  }

  /**
   * Delete a user across the requested integrations.
   *
   * Returns the `data` payload on success (HTTP 200 `completed` or
   * 207 `partial`). Throws `NukeAPIError` when the server reports
   * failure (HTTP 401/400/402/403/429/500) or on a network error.
   * A `partial` result is NOT an error — inspect `data.status` and
   * each `ConnectorResult.status` to see what failed.
   */
  async deleteUser(
    params: DeleteUserParams,
  ): Promise<DeleteUserResponse["data"]> {
    if (!params.subject_email || typeof params.subject_email !== "string") {
      throw new Error("NukeAPI.deleteUser: `subject_email` is required.");
    }
    const body: DeleteUserRequest = { subject_email: params.subject_email };
    if (params.integrations && params.integrations.length > 0) {
      body.integrations = params.integrations;
    }
    if (params.subject_external_id !== undefined) {
      body.subject_external_id = params.subject_external_id;
    }
    if (params.webhook !== undefined) {
      body.webhook = params.webhook;
    }
    return this.client.deleteUser(body);
  }

  /**
   * Fetch the status of a previously created deletion request.
   * Throws `NukeAPIError` (code `NOT_FOUND`) if the request id is unknown.
   */
  async getRequest(requestId: string): Promise<RequestStatus> {
    return this.client.getRequest(requestId);
  }

  /**
   * Fetch the public system status (no API key required by the server).
   */
  async getStatus(): Promise<SystemStatus> {
    return this.client.getStatus();
  }
}

export { NukeAPIClient, type NukeAPIClientOptions };
export { NukeAPIError };
export { INTEGRATIONS, INTEGRATION_LIST };

export type {
  Integration,
  ConnectorResult,
  ConnectorStatus,
  DeleteUserRequest,
  DeleteUserResponse,
  DeleteUserResponseData,
  GetRequestResponse,
  RequestStatus,
  StatusCheck,
  SystemStatus,
  UsageInfo,
  APIErrorBody,
};
