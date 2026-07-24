-- 010_connector_flags.sql
-- Per-connector availability feature flags, owner-controlled.
--
-- A connector is usable by end users ONLY when its flag is enabled AND the
-- user's plan allows it. The 6 originally-shipped connectors ship ENABLED;
-- the 9 newer connectors ship built but DISABLED until the owner enables
-- them in the admin UI. Every toggle is audited in admin_audit.
--
-- Not user-owned: reads happen via service-role server routes. Public read of
-- availability is allowed (no sensitive data); writes are service-role only
-- (the admin API double-checks OWNER_EMAILS before calling setConnectorFlag).

create table if not exists public.connector_flags (
  integration  text primary key,
  enabled      boolean not null default false,
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

-- Seed default availability. The 6 originally-shipped connectors are on;
-- the 9 newer connectors are off until explicitly enabled.
insert into public.connector_flags (integration, enabled, category) values
  ('stripe',     true,  'Payments'),
  ('mailchimp',  true,  'Email'),
  ('hubspot',    true,  'CRM'),
  ('intercom',   true,  'Support'),
  ('supabase',   true,  'Database'),
  ('postgresql', true,  'Database'),
  ('salesforce', false, 'CRM'),
  ('segment',    false, 'CDP'),
  ('klaviyo',    false, 'Email'),
  ('sendgrid',   false, 'Email'),
  ('auth0',      false, 'Auth'),
  ('clerk',      false, 'Auth'),
  ('posthog',    false, 'Analytics'),
  ('zendesk',    false, 'Support'),
  ('mixpanel',   false, 'Analytics')
on conflict (integration) do nothing;

-- Public availability read (no sensitive data). Writes are service-role only
-- and performed exclusively through the admin API, never from the client.
alter table public.connector_flags enable row level security;
create policy "connector_flags public read" on public.connector_flags
  for select using (true);

-- admin_audit is owner-only; no public policies (service role bypasses RLS).
alter table public.admin_audit enable row level security;
