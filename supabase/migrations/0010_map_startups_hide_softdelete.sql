-- 0010_map_startups_hide_softdelete.sql
-- Adds admin-controlled visibility (is_hidden) and soft-delete (deleted_at) to map_startups.
-- Feature 0006 — Hide & Soft-Delete for map_startups.
--
-- Apply manually (do NOT auto-run from this repo):
--   Option A (Supabase CLI, run from repo root):
--     supabase db push
--   Option B (SQL editor):
--     Paste the contents of this file into the Supabase project's SQL editor and run.
--
-- This migration is idempotent: safe to re-run on a partially migrated database.
-- RLS was enabled on map_startups in 0001_init.sql.
-- The allow-list table map_admin_users was created in 0006_admin_users.sql.

-- ---------------------------------------------------------------------------
-- New columns: is_hidden and deleted_at
-- ---------------------------------------------------------------------------

-- is_hidden: admin-controlled flag; when true the row is invisible to the public map.
ALTER TABLE map_startups
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- deleted_at: soft-delete timestamp; when non-NULL the row is treated as deleted.
-- Set to now() to soft-delete; NULL to restore. Hard deletion is not supported here.
ALTER TABLE map_startups
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Tighten public SELECT policy: filter hidden and soft-deleted rows
-- ---------------------------------------------------------------------------

-- Drop the old broad policy (USING (true)) and replace it with one that hides
-- is_hidden rows and soft-deleted rows from anon/authenticated public callers.
DROP POLICY IF EXISTS map_startups_public_select ON map_startups;
CREATE POLICY map_startups_public_select
  ON map_startups
  FOR SELECT
  TO anon, authenticated
  USING (is_hidden = false AND deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- Admin SELECT policy: allow-listed admins see all rows including hidden/deleted
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "admins select map_startups" ON map_startups;
CREATE POLICY "admins select map_startups"
  ON map_startups
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));

-- ---------------------------------------------------------------------------
-- Performance index: keep public queries fast after column additions
-- ---------------------------------------------------------------------------

-- Partial index covering only active (visible, non-deleted) rows — the common
-- case for public map queries. Rows where is_hidden=true or deleted_at IS NOT NULL
-- are excluded, keeping the index small.
CREATE INDEX IF NOT EXISTS map_startups_active_idx
  ON map_startups (id)
  WHERE is_hidden = false AND deleted_at IS NULL;
