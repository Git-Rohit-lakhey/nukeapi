-- 006_keepalive.sql
-- Health ping for Supabase free-tier keepalive cron (/api/cron/keepalive).
-- Written by the cron route (service role). No RLS — only the cron secret
-- gates writes, and the row is not user-specific.

create table if not exists public.keepalive_log (
  id bigserial primary key,
  pinged_at timestamptz not null default now(),
  status text not null
);
