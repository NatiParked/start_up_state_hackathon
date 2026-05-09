-- 0006_admin_users.sql
-- Admin allow-list and RLS hardening for the Utah Startup Map (Feature 0005, Phase 1).
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
-- map_admin_users Table
-- ---------------------------------------------------------------------------

-- Allow-list table: any email in this table is treated as an admin.
-- RLS: authenticated users can SELECT (to verify their own email); no INSERT/DELETE granted.
CREATE TABLE IF NOT EXISTS map_admin_users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE map_admin_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users may check whether their email is in the allow-list.
-- (No write policies: only service role can INSERT/DELETE rows.)
DROP POLICY IF EXISTS map_admin_users_authenticated_select ON map_admin_users;
CREATE POLICY map_admin_users_authenticated_select
  ON map_admin_users
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Audit Columns on map_startup_submissions (idempotent)
-- ---------------------------------------------------------------------------

-- These three columns may already exist from 0002_submissions.sql; ADD COLUMN IF NOT EXISTS
-- makes this block safe to re-run.

-- Why a submission was rejected (manual review note or auto quality-gate reason).
ALTER TABLE map_startup_submissions
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- When the review decision was made (manual or auto).
ALTER TABLE map_startup_submissions
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Reviewer email, or the literal string 'auto' for quality-gate auto-decisions.
ALTER TABLE map_startup_submissions
  ADD COLUMN IF NOT EXISTS reviewed_by text;

-- ---------------------------------------------------------------------------
-- Row Level Security — Allow-List-Gated Admin Policies on map_startup_submissions
-- ---------------------------------------------------------------------------

-- Replace the broad "any authenticated user" policies from 0002_submissions.sql with
-- policies that restrict to emails present in map_admin_users.

-- Admin SELECT: only allow-listed emails may read submissions.
DROP POLICY IF EXISTS map_startup_submissions_admin_select ON map_startup_submissions;
CREATE POLICY map_startup_submissions_admin_select
  ON map_startup_submissions
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));

-- Admin UPDATE: only allow-listed emails may update submissions.
DROP POLICY IF EXISTS map_startup_submissions_admin_update ON map_startup_submissions;
CREATE POLICY map_startup_submissions_admin_update
  ON map_startup_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users))
  WITH CHECK (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));

-- NOTE: The public INSERT policy (map_startup_submissions_public_insert) from
-- 0002_submissions.sql is intentionally left untouched — public users must still be
-- able to submit startups for review.

-- ---------------------------------------------------------------------------
-- Seed Admin Emails
-- ---------------------------------------------------------------------------

INSERT INTO map_admin_users (email) VALUES
  ('cayden@sempurnadev.com'),
  ('admin@goed.utah.gov'),
  ('staff@goed.utah.gov')
ON CONFLICT (email) DO NOTHING;
