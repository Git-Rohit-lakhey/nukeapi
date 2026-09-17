-- 010_connector_flags.sql
-- Per-connector availability feature flags, owner-controlled.
-- (Squashed port of v1 migrations 010 + 011 + 012.)
--
-- A connector is usable by end users ONLY when its flag is enabled AND not
-- hidden AND not in maintenance AND the user's plan allows it. The 6 core
-- connectors ship ENABLED; batch-1 catalog entries ship built-but-OFF
-- (visible); batch-2 entries ship built-but-HIDDEN (admin-only) until the
-- owner releases them from /owner. Every toggle is audited in admin_audit.
--
-- Not user-owned: reads happen via service-role server routes. Public read of
-- availability is allowed (no sensitive data); writes are service-role only
-- (the admin API double-checks OWNER_EMAILS before writing).

create table if not exists public.connector_flags (
  integration  text primary key,
  enabled      boolean not null default false,
  hidden       boolean not null default false,
  maintenance  boolean not null default false,
  category     text not null default 'general',
  toggled_by   uuid references auth.users(id) on delete set null,
  toggled_at   timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Audit trail for admin actions (e.g. connector toggles): who, what, when.
create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor_id    uuid references auth.users(id) on delete set null,
  target      text,
  before      jsonb default '{}',
  after       jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- Per-user custom (enterprise) integration grants. Lets the owner enable a
-- connector for ONE specific user without making it globally live. Reserved
-- for the phase when non-core executors ship; created now so the table
-- exists before any code writes to it.
create table if not exists public.custom_connector_grants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  integration text not null,
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, integration)
);

-- Seed default availability. The 6 core connectors are on; everything else
-- is off until explicitly enabled by the owner.
insert into public.connector_flags (integration, enabled, hidden, maintenance, category) values
  ('stripe',     true,  false, false, 'Payments'),
  ('mailchimp',  true,  false, false, 'Email'),
  ('hubspot',    true,  false, false, 'CRM'),
  ('intercom',   true,  false, false, 'Support'),
  ('supabase',   true,  false, false, 'Database'),
  ('postgresql', true,  false, false, 'Database'),
  -- Batch 1: visible but off
  ('salesforce', false, false, false, 'CRM'),
  ('segment',    false, false, false, 'CDP'),
  ('klaviyo',    false, false, false, 'Email'),
  ('sendgrid',   false, false, false, 'Email'),
  ('auth0',      false, false, false, 'Auth'),
  ('clerk',      false, false, false, 'Auth'),
  ('posthog',    false, false, false, 'Analytics'),
  ('zendesk',    false, false, false, 'Support'),
  ('mixpanel',   false, false, false, 'Analytics'),
  ('mysql',        false, false, false, 'Database'),
  ('planetscale',  false, false, false, 'Database'),
  ('neon',         false, false, false, 'Database'),
  ('mongodb',      false, false, false, 'Database'),
  ('firestore',    false, false, false, 'Database'),
  ('convertkit',   false, false, false, 'Email'),
  ('activecampaign', false, false, false, 'Email'),
  ('resend',       false, false, false, 'Email'),
  ('drip',         false, false, false, 'Email'),
  ('amplitude',    false, false, false, 'Analytics'),
  ('fullstory',    false, false, false, 'Analytics'),
  ('heap',         false, false, false, 'Analytics'),
  ('june',         false, false, false, 'Analytics'),
  ('paddle',       false, false, false, 'Payments'),
  ('chargebee',    false, false, false, 'Payments'),
  ('recurly',      false, false, false, 'Payments'),
  ('braintree',    false, false, false, 'Payments'),
  ('pipedrive',    false, false, false, 'CRM'),
  ('freshdesk',    false, false, false, 'Support'),
  ('crisp',        false, false, false, 'Support'),
  ('firebaseauth', false, false, false, 'Auth'),
  ('okta',         false, false, false, 'Auth'),
  ('stytch',       false, false, false, 'Auth'),
  -- Batch 2: hidden (admin-only) until released
  ('turso',         false, true, false, 'Database'),
  ('redis',         false, true, false, 'Database'),
  ('elasticsearch', false, true, false, 'Database'),
  ('cassandra',     false, true, false, 'Database'),
  ('workos',        false, true, false, 'Auth'),
  ('passage',       false, true, false, 'Auth'),
  ('cognito',       false, true, false, 'Auth'),
  ('keycloak',      false, true, false, 'Auth'),
  ('brevo',         false, true, false, 'Email'),
  ('omnisend',      false, true, false, 'Email'),
  ('beehiiv',       false, true, false, 'Email'),
  ('substack',      false, true, false, 'Email'),
  ('loops',         false, true, false, 'Email'),
  ('customerio',    false, true, false, 'Email'),
  ('linear',        false, true, false, 'CRM'),
  ('helpscout',     false, true, false, 'Support'),
  ('gorgias',       false, true, false, 'Support'),
  ('groove',        false, true, false, 'Support'),
  ('smartlook',     false, true, false, 'Analytics'),
  ('logrocket',     false, true, false, 'Analytics'),
  ('datadog',       false, true, false, 'Analytics'),
  ('pendo',         false, true, false, 'Analytics'),
  ('lemonsqueezy',  false, true, false, 'Payments'),
  ('gumroad',       false, true, false, 'Payments'),
  ('zuora',         false, true, false, 'Payments'),
  ('awss3',              false, true, false, 'Storage'),
  ('cloudflarer2',       false, true, false, 'Storage'),
  ('googlecloudstorage', false, true, false, 'Storage'),
  ('vercelblob',         false, true, false, 'Storage'),
  ('twilio',        false, true, false, 'Communication'),
  ('vonage',        false, true, false, 'Communication'),
  ('plivo',         false, true, false, 'Communication'),
  ('notion',        false, true, false, 'Other'),
  ('airtable',      false, true, false, 'Other'),
  ('webflow',       false, true, false, 'Other'),
  ('memberstack',   false, true, false, 'Other'),
  ('outseta',       false, true, false, 'Other'),
  ('braze',         false, true, false, 'Marketing'),
  ('iterable',      false, true, false, 'Marketing'),
  ('vero',          false, true, false, 'Marketing')
on conflict (integration) do nothing;

-- Public availability read (no sensitive data). Writes are service-role only
-- and performed exclusively through the admin API, never from the client.
alter table public.connector_flags enable row level security;
drop policy if exists "connector_flags public read" on public.connector_flags;
create policy "connector_flags public read" on public.connector_flags
  for select using (true);

-- admin_audit is owner-only; no public policies (service role bypasses RLS).
alter table public.admin_audit enable row level security;

-- Users may see their own custom grants (used by the dashboard). All writes
-- happen through the owner-only admin API via the service-role client.
alter table public.custom_connector_grants enable row level security;
drop policy if exists "custom grants self read" on public.custom_connector_grants;
create policy "custom grants self read" on public.custom_connector_grants
  for select using (auth.uid() = user_id);
