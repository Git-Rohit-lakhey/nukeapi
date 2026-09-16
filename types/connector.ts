export type Integration = "stripe" | "mailchimp" | "hubspot" | "intercom" | "supabase" | "postgresql";

export const ALL_INTEGRATIONS: Integration[] = [
  "stripe",
  "mailchimp",
  "hubspot",
  "intercom",
  "supabase",
  "postgresql",
] as const;

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

export type ConnectorCredentialsMap = {
  stripe: StripeCredentials;
  mailchimp: MailchimpCredentials;
  hubspot: HubSpotCredentials;
  intercom: IntercomCredentials;
  supabase: SupabaseTargetCredentials;
  postgresql: PostgresqlCredentials;
};

export type AnyConnectorCredentials = ConnectorCredentialsMap[Integration];

/** AES-256-GCM envelope stored in connector_credentials.credentials. */
export interface EncryptedEnvelope {
  v: 1;
  alg: "AES-256-GCM";
  iv: string;
  tag: string;
  data: string;
}
