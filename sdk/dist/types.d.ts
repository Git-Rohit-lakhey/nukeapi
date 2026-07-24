/**
 * Public types for the NukeAPI TypeScript SDK.
 *
 * These mirror the REST API contract documented in the NukeAPI spec.
 * The SDK is a standalone artifact: it does NOT import from the main
 * app (no `@/` aliases, no `../lib` or `../app`). All shapes are
 * re-declared here on purpose.
 */
/**
 * Every integration NukeAPI can fan a deletion out to.
 * This is the canonical list used across the SDK.
 */
export type Integration = "stripe" | "mailchimp" | "hubspot" | "intercom" | "supabase" | "postgresql" | "salesforce" | "segment" | "klaviyo" | "sendgrid" | "auth0" | "clerk" | "posthog" | "zendesk" | "mixpanel" | "mysql" | "planetscale" | "neon" | "mongodb" | "firestore" | "convertkit" | "activecampaign" | "resend" | "drip" | "amplitude" | "fullstory" | "heap" | "june" | "paddle" | "chargebee" | "recurly" | "braintree" | "pipedrive" | "freshdesk" | "crisp" | "firebaseauth" | "okta" | "stytch" | "turso" | "redis" | "elasticsearch" | "cassandra" | "workos" | "passage" | "cognito" | "keycloak" | "brevo" | "omnisend" | "beehiiv" | "substack" | "loops" | "customerio" | "linear" | "helpscout" | "gorgias" | "groove" | "smartlook" | "logrocket" | "datadog" | "pendo" | "lemonsqueezy" | "gumroad" | "zuora" | "awss3" | "cloudflarer2" | "googlecloudstorage" | "vercelblob" | "twilio" | "vonage" | "plivo" | "notion" | "airtable" | "webflow" | "memberstack" | "outseta" | "braze" | "iterable" | "vero";
/** A single integration's deletion outcome. */
export type ConnectorStatus = "success" | "failed" | "skipped";
export interface ConnectorResult {
    integration: Integration;
    status: ConnectorStatus;
    message: string;
    /** Present when `status === "failed"`. */
    error?: string;
    durationMs: number;
}
export interface UsageInfo {
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    /** USD per deletion beyond `limit`; present on paid plans. */
    overageRate?: number;
}
export type DeletionStatus = "completed" | "partial" | "failed";
/** Request body for `POST /api/v1/delete-user`. */
export interface DeleteUserRequest {
    subject_email: string;
    /** When omitted/empty, the server deletes across ALL allowed + enabled integrations. */
    integrations?: Integration[];
    subject_external_id?: string;
    /**
     * Optional HTTPS URL fired a signed `POST` on completion (SSRF-validated
     * by the server). Omit to skip the webhook notification.
     */
    webhook?: string;
}
/** `data` field of a successful `deleteUser` response. */
export interface DeleteUserResponseData {
    requestId: string;
    status: DeletionStatus;
    results: ConnectorResult[];
    startedAt: string;
    completedAt: string;
    elapsedMs: number;
    auditSignature: string;
    usage: UsageInfo;
}
export interface DeleteUserResponse {
    success: true;
    requestId: string;
    data: DeleteUserResponseData;
}
/** `data` field of `GET /api/v1/status/{requestId}`. */
export interface RequestStatus {
    requestId: string;
    status: DeletionStatus;
    subjectEmail: string;
    integrationsRequested: Integration[];
    integrationsCompleted: Integration[];
    integrationsFailed: Integration[];
    createdAt: string;
    completedAt: string | null;
    auditSignature: string;
}
export interface GetRequestResponse {
    success: true;
    data: RequestStatus;
}
export interface StatusCheck {
    name: string;
    ok: boolean;
    detail: string;
}
export interface SystemStatus {
    status: "operational" | "degraded";
    checks: StatusCheck[];
}
export interface SystemStatusResponse {
    success: true;
    data: SystemStatus;
}
/** Error envelope returned for non-2xx responses. */
export interface APIErrorBody {
    success: false;
    error: {
        code: string;
        message: string;
    };
}
//# sourceMappingURL=types.d.ts.map