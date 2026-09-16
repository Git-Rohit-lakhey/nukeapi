-- 004_connector_credentials.sql
-- Encrypted connector credentials. The browser NEVER writes here directly
-- (see 6.1): the server route /api/v1/connectors/save encrypts with
-- AES-256-GCM using a server-only key before insert. The jsonb column holds
-- an envelope {v,iv,tag,data} — never plaintext.

create table if not exists public.connector_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration text not null,
  credentials jsonb not null
    check (
      jsonb_typeof(credentials) = 'object'
      and credentials ? 'v'
      and credentials ? 'iv'
      and credentials ? 'tag'
      and credentials ? 'data'
    ),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, integration)
);

create index if not exists connector_credentials_user_idx
  on public.connector_credentials (user_id, integration);

alter table public.connector_credentials enable row level security;

create policy "connector_credentials owner all" on public.connector_credentials
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
