-- 016_trial_support.sql
-- Add free-trial support: a 'trialing' status and a trial_ends_at timestamp.
-- Users on a trial get full plan features for 14 days, no credit card required.
-- After trial_ends_at passes, the metering layer downgrades them to 'free'.

-- Expand the status CHECK to include 'trialing'
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active','cancelled','past_due','trialing'));

-- Add trial end timestamp (null = not on trial)
alter table public.subscriptions add column if not exists trial_ends_at timestamptz;
