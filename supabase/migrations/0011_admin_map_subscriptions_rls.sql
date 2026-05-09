-- 0011_admin_map_subscriptions_rls.sql
-- Additive RLS policies granting allow-listed admins SELECT access to map_subscriptions and map_digest_runs.
-- Feature 0007 Phase 4 — Admin Subscriber Panel population.
--
-- This migration is idempotent: safe to re-run on a partially migrated database.
--
-- RLS was enabled on map_subscriptions and map_digest_runs in 0009_subscriptions.sql.
-- The allow-list table map_admin_users was created in 0006_admin_users.sql.

-- ---------------------------------------------------------------------------
-- Admin SELECT policy on map_subscriptions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS map_subscriptions_admin_select ON map_subscriptions;
CREATE POLICY map_subscriptions_admin_select
  ON map_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));

-- ---------------------------------------------------------------------------
-- Admin SELECT policy on map_digest_runs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS map_digest_runs_admin_select ON map_digest_runs;
CREATE POLICY map_digest_runs_admin_select
  ON map_digest_runs
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));
