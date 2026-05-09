-- 0002_submissions.sql
-- Additive migration for the Utah Startup Map submissions pipeline (Feature 0003).
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
-- M3 Tracking Columns
-- ---------------------------------------------------------------------------

-- The URL the user pasted in the public submission form.
ALTER TABLE map_startup_submissions
  ADD COLUMN IF NOT EXISTS submitted_url text;

-- Submitter contact email (optional).
ALTER TABLE map_startup_submissions
  ADD COLUMN IF NOT EXISTS submitted_by_email text;

-- The full enriched company record produced by the AI onboarding pipeline.
ALTER TABLE map_startup_submissions
  ADD COLUMN IF NOT EXISTS extracted_data jsonb;

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
-- Status CHECK Constraint
-- ---------------------------------------------------------------------------

-- Drop the old constraint if it exists (makes re-runs safe).
ALTER TABLE map_startup_submissions
  DROP CONSTRAINT IF EXISTS map_startup_submissions_status_check;

-- Add the expanded constraint that allows 'auto_published'.
ALTER TABLE map_startup_submissions
  ADD CONSTRAINT map_startup_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'auto_published'));

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------

-- B-tree index for fast admin queue queries ("show me all pending submissions").
CREATE INDEX IF NOT EXISTS map_startup_submissions_status_idx
  ON map_startup_submissions (status);

-- ---------------------------------------------------------------------------
-- Row Level Security — Admin Policies
-- ---------------------------------------------------------------------------

-- Authenticated users (admins) may read all submissions.
DROP POLICY IF EXISTS map_startup_submissions_admin_select ON map_startup_submissions;
CREATE POLICY map_startup_submissions_admin_select
  ON map_startup_submissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users (admins) may update any submission (approve, reject, etc.).
DROP POLICY IF EXISTS map_startup_submissions_admin_update ON map_startup_submissions;
CREATE POLICY map_startup_submissions_admin_update
  ON map_startup_submissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
