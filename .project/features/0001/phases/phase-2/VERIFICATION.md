# VERIFICATION — Feature 0001 Phase 2

**Date:** 2026-05-09 00:00
**Phase:** Database Schema & Migration
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 0    | 0    | 1    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 5    | 0    | 0    | 5     |
| UI         | 0    | 0    | 5    | 5     |
| **Total**  | 5    | 0    | 6    | 11    |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** SKIP
**URL:** http://localhost:5173
**Reason:** Playwright/Chromium not installed (`npx playwright install chrome` required). Dev server confirmed reachable via `curl` (HTTP 200). Smoke test skipped — Playwright MCP unavailable.

## Criteria Results

### ENV
_(No ENV criteria for this phase.)_

### CODE

All CODE checks performed against `supabase/migrations/0001_init.sql`.

- **PASS** — `map_startups` table definition exists in migration SQL with 29 columns (spec text lists 29; ROADMAP criterion says "28 columns" — minor off-by-one in ROADMAP, SQL matches the full spec column list including `id`, `name`, `description`, `website`, `linkedin`, `address`, `city`, `lat`, `lng`, `region`, `stage`, `sector`, `funding_stage`, `business_type`, `employee_range`, `founded_year`, `is_hiring`, `job_titles`, `careers_url`, `logo_url`, `google_place_id`, `google_rating`, `phone`, `investors`, `total_raised`, `verified`, `last_refreshed_at`, `created_at`, `updated_at`)
- **PASS** — `map_startup_submissions` table definition exists in migration SQL with submission-tracking columns: `status text not null default 'pending'` and `submitted_at timestamptz default now()` present
- **PASS** — Indexes present in migration SQL: B-tree on `sector`, `stage`, `region`; GIN on `investors` — all four required indexes defined
- **PASS** — RLS enabled on both tables: `alter table map_startups enable row level security;` and `alter table map_startup_submissions enable row level security;` present
- **PASS** — RLS policies defined: `map_startups_public_select` (anon/authenticated SELECT allowed); `map_startup_submissions_public_insert` (anon/authenticated INSERT allowed, no SELECT)

### UI (Live DB — SKIP)

All Phase 2 UI/runtime criteria require a live Supabase instance with anon client access. These cannot be verified without live database credentials.

- **SKIP** — `map_startups` table exists in Supabase with all columns — requires live DB (`select * from map_startups` via anon client)
- **SKIP** — `map_startup_submissions` table exists in Supabase — requires live DB
- **SKIP** — Anonymous client can `select * from map_startups` and is blocked from `insert/update/delete` — requires live Supabase with RLS applied
- **SKIP** — Anonymous client can `insert` into `map_startup_submissions` but cannot `select` — requires live Supabase with RLS applied
- **SKIP** — Indexes on `sector`, `stage`, `region`, `investors` visible in Supabase — requires live DB (`\d map_startups` in psql or Supabase table editor)

**Note:** Migration SQL file `supabase/migrations/0001_init.sql` is authored correctly per spec. Live DB verification depends on developer running `supabase db push` or pasting the SQL into the Supabase SQL editor and confirming RLS/index behavior with an anon client.

## Failures

_(No failures. All applicable checks passed. Live DB checks are SKIP, not FAIL.)_
