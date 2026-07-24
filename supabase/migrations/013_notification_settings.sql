-- 013_notification_settings.sql
-- Per-user completion-notification configuration. Backs the Startup+ "Webhook
-- callbacks" and Business+ "Slack & email alerts" features promised on the
-- pricing page. A single row per user; all columns nullable. URLs are stored
-- as-is and RE-VALIDATED (https-only, host-allowlisted-optional) in the API
-- route before they are ever used — the database only enforces ownership.
--
-- NOTE: this is intentionally a SEPARATE table from `profiles` so notification
-- config can evolve without touching the auth/profile row, and so RLS here is
-- strictly owner-scoped (no admin/service-role write is required for normal use).

create table if not exists public.notification_settings (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  webhook_url       text,
  slack_webhook_url text,
  email_alerts      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists notification_settings_user_idx
  on public.notification_settings (user_id);

alter table public.notification_settings enable row level security;

-- The row is keyed by the user themselves, so owner-only read/write is enough.
create policy "notification_settings owner read" on public.notification_settings
  for select using (auth.uid() = user_id);
create policy "notification_settings owner insert" on public.notification_settings
  for insert with check (auth.uid() = user_id);
create policy "notification_settings owner update" on public.notification_settings
  for update using (auth.uid() = user_id);
