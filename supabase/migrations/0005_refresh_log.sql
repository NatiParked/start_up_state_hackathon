-- 0005_refresh_log.sql
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

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- Audit log for every refresh-jobs invocation (cron, manual admin button, or
-- one-off). One row per company per run (or one bulk row when startup_id is null).
create table if not exists map_refresh_log (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid references map_startups(id),
  run_at timestamptz not null default now(),
  source text not null check (source in ('cron', 'manual', 'admin')),
  success boolean not null,
  error_message text,
  jobs_updated int default 0
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Lookup all refresh attempts for a given company.
create index if not exists map_refresh_log_startup_id_idx
  on map_refresh_log (startup_id);

-- Admin "recent activity" queries: most recent runs first.
create index if not exists map_refresh_log_run_at_desc_idx
  on map_refresh_log (run_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table map_refresh_log enable row level security;

-- No anon/authenticated read or write. Only the service_role (used by the
-- refresh-jobs Edge Function and any admin server route) can access this
-- table. This is achieved by enabling RLS without adding any policies for
-- anon/authenticated, and adding an explicit service_role select policy for
-- documentation/clarity (service_role bypasses RLS by default, but the
-- explicit policy makes intent obvious to future readers).
drop policy if exists map_refresh_log_service_role_select on map_refresh_log;
create policy map_refresh_log_service_role_select
  on map_refresh_log
  for select
  to service_role
  using (true);
