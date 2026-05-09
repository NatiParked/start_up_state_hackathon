-- 0007_admin_map_startups_rls.sql
-- Additive RLS policies granting allow-listed admins write access to map_startups.
-- Feature 0005 Phase 3 — Admin Management UI.
--
-- This migration is idempotent: safe to re-run on a partially migrated database.
--
-- RLS was enabled on map_startups in 0001_init.sql.
-- The allow-list table map_admin_users was created in 0006_admin_users.sql.

-- ---------------------------------------------------------------------------
-- Admin UPDATE policy on map_startups
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "admins update map_startups" ON map_startups;
CREATE POLICY "admins update map_startups"
  ON map_startups
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users))
  WITH CHECK (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));

-- ---------------------------------------------------------------------------
-- Admin INSERT policy on map_startups
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "admins insert map_startups" ON map_startups;
CREATE POLICY "admins insert map_startups"
  ON map_startups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));
