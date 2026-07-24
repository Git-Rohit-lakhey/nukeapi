-- 014_enterprise_sso.sql
-- Enterprise-only SAML / SSO configuration. Backs the Enterprise "SSO / SAML"
-- feature. Stores the Identity Provider (IdP) metadata an Enterprise customer
-- supplies so their team can log in via their own IdP (Okta, Azure AD /
-- Entra, Google Workspace, etc.).
--
-- The actual SAML assertion exchange is performed by the SSO routes
-- (app/api/sso/*); this table is only the per-account configuration. All
-- writes happen through the Enterprise-gated admin/settings API via the
-- service-role client. The account owner may READ their own config.

create table if not exists public.enterprise_sso (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  idp_entity_id  text,
  sso_login_url  text not null,                 -- IdP SSO / SAML ACS URL
  x509_cert      text not null,                 -- IdP signing certificate (PEM)
  domain         text,                          -- email domain this IdP serves
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists enterprise_sso_user_idx
  on public.enterprise_sso (user_id);

alter table public.enterprise_sso enable row level security;

-- Account owner may read their own SSO config (used by the settings UI).
create policy "enterprise_sso owner read" on public.enterprise_sso
  for select using (auth.uid() = user_id);
-- The service-role client writes (Enterprise-gated API); no public write path.
