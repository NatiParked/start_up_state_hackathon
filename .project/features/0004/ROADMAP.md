# Feature 0004: Recurring Data Refresh — Weekly Job Refresh via ATS APIs

> Created: 2026-05-09
> Status: Draft

## Overview

This feature implements the weekly automated refresh pipeline that keeps the Utah Startup Map's hiring data current without incurring AI costs. A `pg_cron` job fires weekly and invokes the `refresh-jobs` Supabase Edge Function, which polls each company's ATS platform (Greenhouse, Lever, or Ashby) via their public structured JSON APIs, then writes updated `job_titles`, `is_hiring`, `careers_url`, and `jobs_refreshed_at` back to `map_startups`. A `refresh_log` table records every run for observability. Manual and admin-triggered refreshes are also supported via an optional `{ startup_id, force }` payload.

Investor/funding data and company profile enrichment are explicitly out of scope — those are event-driven paths handled by existing Edge Functions. This feature is purely the cron-driven ATS polling path.

## Problem Statement

The startup map launched with seed data that is frozen at import time. Without a refresh mechanism, `is_hiring` and `job_titles` go stale within days. Every competing startup directory suffers this fate. A weekly pg_cron job that calls free, public ATS JSON endpoints solves this at zero marginal cost as company count grows — no AI calls, no Claude, no Gemini, no scraping, just structured HTTP fetches to Greenhouse/Lever/Ashby APIs that exist precisely for this use case.

## User Stories

- As a job-seeking founder, I want hiring indicators on the map to reflect current openings so that I'm not misled by stale data.
- As a developer, I want a `refresh_log` table so I can verify the cron job fired and diagnose failures without reading Edge Function logs.
- As an admin, I want to trigger a force-refresh for a single company so I can unblock a founder who just posted new roles before the weekly cron fires.

---

## Codebase Context

### Technology Stack

- Supabase Edge Functions (Deno/ESM) — same conventions as existing `onboard-company` and `enrich-company` functions
- `pg_cron` Supabase extension — schedules the weekly invocation via `cron.schedule()`
- Public ATS JSON APIs: Greenhouse (`boards-api.greenhouse.io`), Lever (`api.lever.co`), Ashby (`jobs.ashbyhq.com`)
- No AI calls anywhere in this feature

### Relevant Directories

- `supabase/migrations/` — SQL migration files
- `supabase/functions/_shared/` — shared Deno modules (ats.js to be created here; existing modules: supabaseAdmin.js, gemini.js, etc.)
- `supabase/functions/refresh-jobs/` — new Edge Function directory (index.js + logger.js)

### Conventions to Follow

- Edge Functions: JS-only (`.js`), ES module syntax (`export default`, `import`)
- Shared modules live in `supabase/functions/_shared/` and are imported with relative paths
- Supabase admin client imported from `../_shared/supabaseAdmin.js`
- Edge Function handlers export `{ Request } => Response` default
- Error responses use `{ error: string }` JSON shape with appropriate HTTP status
- Migration files numbered sequentially (`0004_`, `0005_`)
- Table names prefixed with `map_` for Map product tables
- No `console.log` — use `console.error` for unexpected failures only

---

## Implementation Plan

### Phase 1: Database Migrations

**Goal:** Enable the `pg_cron` extension, schedule the weekly `refresh-jobs` invocation, add `jobs_refreshed_at` to `map_startups`, and create the `refresh_log` table so subsequent phases have a schema to write to.

**Tasks:**

- Create `supabase/migrations/0004_pg_cron.sql`:
  - `create extension if not exists pg_cron;` — enables pg_cron in the Supabase project
  - Grant pg_cron usage to postgres role if needed: `grant usage on schema cron to postgres;`
  - `alter table map_startups add column if not exists jobs_refreshed_at timestamptz;` — tracks last ATS poll time per company
  - Schedule the weekly job: `select cron.schedule('refresh-jobs-weekly', '0 6 * * 1', $$select net.http_post(url:='<SUPABASE_URL>/functions/v1/refresh-jobs', headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb, body:='{}'::jsonb) as request_id;$$);` — fires every Monday 06:00 UTC; URL and key are replaced at apply time via Supabase secrets or left as a placeholder comment instructing the developer to substitute values
- Create `supabase/migrations/0005_refresh_log.sql`:
  - `create table refresh_log (id uuid primary key default gen_random_uuid(), startup_id uuid references map_startups(id), run_at timestamptz default now() not null, source text not null check (source in ('cron','manual','admin')), success boolean not null, error_message text, jobs_updated int default 0)`
  - Index: `create index on refresh_log(startup_id);`
  - Index: `create index on refresh_log(run_at desc);`
  - RLS: enable RLS; add select policy for service role only (no public read)
- Apply both migrations to the Supabase project

**Success Criteria:**

- `pg_cron` extension is visible in Supabase → Database → Extensions.
- `map_startups` has a `jobs_refreshed_at timestamptz` column (nullable) confirmed via `\d map_startups` or Supabase table editor.
- `refresh_log` table exists with all 7 columns: `id`, `startup_id`, `run_at`, `source`, `success`, `error_message`, `jobs_updated`.
- A manual `insert into refresh_log (source, success, jobs_updated) values ('manual', true, 0);` succeeds (startup_id nullable for bulk runs).
- A cron schedule named `refresh-jobs-weekly` is visible in `select * from cron.job;`.

---

### Phase 2: ATS Shared Module

**Goal:** Build `supabase/functions/_shared/ats.js` — the single module that detects which ATS platform a company uses (from its `careers_url` domain), calls the appropriate public JSON API, and returns a normalized hiring payload. This module is imported by both `refresh-jobs` (this feature) and `onboard-company` (M3, which imports it during initial enrichment).

**Tasks:**

- Create `supabase/functions/_shared/ats.js` — ES module exporting a single default function `pollAts(careersUrl)`:
  - If `careersUrl` is null/empty, return `null` immediately
  - Detect ATS platform by inspecting `careersUrl` hostname:
    - `greenhouse.io` or `boards.greenhouse.io` or `boards-api.greenhouse.io` → extract company board token (last path segment or `gh_src` query param pattern); call `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=false`; return `{ job_titles: jobs.map(j=>j.title), is_hiring: jobs.length > 0, careers_url: careersUrl }`
    - `lever.co` or `jobs.lever.co` → extract company slug (first path segment); call `https://api.lever.co/v0/postings/{slug}?mode=json`; return `{ job_titles: postings.map(p=>p.text), is_hiring: postings.length > 0, careers_url: careersUrl }`
    - `ashbyhq.com` or `jobs.ashbyhq.com` → extract company slug (first path segment); call `https://jobs.ashbyhq.com/api/non-user-graphql` with body `{ operationName:'ApiJobBoardWithTeams', variables:{ organizationHostedJobsPageName: slug }, query:'{ jobBoard { jobPostings { title } } }' }`; return normalized shape
    - No ATS detected → return `null`
  - On any fetch error or non-200 response, return `null` (callers preserve existing values)
  - All HTTP calls use `fetch()` with a `User-Agent: goed-startup-map` header and a 10-second timeout via `AbortController`
  - JSDoc comment on the exported function documenting the return type

**Success Criteria:**

- Calling `pollAts('https://boards.greenhouse.io/stripe')` (or any known Greenhouse URL) returns an object with `job_titles` array, `is_hiring` boolean, and `careers_url` string (or a graceful null if the API is unreachable in the test environment).
- Calling `pollAts(null)` returns `null` without throwing.
- Calling `pollAts('https://example.com/careers')` (non-ATS URL) returns `null`.
- The module has no imports from AI libraries, no Gemini calls, no Claude calls — grep confirms zero AI imports in the file.
- The module can be imported by a sibling Edge Function using `import pollAts from '../_shared/ats.js'` without syntax errors (verified by Deno check or a dry-run deploy).

---

### Phase 3: refresh-jobs Edge Function

**Goal:** Build the `refresh-jobs` Edge Function — the orchestrator that queries companies needing a refresh, calls the ATS module for each, writes updated hiring fields back to `map_startups`, and logs each run to `refresh_log` via a dedicated logger module.

**Tasks:**

- Create `supabase/functions/refresh-jobs/logger.js` — ES module exporting `async function logRun(supabase, { startup_id, source, success, error_message, jobs_updated })`:
  - Inserts one row into `refresh_log` with the provided fields and current timestamp
  - Returns `{ error }` from the insert (caller handles logging on failure)
- Create `supabase/functions/refresh-jobs/index.js` — Deno Edge Function:
  - Parse JSON body: `{ startup_id?: string, force?: boolean }` (both optional; default bulk mode)
  - Instantiate Supabase admin client from `../_shared/supabaseAdmin.js`
  - **Single-company mode** (startup_id provided): fetch that one row from `map_startups`; skip recency gate if `force === true`, otherwise skip if `jobs_refreshed_at > NOW() - 7 days`; call `pollAts(careers_url)`; if result non-null, update `job_titles`, `is_hiring`, `careers_url`, `jobs_refreshed_at = now()`; log to `refresh_log` with `source = 'manual'` and outcome
  - **Bulk mode** (no startup_id): query `select id, name, careers_url, jobs_refreshed_at from map_startups where jobs_refreshed_at is null or jobs_refreshed_at < now() - interval '7 days'`; for each row call `pollAts`; if non-null, update that row; accumulate counts; log a single summary row to `refresh_log` with `source = 'cron'`, total `jobs_updated`, and `success = true` (or `false` if any update errored)
  - Respond with `{ refreshed: N, skipped: M, errors: K }` JSON on success
  - Respond with `{ error: string }` and status 500 on unexpected failure
  - No AI calls anywhere in this function — ATS polling only

**Success Criteria:**

- Deploying the function (`supabase functions deploy refresh-jobs`) succeeds with no errors.
- A POST to `/functions/v1/refresh-jobs` with body `{}` (bulk mode) returns a JSON response with `refreshed`, `skipped`, and `errors` keys.
- A POST with `{ "startup_id": "<valid-uuid>", "force": true }` refreshes exactly that one company and returns the same shape.
- After a successful run, `jobs_refreshed_at` is set to a timestamp within the last minute for all companies with a detected ATS platform.
- A second immediate run (without `force`) returns `refreshed: 0` and `skipped: N` — the recency gate is working.
- `refresh_log` contains a new row after each invocation with correct `source`, `success`, and `jobs_updated` values.

---

### Phase 4: End-to-End Integration & Verification

**Goal:** Confirm the full pipeline operates correctly: cron schedule is wired, manual triggers work, recency gating skips fresh companies, log entries are written, and there are zero AI calls in the cron path. This phase is verification-only — no new code unless a gap is found.

**Tasks:**

- Verify `cron.job` table contains the `refresh-jobs-weekly` schedule with correct `'0 6 * * 1'` expression
- Manually invoke `refresh-jobs` via curl or Supabase Dashboard → Edge Functions → Invoke: confirm response shape and that `map_startups.jobs_refreshed_at` advances for ATS-detected companies
- Invoke again immediately (no `force`): confirm `refreshed: 0` and `skipped: N` proving the 7-day recency gate works
- Invoke with `{ "startup_id": "<uuid>", "force": true }` for a company with a known Greenhouse/Lever/Ashby `careers_url`: confirm that company's `job_titles` and `is_hiring` are updated in Supabase
- Check `refresh_log` table: confirm rows exist with correct `source` (`'cron'` for scheduled, `'manual'` for single-company), `success = true`, and a non-zero `jobs_updated` for companies with ATS detected
- Grep `supabase/functions/refresh-jobs/` and `supabase/functions/_shared/ats.js` for any import of AI libraries (gemini, claude, anthropic, openai) — confirm zero matches
- If the cron schedule references a hardcoded URL/key placeholder, document in a `DECISIONS.md` note that the operator must substitute the project URL and service role key at migration apply time

**Success Criteria:**

- `select * from cron.job where jobname = 'refresh-jobs-weekly';` returns exactly one row with schedule `'0 6 * * 1'`.
- A manual bulk invocation of `refresh-jobs` updates `jobs_refreshed_at` on at least one company (any company whose `careers_url` matches a supported ATS domain).
- A second immediate bulk invocation returns `{ refreshed: 0, skipped: N }` — the recency gate prevents redundant API calls.
- Force-refresh on a single company with a supported ATS `careers_url` updates that company's `job_titles` and `is_hiring` within the same invocation.
- `refresh_log` has at least two rows after the manual test runs; each row has a non-null `run_at`, a valid `source`, and a boolean `success`.
- `grep -r 'gemini\|claude\|anthropic\|openai' supabase/functions/refresh-jobs/ supabase/functions/_shared/ats.js` returns no matches.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0004_pg_cron.sql` | Create | Enable pg_cron extension, add jobs_refreshed_at column, schedule weekly cron job |
| `supabase/migrations/0005_refresh_log.sql` | Create | refresh_log table with indexes and RLS |
| `supabase/functions/_shared/ats.js` | Create | ATS platform detector + job poller (Greenhouse/Lever/Ashby) |
| `supabase/functions/refresh-jobs/index.js` | Create | Edge Function orchestrator — bulk and single-company refresh |
| `supabase/functions/refresh-jobs/logger.js` | Create | Writes run outcomes to refresh_log |

---

## Testing Strategy

No automated test framework is in scope. Verification is manual and observable via Supabase Dashboard and direct SQL queries, per the success criteria for each phase.

### Manual Verification Checklist (end of feature)

- `pg_cron` extension active; `cron.job` table contains `refresh-jobs-weekly` row.
- `map_startups` has `jobs_refreshed_at` column.
- `refresh_log` table exists and accepts inserts.
- Bulk invocation of `refresh-jobs` returns `{ refreshed, skipped, errors }` JSON and updates `jobs_refreshed_at`.
- Second immediate invocation returns `refreshed: 0` (recency gate works).
- Force-refresh for a single company updates `job_titles` and `is_hiring`.
- `refresh_log` rows appear after each invocation with correct fields.
- Zero AI imports in any file in this feature (`grep` confirms).

---

## Dependencies

### Prerequisites

- M1 complete: `map_startups` table exists with `id`, `careers_url`, `job_titles`, `is_hiring` columns.
- M3 complete (or in progress): `supabase/functions/_shared/` directory exists; `supabaseAdmin.js` shared module is in place. (The `ats.js` module built here is also imported by `onboard-company` from M3.)
- `pg_cron` Postgres extension available in the Supabase project tier (available on Pro and above; or via `supabase_extensions` on free tier — verify before applying migration).

### Blocking/Blocked By

- **Blocks:** Nothing — this is a background data pipeline with no frontend dependencies.
- **Blocked by:** Feature 0001 (M1 — `map_startups` table); Feature 0002 M3 (`_shared/supabaseAdmin.js` must exist before `refresh-jobs` can import it).

---

## Open Questions

- The pg_cron `net.http_post` call requires the `pg_net` extension in addition to `pg_cron`. If `pg_net` is unavailable, the alternative is a `pg_cron` job that calls a Postgres function, which in turn uses `http` extension. Decision: use `pg_net` (standard on Supabase); add `create extension if not exists pg_net;` to the migration as a safeguard.
- Ashby's GraphQL endpoint may require authentication for some job boards. Decision: attempt unauthenticated first; return `null` on 401/403 and fall back to existing values — no hardcoded credentials.
- The `cron.schedule` call embeds the Edge Function URL and service role key. Decision: use a comment placeholder in the migration SQL instructing the operator to run `select cron.schedule(...)` manually with their project's values, rather than hardcoding secrets in a committed file.
