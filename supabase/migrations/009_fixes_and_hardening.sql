-- 009_fixes_and_hardening.sql
-- Additional correctness/hardening baked in from day one (Section 6).
--
-- 6.5 — Webhook user lookup must not be limited to the Admin API's first
-- page. We expose a direct, security-definer lookup against auth.users so the
-- Dodo webhook can resolve the internal user id for ANY customer, regardless
-- of how many users exist (no 50-user page limit).

create or replace function public.user_id_by_email(p_email text)
returns uuid language sql security definer as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

grant execute on function public.user_id_by_email(text) to service_role;

-- Indexes to keep common dashboard/owner queries fast.
create index if not exists deletion_requests_status_idx
  on public.deletion_requests (status, created_at desc);

create index if not exists api_keys_user_active_idx
  on public.api_keys (user_id, is_active);

-- Revoke direct public access to the lookup (service_role only).
revoke all on function public.user_id_by_email(text) from public, anon;
