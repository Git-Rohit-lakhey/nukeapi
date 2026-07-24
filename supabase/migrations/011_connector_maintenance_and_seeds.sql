-- 011_connector_maintenance_and_seeds.sql
-- 1) Add a per-connector MAINTENANCE flag. While maintenance is on, the
--    connector is treated exactly like a disabled one by end users (cannot be
--    connected or run), but the owner can flip it back instantly from the admin
--    UI without a deploy. See lib/connectors/flags.ts (getUsableIntegrationSet).
-- 2) Seed the 23 additional connectors built in this release. They ship
--    BUILT BUT DISABLED — the owner enables them one-by-one from the admin UI.
--    Every row is on conflict do nothing so re-running the migration is safe.

alter table if exists public.connector_flags
  add column if not exists maintenance boolean not null default false;

-- Make sure the admin_audit table exists (created in 010; guard for safety).
create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor_id    uuid references auth.users(id) on delete set null,
  target      text,
  before      jsonb default '{}',
  after       jsonb default '{}',
  created_at  timestamptz not null default now()
);

insert into public.connector_flags (integration, enabled, maintenance, category) values
  -- Databases
  ('mysql',        false, false, 'Database'),
  ('planetscale',  false, false, 'Database'),
  ('neon',         false, false, 'Database'),
  ('mongodb',      false, false, 'Database'),
  ('firestore',    false, false, 'Database'),
  -- Email
  ('convertkit',   false, false, 'Email'),
  ('activecampaign', false, false, 'Email'),
  ('resend',       false, false, 'Email'),
  ('drip',         false, false, 'Email'),
  -- Analytics
  ('amplitude',    false, false, 'Analytics'),
  ('fullstory',    false, false, 'Analytics'),
  ('heap',         false, false, 'Analytics'),
  ('june',         false, false, 'Analytics'),
  -- Payments
  ('paddle',       false, false, 'Payments'),
  ('chargebee',    false, false, 'Payments'),
  ('recurly',      false, false, 'Payments'),
  ('braintree',    false, false, 'Payments'),
  -- CRM / Support
  ('pipedrive',    false, false, 'CRM'),
  ('freshdesk',    false, false, 'Support'),
  ('crisp',        false, false, 'Support'),
  -- Auth
  ('firebaseauth', false, false, 'Auth'),
  ('okta',         false, false, 'Auth'),
  ('stytch',       false, false, 'Auth')
on conflict (integration) do nothing;
