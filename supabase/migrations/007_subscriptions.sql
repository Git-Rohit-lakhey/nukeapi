-- 007_subscriptions.sql
-- Billing plans synced from Dodo webhooks. The plan CHECK constraint MUST
-- match the slugs in lib/constants/compliance.ts (see 6.2) — a mismatch
-- silently rejects every real paying customer's upgrade at the DB level.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null check (plan in (
    'free','startup','startup_yearly',
    'business','business_yearly',
    'enterprise','enterprise_yearly'
  )),
  status text not null check (status in ('active','cancelled','past_due')),
  external_subscription_id text,        -- Dodo subscription id — required to cancel later
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_external_idx
  on public.subscriptions (external_subscription_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions owner read" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "subscriptions owner update" on public.subscriptions
  for update using (auth.uid() = user_id);

-- Seed a 'free' subscription row for every new user so limits/metering have
-- a deterministic baseline (no subscription row => treat as free in code too,
-- but this keeps dashboards and joins consistent).
create or replace function public.handle_new_user_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_subscription on auth.users;
create trigger on_auth_user_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_user_subscription();
