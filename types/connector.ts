export type Integration =
  // Core (live by default)
  | "stripe"
  | "mailchimp"
  | "hubspot"
  | "intercom"
  | "supabase"
  | "postgresql"
  // Dormant batch 1 (owner-enabled)
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
  // ── Batch 2: hidden-by-default until admin releases ──
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
  // ── Batch 2: hidden-by-default until admin releases ──
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
];

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

/** Raw credentials as sent from the dashboard (never stored plaintext). */
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
export interface SalesforceCredentials {
  instance_url: string;
  access_token: string;
}
export interface SegmentCredentials {
  access_token: string;
  workspace: string;
}
export interface KlaviyoCredentials {
  api_key: string;
}
export interface SendGridCredentials {
  api_key: string;
}
export interface Auth0Credentials {
  domain: string;
  management_api_token: string;
}
export interface ClerkCredentials {
  api_key: string;
}
export interface PostHogCredentials {
  host: string;
  project_id: string;
  api_key: string;
}
export interface ZendeskCredentials {
  subdomain: string;
  agent_email: string;
  api_token: string;
}
export interface MixpanelCredentials {
  project_id: string;
  api_secret: string;
}
export interface MysqlCredentials {
  connection_string: string;
  table_name: string;
  email_column: string;
}
export interface PlanetScaleCredentials {
  connection_string: string;
  table_name: string;
  email_column: string;
}
export interface NeonCredentials {
  connection_string: string;
  table_name: string;
  email_column: string;
}
export interface MongoDBCredentials {
  connection_string: string;
  database: string;
  collection: string;
  email_field: string;
}
export interface FirestoreCredentials {
  project_id: string;
  collection: string;
  email_field: string;
  access_token: string;
}
export interface ConvertKitCredentials {
  api_secret: string;
}
export interface ActiveCampaignCredentials {
  api_key: string;
  account: string;
}
export interface ResendCredentials {
  api_key: string;
  audience_id: string;
}
export interface DripCredentials {
  api_key: string;
  account_id: string;
}
export interface AmplitudeCredentials {
  api_key: string;
  api_secret: string;
}
export interface FullStoryCredentials {
  org_id: string;
  api_key: string;
}
export interface HeapCredentials {
  app_id: string;
  api_key: string;
}
export interface JuneCredentials {
  api_key: string;
  workspace_id?: string;
}
export interface PaddleCredentials {
  api_key: string;
}
export interface ChargebeeCredentials {
  api_key: string;
  site: string;
}
export interface RecurlyCredentials {
  api_key: string;
}
export interface BraintreeCredentials {
  merchant_id: string;
  api_key: string;
  private_key: string;
}
export interface PipedriveCredentials {
  api_token: string;
  company_domain: string;
}
export interface FreshdeskCredentials {
  api_key: string;
  domain: string;
}
export interface CrispCredentials {
  api_key: string;
  api_identifier: string;
  website_id: string;
}
export interface FirebaseAuthCredentials {
  project_id: string;
  access_token: string;
}
export interface OktaCredentials {
  domain: string;
  api_token: string;
}
export interface StytchCredentials {
  secret: string;
  project_id: string;
}

// ── Batch 2 credential interfaces (hidden-by-default connectors) ──

// Databases
export interface TursoCredentials {
  database_url: string;
  auth_token: string;
  table_name: string;
  email_column: string;
}
export interface RedisCredentials {
  rest_url: string;
  rest_token: string;
  key_pattern: string; // supports "*" wildcards, e.g. "users:*:email@example.com"
}
export interface ElasticsearchCredentials {
  endpoint: string;
  api_key: string;
  index_names: string; // comma-separated index names
}
export interface CassandraCredentials {
  contact_points: string; // comma-separated host:port list
  keyspace: string;
  username: string;
  password: string;
  table_name: string;
  email_column: string;
}

// Auth providers
export interface WorkOSCredentials {
  api_key: string;
  directory_id: string;
}
export interface PassageCredentials {
  app_id: string;
  api_key: string;
}
export interface CognitoCredentials {
  access_key: string;
  secret_key: string;
  region: string;
  user_pool_id: string;
}
export interface KeycloakCredentials {
  base_url: string;
  realm: string;
  admin_username: string;
  admin_password: string;
}

// Email marketing
export interface BrevoCredentials {
  api_key: string;
}
export interface OmnisendCredentials {
  api_key: string;
}
export interface BeehiivCredentials {
  api_key: string;
  publication_id: string;
}
export interface SubstackCredentials {
  // Substack has no public erasure API; the connector returns a clear "skipped".
  api_key?: string;
}
export interface LoopsCredentials {
  api_key: string;
}
export interface CustomerIOCredentials {
  site_id: string;
  api_key: string;
}

// Support & CRM
export interface LinearCredentials {
  api_key: string;
}
export interface HelpScoutCredentials {
  api_key: string;
}
export interface GorgiasCredentials {
  domain: string;
  email: string;
  api_key: string;
}
export interface GrooveCredentials {
  access_token: string;
}

// Analytics
export interface SmartlookCredentials {
  api_key: string;
  workspace_id: string;
}
export interface LogRocketCredentials {
  api_key: string;
  app_id: string;
}
export interface DatadogCredentials {
  api_key: string;
  app_key: string;
}
export interface PendoCredentials {
  api_key: string;
  app_id: string;
}

// Payments & billing
export interface LemonSqueezyCredentials {
  api_key: string;
}
export interface GumroadCredentials {
  access_token: string;
}
export interface ZuoraCredentials {
  client_id: string;
  client_secret: string;
}

// Cloud storage
export interface AwsS3Credentials {
  access_key: string;
  secret_key: string;
  region: string;
  bucket: string;
  prefix_pattern: string;
}
export interface CloudflareR2Credentials {
  account_id: string;
  access_key: string;
  secret_key: string;
  bucket: string;
  prefix_pattern: string;
}
export interface GoogleCloudStorageCredentials {
  service_account_json: string;
  bucket: string;
  prefix_pattern: string;
}
export interface VercelBlobCredentials {
  api_token: string;
  prefix_pattern: string;
}

// Communication
export interface TwilioCredentials {
  account_sid: string;
  auth_token: string;
}
export interface VonageCredentials {
  api_key: string;
  api_secret: string;
}
export interface PlivoCredentials {
  auth_id: string;
  auth_token: string;
}

// Other SaaS
export interface NotionCredentials {
  integration_token: string;
}
export interface AirtableCredentials {
  api_key: string;
  base_id: string;
  table_ids: string; // comma-separated table IDs
  email_column: string;
}
export interface WebflowCredentials {
  api_token: string;
  site_id: string;
}
export interface MemberstackCredentials {
  api_key: string;
  app_id: string;
}
export interface OutsetaCredentials {
  api_key: string;
}

// Marketing & advertising
export interface BrazeCredentials {
  api_key: string;
  instance_url: string;
}
export interface IterableCredentials {
  api_key: string;
}
export interface VeroCredentials {
  auth_token: string;
}

export type ConnectorCredentialsMap = {
  stripe: StripeCredentials;
  mailchimp: MailchimpCredentials;
  hubspot: HubSpotCredentials;
  intercom: IntercomCredentials;
  supabase: SupabaseTargetCredentials;
  postgresql: PostgresqlCredentials;
  salesforce: SalesforceCredentials;
  segment: SegmentCredentials;
  klaviyo: KlaviyoCredentials;
  sendgrid: SendGridCredentials;
  auth0: Auth0Credentials;
  clerk: ClerkCredentials;
  posthog: PostHogCredentials;
  zendesk: ZendeskCredentials;
  mixpanel: MixpanelCredentials;
  mysql: MysqlCredentials;
  planetscale: PlanetScaleCredentials;
  neon: NeonCredentials;
  mongodb: MongoDBCredentials;
  firestore: FirestoreCredentials;
  convertkit: ConvertKitCredentials;
  activecampaign: ActiveCampaignCredentials;
  resend: ResendCredentials;
  drip: DripCredentials;
  amplitude: AmplitudeCredentials;
  fullstory: FullStoryCredentials;
  heap: HeapCredentials;
  june: JuneCredentials;
  paddle: PaddleCredentials;
  chargebee: ChargebeeCredentials;
  recurly: RecurlyCredentials;
  braintree: BraintreeCredentials;
  pipedrive: PipedriveCredentials;
  freshdesk: FreshdeskCredentials;
  crisp: CrispCredentials;
  firebaseauth: FirebaseAuthCredentials;
  okta: OktaCredentials;
  stytch: StytchCredentials;
  // Batch 2
  turso: TursoCredentials;
  redis: RedisCredentials;
  elasticsearch: ElasticsearchCredentials;
  cassandra: CassandraCredentials;
  workos: WorkOSCredentials;
  passage: PassageCredentials;
  cognito: CognitoCredentials;
  keycloak: KeycloakCredentials;
  brevo: BrevoCredentials;
  omnisend: OmnisendCredentials;
  beehiiv: BeehiivCredentials;
  substack: SubstackCredentials;
  loops: LoopsCredentials;
  customerio: CustomerIOCredentials;
  linear: LinearCredentials;
  helpscout: HelpScoutCredentials;
  gorgias: GorgiasCredentials;
  groove: GrooveCredentials;
  smartlook: SmartlookCredentials;
  logrocket: LogRocketCredentials;
  datadog: DatadogCredentials;
  pendo: PendoCredentials;
  lemonsqueezy: LemonSqueezyCredentials;
  gumroad: GumroadCredentials;
  zuora: ZuoraCredentials;
  awss3: AwsS3Credentials;
  cloudflarer2: CloudflareR2Credentials;
  googlecloudstorage: GoogleCloudStorageCredentials;
  vercelblob: VercelBlobCredentials;
  twilio: TwilioCredentials;
  vonage: VonageCredentials;
  plivo: PlivoCredentials;
  notion: NotionCredentials;
  airtable: AirtableCredentials;
  webflow: WebflowCredentials;
  memberstack: MemberstackCredentials;
  outseta: OutsetaCredentials;
  braze: BrazeCredentials;
  iterable: IterableCredentials;
  vero: VeroCredentials;
};

export type AnyConnectorCredentials =
  ConnectorCredentialsMap[Integration];

/** AES-256-GCM envelope stored in connector_credentials.credentials. */
export interface EncryptedEnvelope {
  v: 1;
  alg: "AES-256-GCM";
  iv: string; // base64
  tag: string; // base64
  data: string; // base64 ciphertext
}
