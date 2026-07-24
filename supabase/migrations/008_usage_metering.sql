-- 008_usage_metering.sql
-- Per-billing-period deletion counts. Increments go through the atomic
-- increment_usage() RPC (see 6.7) — never a SELECT-then-INSERT/UPDATE in
-- application code, which races under concurrent deletions.

create table if not exists public.usage_meters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  deletion_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index if not exists usage_meters_user_idx
  on public.usage_meters (user_id, period_start desc);

alter table public.usage_meters enable row level security;

create policy "usage_meters owner read" on public.usage_meters
  for select using (auth.uid() = user_id);

-- Atomic increment. Called via supabaseAdmin.rpc('increment_usage', ...).
-- security definer so it can write even when invoked from a service-role
-- context; explicit auth check is performed in the RPC caller.
create or replace function public.increment_usage(
  p_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
) returns void language plpgsql security definer as $$
begin
  insert into public.usage_meters (user_id, period_start, period_end, deletion_count)
  values (p_user_id, p_period_start::date, p_period_end::date, 1)
  on conflict (user_id, period_start)
  do update set deletion_count = public.usage_meters.deletion_count + 1,
                updated_at = now();
end;
$$;
