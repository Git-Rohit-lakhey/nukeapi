-- 003_audit_logs.sql
-- Per-integration outcome rows that back the signed PDF audit trail.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  deletion_request_id uuid not null
    references public.deletion_requests(id) on delete cascade,
  integration text not null,
  status text not null check (status in ('success','failed','skipped')),
  message text,
  error_detail text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_request_id_idx
  on public.audit_logs (deletion_request_id);

alter table public.audit_logs enable row level security;

-- Owners can read audit rows for their own requests (join through parent).
create policy "audit_logs owner read" on public.audit_logs
  for select using (
    exists (
      select 1 from public.deletion_requests dr
      where dr.id = audit_logs.deletion_request_id
        and dr.user_id = auth.uid()
    )
  );
