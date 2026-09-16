import type { Integration } from "@/types/connector";

export interface ConnectorFieldDef {
  name: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

export interface ConnectorMeta {
  key: Integration;
  label: string;
  tag: string;
  category: string;
  fields: ConnectorFieldDef[];
  required: string[];
  note?: string;
}

export const CONNECTOR_META: Record<Integration, ConnectorMeta> = {
  stripe: {
    key: "stripe",
    label: "Stripe",
    tag: "Payments",
    category: "Payments",
    fields: [{ name: "secret_key", label: "Secret key", placeholder: "sk_live_...", secret: true }],
    required: ["secret_key"],
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
  },
  hubspot: {
    key: "hubspot",
    label: "HubSpot",
    tag: "CRM",
    category: "CRM",
    fields: [{ name: "access_token", label: "Private app token", placeholder: "pat-...", secret: true }],
    required: ["access_token"],
  },
  intercom: {
    key: "intercom",
    label: "Intercom",
    tag: "Support",
    category: "Support",
    fields: [{ name: "access_token", label: "Access token", placeholder: "dG...", secret: true }],
    required: ["access_token"],
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
  },
  postgresql: {
    key: "postgresql",
    label: "PostgreSQL",
    tag: "Database",
    category: "Database",
    note: "Direct database connector — table and column names are validated before use.",
    fields: [
      { name: "connection_string", label: "Connection string", placeholder: "postgres://...", secret: true },
      { name: "table_name", label: "Table name", placeholder: "users" },
      { name: "email_column", label: "Email column", placeholder: "email" },
    ],
    required: ["connection_string", "table_name", "email_column"],
  },
};

export const ALL_CONNECTOR_META = Object.values(CONNECTOR_META);
