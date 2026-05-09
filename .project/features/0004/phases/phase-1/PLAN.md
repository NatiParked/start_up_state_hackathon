# Feature Plan: Recurring Data Refresh — Phase 1: Database Migrations

## Objective

Provision the database surface area required for the weekly job-refresh cron: enable `pg_cron` + `pg_net`, add `jobs_refreshed_at` to `map_startups`, create the `refresh_log` audit table, and apply both migrations to the live Supabase project so subsequent phases (Edge Function, admin UI) have a schema to write to.

**Purpose:** Without these schema changes, the `refresh-jobs` Edge Function has nowhere to record runs and no way to be invoked on a schedule. This phase is a hard prerequisite for Phases 2-4.

**Output:**
- `supabase/migrations/0004_pg_cron.sql` (new)
- `supabase/migrations/0005_refresh_log.sql` (new)
- Both migrations applied to the remote Supabase project via `mcp__plugin_supabase_supabase__apply_migration`

## Must-Haves (Goal-Backward)

### Observable Truths

- An operator can run `select * from cron.job;` after manual scheduling and see a row named `refresh-jobs-weekly` (the migration ships the cron call as a documented placeholder; operator substitutes real URL/key at apply time).
- `pg_cron` and `pg_net` extensions are enabled on the project (visible in Supabase Dashboard → Database → Extensions).
- `map_startups.jobs_refreshed_at timestamptz` column exists and is nullable, so the Edge Function can stamp it on each successful poll.
- A `refresh_log` row can be inserted (`insert into refresh_log (source, success, jobs_updated) values ('manual', true, 0);` succeeds) — `startup_id` is nullable so cron-level/bulk runs can be logged without a per-company row.
- `refresh_log` is RLS-enabled with no public read access — only the service role (used by the Edge Function and admin tooling) can read or write rows.

### Required Artifacts

| Path                                       | Provides                                                              | Key Exports / Effects                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/0004_pg_cron.sql`     | Cron infrastructure + `jobs_refreshed_at` column                      | enables `pg_cron`, `pg_net`; grants `usage` on schema `cron`; adds `map_startups.jobs_refreshed_at`; ships a SQL comment with the `cron.schedule(...)` call as a placeholder for manual operator execution |
| `supabase/migrations/0005_refresh_log.sql` | `refresh_log` audit table + indexes + RLS                             | creates table with 7 columns, 2 indexes, RLS enabled, service_role-only policies                                   |

### Key Links

| From                                          | To                                                  | Via                                                                |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Phase 2 Edge Function `refresh-jobs`          | `map_startups.jobs_refreshed_at`                    | UPDATE per company after successful ATS poll                        |
| Phase 2 Edge Function `refresh-jobs`          | `refresh_log` table                                 | INSERT per company (or one bulk row) with source='cron' or 'manual' |
| pg_cron scheduler (manual operator step)      | Edge Function `/functions/v1/refresh-jobs`          | `net.http_post` with service-role bearer header                    |
| Phase 3 Admin UI                              | `refresh_log`                                       | SELECT recent rows via service-role server route                    |

## Dependency Graph

```
Task 1 (write 0004_pg_cron.sql)        ─┐
                                         ├─► Task 3 (apply both migrations via Supabase MCP)
Task 2 (write 0005_refresh_log.sql)    ─┘
```

- Tasks 1 and 2 are independent (different files, no shared SQL) and can run in parallel.
- Task 3 depends on both files existing. Task 3 applies them in order (0004 first, then 0005) because `refresh_log` does not depend on pg_cron, but applying in numeric order matches repo convention and avoids surprises if future migrations cross-reference.

## Execution Sequences

| Sequence | Tasks         | Parallel |
| -------- | ------------- | -------- |
| 1        | Task 1, Task 2 | Yes      |
| 2        | Task 3         | No (single task) |

## Tasks

### Task 1: Author migration 0004 — pg_cron extension, jobs_refreshed_at column, scheduling placeholder

**Type:** auto
**Sequence:** 1

<files>
supabase/migrations/0004_pg_cron.sql
</files>

<action>
Create the new migration file with the following exact contents (header comment matches the style of `0001_init.sql` and `0002_submissions.sql`):

```sql
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
```

Match the spacing, comment style, and section dividers used in existing migrations. Do not add any other statements.
</action>

<verify>
1. File exists at `supabase/migrations/0004_pg_cron.sql`.
2. Running `grep -c "create extension if not exists pg_cron" supabase/migrations/0004_pg_cron.sql` returns 1.
3. Running `grep -c "create extension if not exists pg_net" supabase/migrations/0004_pg_cron.sql` returns 1.
4. Running `grep -c "add column if not exists jobs_refreshed_at timestamptz" supabase/migrations/0004_pg_cron.sql` returns 1.
5. The `cron.schedule('refresh-jobs-weekly', '0 6 * * 1', ...)` block is present but **commented out** with `--` (verified by reading the file — the line `-- select cron.schedule(` exists).
</verify>

<done>
- [x] Migration file written with idempotent extension/column statements
- [x] Cron scheduling SQL is documented as a commented placeholder (no real keys committed)
- [x] File header matches the convention of 0001/0002 (apply-instructions block at top)
Completed: 2026-05-09
</done>

---

### Task 2: Author migration 0005 — refresh_log table, indexes, and RLS

**Type:** auto
**Sequence:** 1

<files>
supabase/migrations/0005_refresh_log.sql
</files>

<action>
Create the new migration file with the following exact contents:

```sql
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
create table if not exists refresh_log (
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
create index if not exists refresh_log_startup_id_idx
  on refresh_log (startup_id);

-- Admin "recent activity" queries: most recent runs first.
create index if not exists refresh_log_run_at_desc_idx
  on refresh_log (run_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table refresh_log enable row level security;

-- No anon/authenticated read or write. Only the service_role (used by the
-- refresh-jobs Edge Function and any admin server route) can access this
-- table. This is achieved by enabling RLS without adding any policies for
-- anon/authenticated, and adding an explicit service_role select policy for
-- documentation/clarity (service_role bypasses RLS by default, but the
-- explicit policy makes intent obvious to future readers).
drop policy if exists refresh_log_service_role_select on refresh_log;
create policy refresh_log_service_role_select
  on refresh_log
  for select
  to service_role
  using (true);
```

Match the spacing, comment style, and section dividers used in existing migrations.
</action>

<verify>
1. File exists at `supabase/migrations/0005_refresh_log.sql`.
2. Running `grep -c "create table if not exists refresh_log" supabase/migrations/0005_refresh_log.sql` returns 1.
3. The table definition contains all 7 columns: `id`, `startup_id`, `run_at`, `source`, `success`, `error_message`, `jobs_updated` (verified by grep for each column name).
4. `grep "check (source in" supabase/migrations/0005_refresh_log.sql` finds the CHECK constraint with values `'cron'`, `'manual'`, `'admin'`.
5. Both indexes are present: `refresh_log_startup_id_idx` and `refresh_log_run_at_desc_idx`.
6. `alter table refresh_log enable row level security;` is present.
</verify>

<done>
- [x] Migration file written with table, 2 indexes, and RLS enabled
- [x] CHECK constraint on `source` column allows only `cron`, `manual`, `admin`
- [x] No anon/authenticated policies (service_role-only access by default)
Completed: 2026-05-09
</done>

---

### Task 3: Apply both migrations to the remote Supabase project via MCP

**Type:** auto
**Sequence:** 2

<files>
(no file changes — this task applies SQL to the remote Supabase project)
</files>

<action>
Apply migrations 0004 and 0005 to the live Supabase project using Supabase MCP tools. Steps:

1. **Look up the project ID.** Call `mcp__plugin_supabase_supabase__list_projects` and find the project for this hackathon (there should be exactly one project in this org named for the Utah Startup Map / GOED project; if multiple, prefer the most recently created one matching the naming convention used in prior phases). Note its `id` for the next steps.

2. **Apply migration 0004.** Call `mcp__plugin_supabase_supabase__apply_migration` with:
   - `project_id`: the ID from step 1
   - `name`: `0004_pg_cron`
   - `query`: the full SQL contents of `supabase/migrations/0004_pg_cron.sql` (read the file with the Read tool first, then pass its contents verbatim — do **not** strip the header comments).

3. **Apply migration 0005.** Call `mcp__plugin_supabase_supabase__apply_migration` with:
   - `project_id`: the ID from step 1
   - `name`: `0005_refresh_log`
   - `query`: the full SQL contents of `supabase/migrations/0005_refresh_log.sql`.

4. **Verify by querying the database.** Run these `mcp__plugin_supabase_supabase__execute_sql` queries against the same project_id and confirm the expected results:

   a. Confirm extensions:
   ```sql
   select extname from pg_extension where extname in ('pg_cron', 'pg_net') order by extname;
   ```
   Expect 2 rows: `pg_cron`, `pg_net`.

   b. Confirm column added:
   ```sql
   select column_name, data_type, is_nullable
   from information_schema.columns
   where table_name = 'map_startups' and column_name = 'jobs_refreshed_at';
   ```
   Expect 1 row: `jobs_refreshed_at | timestamp with time zone | YES`.

   c. Confirm `refresh_log` exists with all 7 columns:
   ```sql
   select column_name from information_schema.columns
   where table_name = 'refresh_log' order by ordinal_position;
   ```
   Expect 7 rows in this order: `id`, `startup_id`, `run_at`, `source`, `success`, `error_message`, `jobs_updated`.

   d. Confirm RLS enabled on `refresh_log`:
   ```sql
   select relname, relrowsecurity from pg_class where relname = 'refresh_log';
   ```
   Expect `refresh_log | t`.

   e. Smoke-test insert (also confirms `startup_id` is nullable for bulk runs):
   ```sql
   insert into refresh_log (source, success, jobs_updated) values ('manual', true, 0)
   returning id, source, success, jobs_updated;
   ```
   Expect 1 row returned with a generated UUID, `source='manual'`, `success=true`, `jobs_updated=0`.

   f. Clean up the smoke-test row:
   ```sql
   delete from refresh_log where source = 'manual' and jobs_updated = 0;
   ```

If any step fails, capture the error message verbatim, do not retry blindly, and surface the error in the final summary so the user can intervene. Common failure modes: (a) `pg_net` not available on the plan tier — note this and proceed (the column and table are still useful even without scheduling); (b) an existing `refresh_log` table from a prior partial run — the `if not exists` guards make this safe.
</action>

<verify>
1. `mcp__plugin_supabase_supabase__list_projects` returned at least one project and a project_id was selected.
2. Both `apply_migration` calls returned without error.
3. Verification query (a) returned both `pg_cron` and `pg_net`.
4. Verification query (b) returned `jobs_refreshed_at` as nullable timestamptz.
5. Verification query (c) returned all 7 columns of `refresh_log` in the expected order.
6. Verification query (d) showed `relrowsecurity = true` on `refresh_log`.
7. Verification query (e) inserted and returned a row; query (f) cleaned it up.
</verify>

<done>
- [x] Project ID resolved via list_projects
- [x] Migration 0004 applied successfully
- [x] Migration 0005 applied successfully
- [x] All 6 verification queries returned the expected results
- [x] Smoke-test row inserted and cleaned up
Completed: 2026-05-09
</done>

---

## Verification Checklist

Mirrors the ROADMAP success criteria:

- [x] `pg_cron` extension is enabled (visible via `select extname from pg_extension where extname='pg_cron'`).
- [x] `pg_net` extension is enabled (required for `net.http_post`).
- [x] `map_startups.jobs_refreshed_at` column exists and is nullable `timestamptz`.
- [x] `refresh_log` table exists with all 7 columns: `id`, `startup_id`, `run_at`, `source`, `success`, `error_message`, `jobs_updated`.
- [x] `refresh_log.source` has a CHECK constraint accepting only `cron`, `manual`, `admin`.
- [x] Indexes `refresh_log_startup_id_idx` and `refresh_log_run_at_desc_idx` exist.
- [x] RLS is enabled on `refresh_log`; no anon/authenticated select policy exists; only the service_role can read.
- [x] Manual `insert into refresh_log (source, success, jobs_updated) values ('manual', true, 0);` succeeds (proves `startup_id` is nullable).
- [x] The `cron.schedule('refresh-jobs-weekly', ...)` call is documented as a commented placeholder in `0004_pg_cron.sql` (NOT executed by the migration — operator runs it manually with real URL/key in a follow-up step before Phase 2 wraps).

## Success Criteria

Phase 1 is complete when:

1. Both files `supabase/migrations/0004_pg_cron.sql` and `supabase/migrations/0005_refresh_log.sql` exist in the repo and match the SQL specified in Tasks 1 and 2.
2. Both migrations have been applied to the remote Supabase project via the Supabase MCP `apply_migration` tool.
3. All 6 verification queries in Task 3 return the expected results, proving the schema additions are live.
4. A future agent implementing Phase 2 (the `refresh-jobs` Edge Function) can `update map_startups set jobs_refreshed_at = now() where id = $1` and `insert into refresh_log (...)` without further schema work.
5. Operator-facing note recorded in EXECUTED/STATE: the `cron.schedule(...)` SQL must be run manually with real `<SUPABASE_URL>` and `<SERVICE_ROLE_KEY>` substituted, and that step is **not** automated by this phase (intentional, to keep secrets out of git).
