import type { Integration } from "@/types/connector";

/**
 * Single source of truth for connector display metadata: label, category,
 * the credential fields the dashboard renders, and which fields are required
 * at save time. Both the Connectors dashboard (client) and the
 * connectors/save route (server) read from here so field definitions can
 * never drift between UI and validation.
 *
 * `enabledByDefault` is used only as a UI fallback before the live
 * `connector_flags` state is fetched from the database. The database is the
 * real source of truth for whether a connector is usable.
 */
export interface ConnectorFieldDef {
  name: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

export interface ConnectorMeta {
  key: Integration;
  label: string;
  tag: string; // short category tag for badges
  category: string; // grouping used in admin UI
  fields: ConnectorFieldDef[];
  required: string[];
  enabledByDefault: boolean;
  note?: string;
}

export const CONNECTOR_META: Record<Integration, ConnectorMeta> = {
  stripe: {
    key: "stripe",
    label: "Stripe",
    tag: "Payments",
    category: "Payments",
    fields: [
      { name: "secret_key", label: "Secret key", placeholder: "sk_live_...", secret: true },
    ],
    required: ["secret_key"],
    enabledByDefault: true,
  },
  mailchimp: {
    key: "mailchimp",
    label: "Mailchimp",
    tag: "Email",
    category: "Email",
    fields: [
      { name: "api_key", label: "API key", placeholder: "xxxx-usX", secret: true },
      { name: "server_prefix", label: "Server prefix", placeholder: "usX" },
    ],
    required: ["api_key", "server_prefix"],
    enabledByDefault: true,
  },
  hubspot: {
    key: "hubspot",
    label: "HubSpot",
    tag: "CRM",
    category: "CRM",
    fields: [
      { name: "access_token", label: "Private app token", placeholder: "pat-...", secret: true },
    ],
    required: ["access_token"],
    enabledByDefault: true,
  },
  intercom: {
    key: "intercom",
    label: "Intercom",
    tag: "Support",
    category: "Support",
    fields: [
      { name: "access_token", label: "Access token", placeholder: "dG...", secret: true },
    ],
    required: ["access_token"],
    enabledByDefault: true,
  },
  supabase: {
    key: "supabase",
    label: "Supabase (your project)",
    tag: "Database",
    category: "Database",
    fields: [
      { name: "project_url", label: "Project URL", placeholder: "https://xxxx.supabase.co" },
      { name: "service_role_key", label: "Service role key", placeholder: "ey...", secret: true },
    ],
    required: ["project_url", "service_role_key"],
    enabledByDefault: true,
  },
  postgresql: {
    key: "postgresql",
    label: "PostgreSQL",
    tag: "Database",
    category: "Database",
    enabledByDefault: true,
    note: "Direct database connector — table and column names are validated before use.",
    fields: [
      { name: "connection_string", label: "Connection string", placeholder: "postgres://...", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["connection_string", "table_name", "email_column"],
  },

  // ── Newer connectors: built completely, ship OFF until the owner enables ──
  salesforce: {
    key: "salesforce",
    label: "Salesforce",
    tag: "CRM",
    category: "CRM",
    enabledByDefault: false,
    note: "Deletes Contact records by email across your Salesforce org.",
    fields: [
      { name: "instance_url", label: "Instance URL", placeholder: "https://your-instance.my.salesforce.com" },
      { name: "access_token", label: "Access token", placeholder: "00D...", secret: true },
    ],
    required: ["instance_url", "access_token"],
  },
  segment: {
    key: "segment",
    label: "Segment",
    tag: "CDP",
    category: "CDP",
    enabledByDefault: false,
    note: "Uses the Segment Regulation API. Deletes the user whose user_id equals the email.",
    fields: [
      { name: "access_token", label: "Regulation API token", placeholder: "Regulation API token", secret: true },
      { name: "workspace", label: "Workspace slug", placeholder: "your-workspace" },
    ],
    required: ["access_token", "workspace"],
  },
  klaviyo: {
    key: "klaviyo",
    label: "Klaviyo",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "Private API key", placeholder: "pk_...", secret: true },
    ],
    required: ["api_key"],
  },
  sendgrid: {
    key: "sendgrid",
    label: "SendGrid",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "SG...", secret: true },
    ],
    required: ["api_key"],
  },
  auth0: {
    key: "auth0",
    label: "Auth0",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    fields: [
      { name: "domain", label: "Domain", placeholder: "your-tenant.us.auth0.com" },
      { name: "management_api_token", label: "Management API token", placeholder: "ey...", secret: true },
    ],
    required: ["domain", "management_api_token"],
  },
  clerk: {
    key: "clerk",
    label: "Clerk",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "Secret key", placeholder: "sk_live_...", secret: true },
    ],
    required: ["api_key"],
  },
  posthog: {
    key: "posthog",
    label: "PostHog",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "host", label: "Host", placeholder: "https://app.posthog.com" },
      { name: "project_id", label: "Project ID", placeholder: "123" },
      { name: "api_key", label: "Personal API token", placeholder: "phx_...", secret: true },
    ],
    required: ["host", "project_id", "api_key"],
  },
  zendesk: {
    key: "zendesk",
    label: "Zendesk",
    tag: "Support",
    category: "Support",
    enabledByDefault: false,
    fields: [
      { name: "subdomain", label: "Subdomain", placeholder: "yourcompany" },
      { name: "agent_email", label: "Agent email", placeholder: "agent@company.com" },
      { name: "api_token", label: "API token", placeholder: "token", secret: true },
    ],
    required: ["subdomain", "agent_email", "api_token"],
  },
  mixpanel: {
    key: "mixpanel",
    label: "Mixpanel",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    note: "Deletes the user's People profile by email (distinct_id).",
    fields: [
      { name: "project_id", label: "Project ID", placeholder: "1234567" },
      { name: "api_secret", label: "API secret", placeholder: "project secret", secret: true },
    ],
    required: ["project_id", "api_secret"],
  },

  // ── Databases ──
  mysql: {
    key: "mysql",
    label: "MySQL",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes rows matching the email from a single table. Identifiers are validated before use.",
    fields: [
      { name: "connection_string", label: "Connection string", placeholder: "mysql://user:pass@host/db", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["connection_string", "table_name", "email_column"],
  },
  planetscale: {
    key: "planetscale",
    label: "PlanetScale",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "MySQL-compatible. Deletes rows matching the email from a single table over TLS.",
    fields: [
      { name: "connection_string", label: "Connection string", placeholder: "mysql://user:pass@host/db", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["connection_string", "table_name", "email_column"],
  },
  neon: {
    key: "neon",
    label: "Neon",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Serverless Postgres. Deletes rows matching the email from a single table.",
    fields: [
      { name: "connection_string", label: "Connection string", placeholder: "postgres://user:pass@host/db", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["connection_string", "table_name", "email_column"],
  },
  mongodb: {
    key: "mongodb",
    label: "MongoDB",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes documents matching the email from a single collection.",
    fields: [
      { name: "connection_string", label: "Connection string", placeholder: "mongodb+srv://user:pass@cluster/db", secret: true },
      { name: "database", label: "Database", placeholder: "app" },
      { name: "collection", label: "Collection", placeholder: "users" },
      { name: "email_field", label: "Email field", placeholder: "email" },
    ],
    required: ["connection_string", "database", "collection", "email_field"],
  },
  firestore: {
    key: "firestore",
    label: "Firestore",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes documents matching the email in a Firestore collection (OAuth2 access token).",
    fields: [
      { name: "project_id", label: "Project ID", placeholder: "my-project" },
      { name: "collection", label: "Collection", placeholder: "users" },
      { name: "email_field", label: "Email field", placeholder: "email" },
      { name: "access_token", label: "OAuth2 access token", placeholder: "ya29...", secret: true },
    ],
    required: ["project_id", "collection", "email_field", "access_token"],
  },

  // ── Email ──
  convertkit: {
    key: "convertkit",
    label: "ConvertKit",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [{ name: "api_secret", label: "API secret", placeholder: "api_secret", secret: true }],
    required: ["api_secret"],
  },
  activecampaign: {
    key: "activecampaign",
    label: "ActiveCampaign",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "account", label: "Account subdomain", placeholder: "youraccount" },
    ],
    required: ["api_key", "account"],
  },
  resend: {
    key: "resend",
    label: "Resend",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    note: "Deletes the contact from a specific Resend audience.",
    fields: [
      { name: "api_key", label: "API key", placeholder: "re_...", secret: true },
      { name: "audience_id", label: "Audience ID", placeholder: "aud_..." },
    ],
    required: ["api_key", "audience_id"],
  },
  drip: {
    key: "drip",
    label: "Drip",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "account_id", label: "Account ID", placeholder: "1234567" },
    ],
    required: ["api_key", "account_id"],
  },

  // ── Analytics ──
  amplitude: {
    key: "amplitude",
    label: "Amplitude",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key" },
      { name: "api_secret", label: "API secret", placeholder: "api_secret", secret: true },
    ],
    required: ["api_key", "api_secret"],
  },
  fullstory: {
    key: "fullstory",
    label: "FullStory",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "org_id", label: "Org ID", placeholder: "your-org-id" },
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
    ],
    required: ["org_id", "api_key"],
  },
  heap: {
    key: "heap",
    label: "Heap",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "app_id", label: "App ID", placeholder: "1234567" },
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
    ],
    required: ["app_id", "api_key"],
  },
  june: {
    key: "june",
    label: "June",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "june_...", secret: true },
      { name: "workspace_id", label: "Workspace ID", placeholder: "optional" },
    ],
    required: ["api_key"],
  },

  // ── Payments ──
  paddle: {
    key: "paddle",
    label: "Paddle",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "API key", secret: true }],
    required: ["api_key"],
  },
  chargebee: {
    key: "chargebee",
    label: "Chargebee",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "API key", secret: true },
      { name: "site", label: "Site subdomain", placeholder: "yoursite" },
    ],
    required: ["api_key", "site"],
  },
  recurly: {
    key: "recurly",
    label: "Recurly",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "API key", secret: true }],
    required: ["api_key"],
  },
  braintree: {
    key: "braintree",
    label: "Braintree",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [
      { name: "merchant_id", label: "Merchant ID", placeholder: "merchant_id" },
      { name: "api_key", label: "Public key", placeholder: "public key" },
      { name: "private_key", label: "Private key", placeholder: "private key", secret: true },
    ],
    required: ["merchant_id", "api_key", "private_key"],
  },

  // ── CRM / Support ──
  pipedrive: {
    key: "pipedrive",
    label: "Pipedrive",
    tag: "CRM",
    category: "CRM",
    enabledByDefault: false,
    fields: [
      { name: "api_token", label: "API token", placeholder: "api_token", secret: true },
      { name: "company_domain", label: "Company domain", placeholder: "yourcompany" },
    ],
    required: ["api_token", "company_domain"],
  },
  freshdesk: {
    key: "freshdesk",
    label: "Freshdesk",
    tag: "Support",
    category: "Support",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "API key", secret: true },
      { name: "domain", label: "Domain", placeholder: "yourcompany" },
    ],
    required: ["api_key", "domain"],
  },
  crisp: {
    key: "crisp",
    label: "Crisp",
    tag: "Support",
    category: "Support",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "API key", secret: true },
      { name: "api_identifier", label: "API identifier", placeholder: "identifier" },
      { name: "website_id", label: "Website ID", placeholder: "website_id" },
    ],
    required: ["api_key", "api_identifier", "website_id"],
  },

  // ── Auth ──
  firebaseauth: {
    key: "firebaseauth",
    label: "Firebase Auth",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    note: "Deletes the user by email via the Identity Toolkit Admin API.",
    fields: [
      { name: "project_id", label: "Project ID", placeholder: "my-project" },
      { name: "access_token", label: "OAuth2 access token", placeholder: "ya29...", secret: true },
    ],
    required: ["project_id", "access_token"],
  },
  okta: {
    key: "okta",
    label: "Okta",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    fields: [
      { name: "domain", label: "Domain", placeholder: "your-tenant.okta.com" },
      { name: "api_token", label: "API token", placeholder: "00abc...", secret: true },
    ],
    required: ["domain", "api_token"],
  },
  stytch: {
    key: "stytch",
    label: "Stytch",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    fields: [
      { name: "secret", label: "Project secret", placeholder: "project_secret", secret: true },
      { name: "project_id", label: "Project ID", placeholder: "project-test-..." },
    ],
    required: ["secret", "project_id"],
  },

  // ── Batch 2: built but hidden from clients until the owner releases ──
  // Databases
  turso: {
    key: "turso",
    label: "Turso",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes rows in the configured table matching the email (identifiers validated).",
    fields: [
      { name: "database_url", label: "Database URL", placeholder: "libsql://..." },
      { name: "auth_token", label: "Auth token", placeholder: "ey...", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["database_url", "auth_token", "table_name", "email_column"],
  },
  redis: {
    key: "redis",
    label: "Upstash Redis",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes keys matching the configured user/email pattern.",
    fields: [
      { name: "rest_url", label: "REST URL", placeholder: "https://...upstash.io" },
      { name: "rest_token", label: "REST token", placeholder: "token", secret: true },
      { name: "key_pattern", label: "Key pattern", placeholder: "users:*:email@example.com" },
    ],
    required: ["rest_url", "rest_token", "key_pattern"],
  },
  elasticsearch: {
    key: "elasticsearch",
    label: "Elasticsearch",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes documents matching the email across the configured indexes.",
    fields: [
      { name: "endpoint", label: "Endpoint", placeholder: "https://...:9200" },
      { name: "api_key", label: "API key", placeholder: "base64...", secret: true },
      { name: "index_names", label: "Index names", placeholder: "index1,index2" },
    ],
    required: ["endpoint", "api_key", "index_names"],
  },
  cassandra: {
    key: "cassandra",
    label: "Cassandra",
    tag: "Database",
    category: "Database",
    enabledByDefault: false,
    note: "Deletes rows in the configured table matching the email (identifiers validated).",
    fields: [
      { name: "contact_points", label: "Contact points", placeholder: "host:9042" },
      { name: "keyspace", label: "Keyspace", placeholder: "mykeyspace" },
      { name: "username", label: "Username", placeholder: "cassandra" },
      { name: "password", label: "Password", placeholder: "password", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["contact_points", "keyspace", "username", "password", "table_name", "email_column"],
  },

  // Auth providers
  workos: {
    key: "workos",
    label: "WorkOS",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    note: "Deletes the directory user matching the email (enterprise SSO).",
    fields: [
      { name: "api_key", label: "API key", placeholder: "sk_test_...", secret: true },
      { name: "directory_id", label: "Directory ID", placeholder: "dir_..." },
    ],
    required: ["api_key", "directory_id"],
  },
  passage: {
    key: "passage",
    label: "Passage (1Password)",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    fields: [
      { name: "app_id", label: "App ID", placeholder: "app_..." },
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
    ],
    required: ["app_id", "api_key"],
  },
  cognito: {
    key: "cognito",
    label: "AWS Cognito",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    fields: [
      { name: "access_key", label: "Access key ID", placeholder: "AKIA..." },
      { name: "secret_key", label: "Secret access key", placeholder: "secret", secret: true },
      { name: "region", label: "Region", placeholder: "us-east-1" },
      { name: "user_pool_id", label: "User pool ID", placeholder: "us-east-1_xxxx" },
    ],
    required: ["access_key", "secret_key", "region", "user_pool_id"],
  },
  keycloak: {
    key: "keycloak",
    label: "Keycloak",
    tag: "Auth",
    category: "Auth",
    enabledByDefault: false,
    note: "Deletes the user from the configured realm (self-hosted).",
    fields: [
      { name: "base_url", label: "Base URL", placeholder: "https://keycloak.example.com" },
      { name: "realm", label: "Realm", placeholder: "myrealm" },
      { name: "admin_username", label: "Admin username", placeholder: "admin" },
      { name: "admin_password", label: "Admin password", placeholder: "password", secret: true },
    ],
    required: ["base_url", "realm", "admin_username", "admin_password"],
  },

  // Email marketing
  brevo: {
    key: "brevo",
    label: "Brevo",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    note: "Deletes the contact from all lists (Brevo / ex-Sendinblue).",
    fields: [{ name: "api_key", label: "API key", placeholder: "xkeysib-...", secret: true }],
    required: ["api_key"],
  },
  omnisend: {
    key: "omnisend",
    label: "Omnisend",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "api_key", secret: true }],
    required: ["api_key"],
  },
  beehiiv: {
    key: "beehiiv",
    label: "Beehiiv",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "publication_id", label: "Publication ID", placeholder: "pub_..." },
    ],
    required: ["api_key", "publication_id"],
  },
  substack: {
    key: "substack",
    label: "Substack",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    note: "No public erasure API — deletion must be arranged with Substack support.",
    fields: [],
    required: [],
  },
  loops: {
    key: "loops",
    label: "Loops",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "loop_...", secret: true }],
    required: ["api_key"],
  },
  customerio: {
    key: "customerio",
    label: "Customer.io",
    tag: "Email",
    category: "Email",
    enabledByDefault: false,
    note: "Deletes the person and all attributes matching the email.",
    fields: [
      { name: "site_id", label: "Site ID", placeholder: "site_..." },
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
    ],
    required: ["site_id", "api_key"],
  },

  // Support & CRM
  linear: {
    key: "linear",
    label: "Linear",
    tag: "CRM",
    category: "CRM",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "lin_api_...", secret: true }],
    required: ["api_key"],
  },
  helpscout: {
    key: "helpscout",
    label: "Help Scout",
    tag: "Support",
    category: "Support",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "api_key", secret: true }],
    required: ["api_key"],
  },
  gorgias: {
    key: "gorgias",
    label: "Gorgias",
    tag: "Support",
    category: "Support",
    enabledByDefault: false,
    fields: [
      { name: "domain", label: "Domain", placeholder: "yourcompany" },
      { name: "email", label: "Account email", placeholder: "you@company.com" },
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
    ],
    required: ["domain", "email", "api_key"],
  },
  groove: {
    key: "groove",
    label: "Groove",
    tag: "Support",
    category: "Support",
    enabledByDefault: false,
    fields: [{ name: "access_token", label: "Access token", placeholder: "token", secret: true }],
    required: ["access_token"],
  },

  // Analytics
  smartlook: {
    key: "smartlook",
    label: "Smartlook",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "workspace_id", label: "Workspace ID", placeholder: "workspace_..." },
    ],
    required: ["api_key", "workspace_id"],
  },
  logrocket: {
    key: "logrocket",
    label: "LogRocket",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "app_id", label: "App ID", placeholder: "app_..." },
    ],
    required: ["api_key", "app_id"],
  },
  datadog: {
    key: "datadog",
    label: "Datadog",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    note: "Deletes the user record where addressable by email; log/trace retention is subject to Datadog's retention policies.",
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "app_key", label: "Application key", placeholder: "app_key", secret: true },
    ],
    required: ["api_key", "app_key"],
  },
  pendo: {
    key: "pendo",
    label: "Pendo",
    tag: "Analytics",
    category: "Analytics",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "app_id", label: "App ID", placeholder: "app_..." },
    ],
    required: ["api_key", "app_id"],
  },

  // Payments & billing
  lemonsqueezy: {
    key: "lemonsqueezy",
    label: "Lemon Squeezy",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "api_key", secret: true }],
    required: ["api_key"],
  },
  gumroad: {
    key: "gumroad",
    label: "Gumroad",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [{ name: "access_token", label: "Access token", placeholder: "token", secret: true }],
    required: ["access_token"],
  },
  zuora: {
    key: "zuora",
    label: "Zuora",
    tag: "Payments",
    category: "Payments",
    enabledByDefault: false,
    fields: [
      { name: "client_id", label: "Client ID", placeholder: "client_id" },
      { name: "client_secret", label: "Client secret", placeholder: "client_secret", secret: true },
    ],
    required: ["client_id", "client_secret"],
  },

  // Cloud storage
  awss3: {
    key: "awss3",
    label: "AWS S3",
    tag: "Storage",
    category: "Storage",
    enabledByDefault: false,
    note: "Deletes objects under the configured user prefix (never everything).",
    fields: [
      { name: "access_key", label: "Access key ID", placeholder: "AKIA..." },
      { name: "secret_key", label: "Secret access key", placeholder: "secret", secret: true },
      { name: "region", label: "Region", placeholder: "us-east-1" },
      { name: "bucket", label: "Bucket", placeholder: "my-bucket" },
      { name: "prefix_pattern", label: "Prefix pattern", placeholder: "users/email@example.com/" },
    ],
    required: ["access_key", "secret_key", "region", "bucket", "prefix_pattern"],
  },
  cloudflarer2: {
    key: "cloudflarer2",
    label: "Cloudflare R2",
    tag: "Storage",
    category: "Storage",
    enabledByDefault: false,
    note: "Deletes objects under the configured user prefix (S3-compatible).",
    fields: [
      { name: "account_id", label: "Account ID", placeholder: "account_id" },
      { name: "access_key", label: "Access key ID", placeholder: "AKIA..." },
      { name: "secret_key", label: "Secret access key", placeholder: "secret", secret: true },
      { name: "bucket", label: "Bucket", placeholder: "my-bucket" },
      { name: "prefix_pattern", label: "Prefix pattern", placeholder: "users/email@example.com/" },
    ],
    required: ["account_id", "access_key", "secret_key", "bucket", "prefix_pattern"],
  },
  googlecloudstorage: {
    key: "googlecloudstorage",
    label: "Google Cloud Storage",
    tag: "Storage",
    category: "Storage",
    enabledByDefault: false,
    note: "Deletes objects under the configured user prefix (never everything).",
    fields: [
      { name: "service_account_json", label: "Service account JSON", placeholder: "{...}", secret: true },
      { name: "bucket", label: "Bucket", placeholder: "my-bucket" },
      { name: "prefix_pattern", label: "Prefix pattern", placeholder: "users/email@example.com/" },
    ],
    required: ["service_account_json", "bucket", "prefix_pattern"],
  },
  vercelblob: {
    key: "vercelblob",
    label: "Vercel Blob",
    tag: "Storage",
    category: "Storage",
    enabledByDefault: false,
    note: "Deletes blobs under the configured user prefix (never everything).",
    fields: [
      { name: "api_token", label: "API token", placeholder: "token", secret: true },
      { name: "prefix_pattern", label: "Prefix pattern", placeholder: "users/email@example.com/" },
    ],
    required: ["api_token", "prefix_pattern"],
  },

  // Communication
  twilio: {
    key: "twilio",
    label: "Twilio",
    tag: "Communication",
    category: "Communication",
    enabledByDefault: false,
    note: "Deletes contacts addressable by email where present; SMS records are keyed by phone number.",
    fields: [
      { name: "account_sid", label: "Account SID", placeholder: "AC..." },
      { name: "auth_token", label: "Auth token", placeholder: "auth_token", secret: true },
    ],
    required: ["account_sid", "auth_token"],
  },
  vonage: {
    key: "vonage",
    label: "Vonage",
    tag: "Communication",
    category: "Communication",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key" },
      { name: "api_secret", label: "API secret", placeholder: "api_secret", secret: true },
    ],
    required: ["api_key", "api_secret"],
  },
  plivo: {
    key: "plivo",
    label: "Plivo",
    tag: "Communication",
    category: "Communication",
    enabledByDefault: false,
    fields: [
      { name: "auth_id", label: "Auth ID", placeholder: "auth_id" },
      { name: "auth_token", label: "Auth token", placeholder: "auth_token", secret: true },
    ],
    required: ["auth_id", "auth_token"],
  },

  // Other SaaS
  notion: {
    key: "notion",
    label: "Notion",
    tag: "Other",
    category: "Other",
    enabledByDefault: false,
    note: "Archives pages containing the email found via the integration's accessible resources.",
    fields: [{ name: "integration_token", label: "Integration token", placeholder: "secret_...", secret: true }],
    required: ["integration_token"],
  },
  airtable: {
    key: "airtable",
    label: "Airtable",
    tag: "Other",
    category: "Other",
    enabledByDefault: false,
    note: "Deletes records matching the email across the configured tables.",
    fields: [
      { name: "api_key", label: "API key", placeholder: "pat...", secret: true },
      { name: "base_id", label: "Base ID", placeholder: "app..." },
      { name: "table_ids", label: "Table IDs", placeholder: "Table1,Table2" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["api_key", "base_id", "table_ids", "email_column"],
  },
  webflow: {
    key: "webflow",
    label: "Webflow",
    tag: "Other",
    category: "Other",
    enabledByDefault: false,
    fields: [
      { name: "api_token", label: "API token", placeholder: "api_token", secret: true },
      { name: "site_id", label: "Site ID", placeholder: "site_..." },
    ],
    required: ["api_token", "site_id"],
  },
  memberstack: {
    key: "memberstack",
    label: "Memberstack",
    tag: "Other",
    category: "Other",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "app_id", label: "App ID", placeholder: "app_..." },
    ],
    required: ["api_key", "app_id"],
  },
  outseta: {
    key: "outseta",
    label: "Outseta",
    tag: "Other",
    category: "Other",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "api_key", secret: true }],
    required: ["api_key"],
  },

  // Marketing & advertising
  braze: {
    key: "braze",
    label: "Braze",
    tag: "Marketing",
    category: "Marketing",
    enabledByDefault: false,
    fields: [
      { name: "api_key", label: "API key", placeholder: "api_key", secret: true },
      { name: "instance_url", label: "Instance URL", placeholder: "https://rest.iad-01.braze.com" },
    ],
    required: ["api_key", "instance_url"],
  },
  iterable: {
    key: "iterable",
    label: "Iterable",
    tag: "Marketing",
    category: "Marketing",
    enabledByDefault: false,
    fields: [{ name: "api_key", label: "API key", placeholder: "api_key", secret: true }],
    required: ["api_key"],
  },
  vero: {
    key: "vero",
    label: "Vero",
    tag: "Marketing",
    category: "Marketing",
    enabledByDefault: false,
    fields: [{ name: "auth_token", label: "Auth token", placeholder: "token", secret: true }],
    required: ["auth_token"],
  },
};

export const ALL_CONNECTOR_META = Object.values(CONNECTOR_META);
