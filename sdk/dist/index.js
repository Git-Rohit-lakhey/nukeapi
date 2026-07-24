import { NukeAPIClient } from "./client.js";
import { NukeAPIError } from "./errors.js";
import { INTEGRATIONS, INTEGRATION_LIST } from "./integrations.js";
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
    static integrations = INTEGRATIONS;
    client;
    constructor(credentials) {
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
    async deleteUser(params) {
        if (!params.subject_email || typeof params.subject_email !== "string") {
            throw new Error("NukeAPI.deleteUser: `subject_email` is required.");
        }
        const body = { subject_email: params.subject_email };
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
    async getRequest(requestId) {
        return this.client.getRequest(requestId);
    }
    /**
     * Fetch the public system status (no API key required by the server).
     */
    async getStatus() {
        return this.client.getStatus();
    }
}
export { NukeAPIClient };
export { NukeAPIError };
export { INTEGRATIONS, INTEGRATION_LIST };
//# sourceMappingURL=index.js.map