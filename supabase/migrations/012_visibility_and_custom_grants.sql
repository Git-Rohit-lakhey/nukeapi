-- 012_visibility_and_custom_grants.sql
-- 1) Add a `hidden` flag to connector_flags. A hidden connector is admin-only:
--    it never appears in the client connector picker, the marketing site, or
--    the docs, and cannot be run by normal users. The owner releases it with a
--    single "Live" toggle that sets (enabled, hidden) = (true, false); turning
--    it off sets (false, true). Default false so the 38 existing connectors
--    stay visible exactly as before.
-- 2) New `custom_connector_grants` table: lets the owner enable a BUILT
--    connector for ONE specific enterprise user without making it globally live
--    or surfacing it to any other client or the public site.
-- 3) Seed the 40 newly-built connectors as BUILT BUT HIDDEN (enabled=false,
--    hidden=true). All rows are on conflict do nothing so re-running is safe.

alter table if exists public.connector_flags
  add column if not exists hidden boolean not null default false;

-- ── Per-user custom (enterprise) integration grants ──
create table if not exists public.custom_connector_grants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  integration text not null,
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, integration)
);

alter table public.custom_connector_grants enable row level security;
-- Users may see their own grants (used by the dashboard). All writes happen
-- through the owner-only admin API via the service-role client.
create policy "custom grants self read" on public.custom_connector_grants
  for select using (auth.uid() = user_id);

insert into public.connector_flags (integration, enabled, hidden, category) values
  -- Databases
  ('turso',         false, true, 'Database'),
  ('redis',         false, true, 'Database'),
  ('elasticsearch', false, true, 'Database'),
  ('cassandra',     false, true, 'Database'),
  -- Auth providers
  ('workos',        false, true, 'Auth'),
  ('passage',       false, true, 'Auth'),
  ('cognito',       false, true, 'Auth'),
  ('keycloak',      false, true, 'Auth'),
  -- Email marketing
  ('brevo',         false, true, 'Email'),
  ('omnisend',      false, true, 'Email'),
  ('beehiiv',       false, true, 'Email'),
  ('substack',      false, true, 'Email'),
  ('loops',         false, true, 'Email'),
  ('customerio',    false, true, 'Email'),
  -- Support & CRM
  ('linear',        false, true, 'CRM'),
  ('helpscout',     false, true, 'Support'),
  ('gorgias',       false, true, 'Support'),
  ('groove',        false, true, 'Support'),
  -- Analytics
  ('smartlook',     false, true, 'Analytics'),
  ('logrocket',     false, true, 'Analytics'),
  ('datadog',       false, true, 'Analytics'),
  ('pendo',         false, true, 'Analytics'),
  -- Payments & billing
  ('lemonsqueezy',  false, true, 'Payments'),
  ('gumroad',       false, true, 'Payments'),
  ('zuora',         false, true, 'Payments'),
  -- Cloud storage
  ('awss3',              false, true, 'Storage'),
  ('cloudflarer2',       false, true, 'Storage'),
  ('googlecloudstorage', false, true, 'Storage'),
  ('vercelblob',         false, true, 'Storage'),
  -- Communication
  ('twilio',        false, true, 'Communication'),
  ('vonage',        false, true, 'Communication'),
  ('plivo',         false, true, 'Communication'),
  -- Other SaaS
  ('notion',        false, true, 'Other'),
  ('airtable',      false, true, 'Other'),
  ('webflow',       false, true, 'Other'),
  ('memberstack',   false, true, 'Other'),
  ('outseta',       false, true, 'Other'),
  -- Marketing & advertising
  ('braze',         false, true, 'Marketing'),
  ('iterable',      false, true, 'Marketing'),
  ('vero',          false, true, 'Marketing')
on conflict (integration) do nothing;
