-- 002_deletion_requests.sql
-- One row per deletion call. status is derived from per-integration results.

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  subject_email text not null,
  subject_external_id text,
  integrations_requested text[] not null,
  integrations_completed text[],
  integrations_failed text[],
  status text not null
    check (status in ('pending','completed','partial','failed')),
  audit_signature text,                -- HMAC-SHA256 over the canonical result (6.6)
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists deletion_requests_user_id_idx
  on public.deletion_requests (user_id, created_at desc);

alter table public.deletion_requests enable row level security;

create policy "deletion_requests owner read" on public.deletion_requests
  for select using (auth.uid() = user_id);

create policy "deletion_requests owner insert" on public.deletion_requests
  for insert with check (auth.uid() = user_id);
