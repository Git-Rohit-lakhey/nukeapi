-- 015_custom_connectors.sql
-- Business+ feature: user-defined HTTP connectors. Lets users connect any
-- REST API by defining a find→delete spec from the dashboard. The spec is
-- encrypted (AES-256-GCM) before storage, same as connector_credentials.
--
-- Security:
--   - RLS scoped to auth.uid() = user_id (owner-only)
--   - Spec stored encrypted, decrypted server-side only
--   - Business+ tier enforced in the API route, not here
--   - Base URL validated for SSRF before storage (no localhost/private IPs)
--   - All identifier-like fields validated against strict regex

create table if not exists public.custom_connectors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,                      -- user-given label, e.g. "My Internal API"
  slug            text not null,                      -- machine key, e.g. "my_internal_api" (unique per user)
  spec            jsonb not null,                     -- ENCRYPTED HttpSpec envelope {v,iv,tag,data}
  credentials     jsonb not null,                     -- ENCRYPTED credentials envelope
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, slug)
);

-- Fast lookup by user_id for the connectors page.
create index if not exists custom_connectors_user_idx
  on public.custom_connectors (user_id);

alter table public.custom_connectors enable row level security;

-- Owner-only access (read + write via service-role API).
create policy "custom_connectors owner read" on public.custom_connectors
  for select using (auth.uid() = user_id);
create policy "custom_connectors owner insert" on public.custom_connectors
  for insert with check (auth.uid() = user_id);
create policy "custom_connectors owner update" on public.custom_connectors
  for update using (auth.uid() = user_id);
create policy "custom_connectors owner delete" on public.custom_connectors
  for delete using (auth.uid() = user_id);
