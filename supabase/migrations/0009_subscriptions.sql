-- 0009_subscriptions.sql
-- Subscriptions and digest-run tables for the Utah Startup Map AI digest, Feature 0007 Phase 1.
--
-- Apply manually (do NOT auto-run from this repo):
--   Option A (Supabase CLI, run from repo root):
--     supabase db push
--   Option B (SQL editor):
--     Paste the contents of this file into the Supabase project's SQL editor and run.
--
-- All Map product tables MUST be prefixed with map_ (project convention).
-- This migration is idempotent: safe to re-run on a partially migrated database.

-- ---------------------------------------------------------------------------
-- map_subscriptions Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS map_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CONSTRAINT map_subscriptions_email_unique UNIQUE,
  filter_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  frequency text NOT NULL DEFAULT 'weekly',
  last_digest_sent timestamptz,
  confirm_token uuid NOT NULL DEFAULT gen_random_uuid(),
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- map_digest_runs Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS map_digest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  subscribers_sent int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS map_subscriptions_confirmed_idx ON map_subscriptions (confirmed);
CREATE INDEX IF NOT EXISTS map_subscriptions_email_idx ON map_subscriptions (email);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE map_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_digest_runs ENABLE ROW LEVEL SECURITY;

-- map_subscriptions policies
-- Anon visitors can subscribe; service-role Edge Functions can read and update.
-- No anon SELECT is granted: visitors cannot enumerate other subscribers' emails.

DROP POLICY IF EXISTS map_subscriptions_anon_insert ON map_subscriptions;
CREATE POLICY map_subscriptions_anon_insert
  ON map_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (auth.role() = 'anon');

DROP POLICY IF EXISTS map_subscriptions_service_select ON map_subscriptions;
CREATE POLICY map_subscriptions_service_select
  ON map_subscriptions
  FOR SELECT
  TO service_role
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS map_subscriptions_service_update ON map_subscriptions;
CREATE POLICY map_subscriptions_service_update
  ON map_subscriptions
  FOR UPDATE
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- map_digest_runs policies
-- Only service-role Edge Functions may insert or read digest-run records.
-- No anon access at all (denial-by-default with RLS enabled).

DROP POLICY IF EXISTS map_digest_runs_service_insert ON map_digest_runs;
CREATE POLICY map_digest_runs_service_insert
  ON map_digest_runs
  FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS map_digest_runs_service_select ON map_digest_runs;
CREATE POLICY map_digest_runs_service_select
  ON map_digest_runs
  FOR SELECT
  TO service_role
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- pg_cron Weekly Schedule (REFERENCE ONLY — DO NOT UNCOMMENT HERE)
-- ---------------------------------------------------------------------------
--
-- This block is intentionally commented out. It must be applied manually
-- via the Supabase SQL editor AFTER setting the following database-level
-- settings via ALTER DATABASE:
--
--   ALTER DATABASE postgres SET app.supabase_functions_url = 'https://<project-ref>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.service_role_key = '<service-role-jwt>';
--
-- Schedule fires Mondays at 09:00 UTC and POSTs to the `send-digest` Edge
-- Function created in Phase 2.  Apply this block once the above settings
-- are configured and the send-digest function has been deployed.
--
/* select cron.schedule(
  'send-digest-weekly',
  '0 9 * * 1',
  $$select net.http_post(
      url     := current_setting('app.supabase_functions_url') || '/send-digest',
      headers := json_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))::jsonb,
      body    := '{}'::jsonb
    ) as request_id$$
); */
