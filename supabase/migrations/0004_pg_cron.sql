-- 0004_pg_cron.sql
-- Recurring Data Refresh (Feature 0004) — Phase 1 of 4.
--
-- Apply manually (do NOT auto-run from this repo):
--   Option A (Supabase CLI, run from repo root):
--     supabase db push
--   Option B (SQL editor):
--     Paste the contents of this file into the Supabase project's SQL editor and run.
--   Option C (preferred for this hackathon):
--     Apply via the Supabase MCP tool `apply_migration`.
--
-- This migration is idempotent: safe to re-run on a partially migrated database.
-- The cron.schedule(...) call at the bottom is intentionally commented out — the
-- operator must substitute the real <SUPABASE_URL> and <SERVICE_ROLE_KEY> and run
-- it manually in the SQL editor (secrets must never be committed to git).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- pg_cron: schedules SQL jobs (e.g. weekly refresh-jobs invocation).
create extension if not exists pg_cron;

-- pg_net: required by pg_cron's net.http_post (used to call Edge Functions).
create extension if not exists pg_net;

-- Ensure the postgres role can use the cron schema (Supabase grants this by
-- default on most projects; included here as a safeguard).
grant usage on schema cron to postgres;

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

-- Tracks the last time the refresh-jobs Edge Function successfully polled this
-- company's ATS feed. Nullable: companies that have never been refreshed (or
-- have no ATS) are left as NULL.
alter table map_startups
  add column if not exists jobs_refreshed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Cron schedule (MANUAL STEP — operator must run this after migration applies)
-- ---------------------------------------------------------------------------
--
-- Substitute <SUPABASE_URL> with the project URL (e.g. https://xxxx.supabase.co)
-- and <SERVICE_ROLE_KEY> with the project's service_role key, then paste into
-- the Supabase SQL editor and run. The cron expression '0 6 * * 1' fires every
-- Monday at 06:00 UTC.
--
-- select cron.schedule(
--   'refresh-jobs-weekly',
--   '0 6 * * 1',
--   $$
--   select net.http_post(
--     url := '<SUPABASE_URL>/functions/v1/refresh-jobs',
--     headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
--     body := '{}'::jsonb
--   ) as request_id;
--   $$
-- );
--
-- To unschedule later:
--   select cron.unschedule('refresh-jobs-weekly');
