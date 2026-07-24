-- 001_api_keys.sql
-- API keys for /api/v1/* authentication.
-- We store BOTH a bcrypt hash (for verification) and a deterministic
-- SHA-256 key_lookup_hash (for a fast, indexed equality lookup — see 6.4).
-- The raw key is returned to the user exactly once at creation time and
-- never stored.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null,              -- bcrypt hash (cost >= 10)
  key_prefix text not null,            -- first chars of raw key, for display
  key_lookup_hash text unique,         -- SHA-256 of raw key (indexed lookup)
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Critical: the lookup must be a unique, indexed equality scan — never a
-- full table scan over bcrypt hashes (those are salted and non-comparable).
create unique index if not exists api_keys_lookup_hash_idx
  on public.api_keys (key_lookup_hash)
  where key_lookup_hash is not null;

alter table public.api_keys enable row level security;

create policy "api_keys owner read" on public.api_keys
  for select using (auth.uid() = user_id);

create policy "api_keys owner insert" on public.api_keys
  for insert with check (auth.uid() = user_id);

create policy "api_keys owner update" on public.api_keys
  for update using (auth.uid() = user_id);

create policy "api_keys owner delete" on public.api_keys
  for delete using (auth.uid() = user_id);
