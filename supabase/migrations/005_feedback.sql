-- 005_feedback.sql
-- Simple bug/feedback reports. user_id may be null for anonymous guests.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback insert" on public.feedback
  for insert with check (true);

create policy "feedback owner read" on public.feedback
  for select using (auth.uid() = user_id);
