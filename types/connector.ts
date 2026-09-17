export type Integration =
  // Core (live executors in v2)
  | "stripe"
  | "mailchimp"
  | "hubspot"
  | "intercom"
  | "supabase"
  | "postgresql"
  // Dormant batch 1 (owner-enableable catalog; executors ship in a later phase)
  | "salesforce"
  | "segment"
  | "klaviyo"
  | "sendgrid"
  | "auth0"
  | "clerk"
  | "posthog"
  | "zendesk"
  | "mixpanel"
  // Databases
  | "mysql"
  | "planetscale"
  | "neon"
  | "mongodb"
  | "firestore"
  // Email
  | "convertkit"
  | "activecampaign"
  | "resend"
  | "drip"
  // Analytics
  | "amplitude"
  | "fullstory"
  | "heap"
  | "june"
  // Payments
  | "paddle"
  | "chargebee"
  | "recurly"
  | "braintree"
  // CRM / Support
  | "pipedrive"
  | "freshdesk"
  | "crisp"
  // Auth
  | "firebaseauth"
  | "okta"
  | "stytch"
  // ── Batch 2: hidden-by-default until the owner releases ──
  // Databases
  | "turso"
  | "redis"
  | "elasticsearch"
  | "cassandra"
  // Auth providers
  | "workos"
  | "passage"
  | "cognito"
  | "keycloak"
  // Email marketing
  | "brevo"
  | "omnisend"
  | "beehiiv"
  | "substack"
  | "loops"
  | "customerio"
  // Support & CRM
  | "linear"
  | "helpscout"
  | "gorgias"
  | "groove"
  // Analytics
  | "smartlook"
  | "logrocket"
  | "datadog"
  | "pendo"
  // Payments & billing
  | "lemonsqueezy"
  | "gumroad"
  | "zuora"
  // Cloud storage
  | "awss3"
  | "cloudflarer2"
  | "googlecloudstorage"
  | "vercelblob"
  // Communication
  | "twilio"
  | "vonage"
  | "plivo"
  // Other SaaS
  | "notion"
  | "airtable"
  | "webflow"
  | "memberstack"
  | "outseta"
  // Marketing & advertising
  | "braze"
  | "iterable"
  | "vero";

export const ALL_INTEGRATIONS: Integration[] = [
  "stripe",
  "mailchimp",
  "hubspot",
  "intercom",
  "supabase",
  "postgresql",
  "salesforce",
  "segment",
  "klaviyo",
  "sendgrid",
  "auth0",
  "clerk",
  "posthog",
  "zendesk",
  "mixpanel",
  "mysql",
  "planetscale",
  "neon",
  "mongodb",
  "firestore",
  "convertkit",
  "activecampaign",
  "resend",
  "drip",
  "amplitude",
  "fullstory",
  "heap",
  "june",
  "paddle",
  "chargebee",
  "recurly",
  "braintree",
  "pipedrive",
  "freshdesk",
  "crisp",
  "firebaseauth",
  "okta",
  "stytch",
  "turso",
  "redis",
  "elasticsearch",
  "cassandra",
  "workos",
  "passage",
  "cognito",
  "keycloak",
  "brevo",
  "omnisend",
  "beehiiv",
  "substack",
  "loops",
  "customerio",
  "linear",
  "helpscout",
  "gorgias",
  "groove",
  "smartlook",
  "logrocket",
  "datadog",
  "pendo",
  "lemonsqueezy",
  "gumroad",
  "zuora",
  "awss3",
  "cloudflarer2",
  "googlecloudstorage",
  "vercelblob",
  "twilio",
  "vonage",
  "plivo",
  "notion",
  "airtable",
  "webflow",
  "memberstack",
  "outseta",
  "braze",
  "iterable",
  "vero",
] as const;

/**
 * Integrations with a real delete executor in this build
 * (`lib/connectors/specs`). All 78 catalog entries ship an executor —
 * HTTP/SaaS APIs run on fetch, SQL targets on pg/mysql2/libsql, and the rest
 * on their official SDKs (dynamically imported inside run(), so an unused
 * SDK never costs startup time or client bytes). Owner availability
 * (`connector_flags`) is the only gate between a customer and an executor.
 */
export const LIVE_INTEGRATIONS: Integration[] = [...ALL_INTEGRATIONS];

export type ConnectorStatus = "success" | "failed" | "skipped";

export interface ConnectorResult {
  integration: Integration;
  status: ConnectorStatus;
  message: string;
  error?: string;
  durationMs: number;
}

export interface ConnectorContext {
  email: string;
  externalId?: string;
}

export interface StripeCredentials {
  secret_key: string;
}
export interface MailchimpCredentials {
  api_key: string;
  server_prefix: string;
}
export interface HubSpotCredentials {
  access_token: string;
}
export interface IntercomCredentials {
  access_token: string;
}
export interface SupabaseTargetCredentials {
  project_url: string;
  service_role_key: string;
}
export interface PostgresqlCredentials {
  connection_string: string;
  table_name: string;
  email_column: string;
}

type LiveCredentialsMap = {
  stripe: StripeCredentials;
  mailchimp: MailchimpCredentials;
  hubspot: HubSpotCredentials;
  intercom: IntercomCredentials;
  supabase: SupabaseTargetCredentials;
  postgresql: PostgresqlCredentials;
};

/** Credential shapes for the 72 catalog-only integrations (generic string map until their executors ship). */
type CatalogCredentialsMap = {
  [K in Exclude<
    Integration,
    "stripe" | "mailchimp" | "hubspot" | "intercom" | "supabase" | "postgresql"
  >]: Record<string, string>;
};

export type ConnectorCredentialsMap = LiveCredentialsMap & CatalogCredentialsMap;

export type AnyConnectorCredentials = ConnectorCredentialsMap[Integration];

/** AES-256-GCM envelope stored in connector_credentials.credentials. */
export interface EncryptedEnvelope {
  v: 1;
  alg: "AES-256-GCM";
  iv: string;
  tag: string;
  data: string;
}
