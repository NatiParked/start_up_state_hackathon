# VERIFICATION — Feature 0008 Phase 1

**Date:** 2026-05-09 18:46
**Phase:** Database & View Tracking Migration
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 1    | 0    | 0    | 1     |
| UI         | 0    | 0    | 0    | 0     |
| DB (live)  | 0    | 0    | 4    | 4     |
| **Total**  | 2    | 0    | 4    | 6     |

**Overall: PASS** (with caveat — see Notes)

_PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable._

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
- Page title resolved to `Utah Startup Map`
- Page snapshot shows mounted DOM (not empty mount point)
- Console errors: 1 — only a benign `favicon.ico` 404 unrelated to app mounting; no uncaught JS exceptions
- Phase 1 is a database-only phase; smoke confirms migration did not break the app load

## Criteria Results

### CODE
- **PASS** — Migration file `supabase/migrations/0012_view_counts.sql` exists (2283 bytes) and contains:
  - `create table if not exists company_views` with all 4 required columns (`id uuid pk`, `startup_id uuid not null references map_startups(id) on delete cascade`, `viewed_at timestamptz not null default now()`, `session_id text not null`)
  - Index `company_views_startup_id_viewed_at_idx on company_views (startup_id, viewed_at desc)`
  - `alter table company_views enable row level security`
  - Policy `company_views_anon_insert` for `insert to anon with check (true)` (no select policy → anon select intentionally blocked)
  - `create or replace function get_company_view_stats(p_startup_id uuid)` returning `(views_this_week bigint, views_total bigint)`, `language sql security definer set search_path = public`
  - `grant execute on function get_company_view_stats(uuid) to anon, authenticated`
  - `on delete cascade` clause present on the FK to `map_startups(id)`

### DB (live runtime)

- **SKIP** — `company_views` table exists with 4 columns + index visible in Supabase table editor — *requires live DB; Task 1.2 (apply migration) is blocked per STATE.md (Supabase MCP not authenticated, no `supabase` CLI / `psql` in env). Schema is fully encoded in `0012_view_counts.sql`; verify after applying.*
- **SKIP** — Anonymous client can `insert` and is blocked from `select` — *requires live DB; RLS policy is fully encoded in the migration. Verify after apply.*
- **SKIP** — `supabase.rpc('get_company_view_stats', { p_startup_id })` returns `{ views_this_week, views_total }` (numeric, zero on no rows) — *requires live DB. RPC body returns the correct shape; verify after apply.*
- **SKIP** — Foreign-key cascade: deleting from `map_startups` removes related `company_views` rows — *requires live DB. `on delete cascade` is present in the DDL. Verify after apply.*

## Failures

None.

## Notes / Caveats

- **Task 1.2 is blocked** (per STATE.md): the migration has been authored (Task 1.1 ✅, commit `5154366`) but not applied to the live Supabase DB. Live-DB success criteria therefore cannot be machine-verified in this run.
- Migration content review confirms the migration *will* satisfy all 4 success criteria once applied. To unblock and complete verification, either:
  1. Authenticate Supabase MCP via `mcp__plugin_supabase_supabase__authenticate` and apply the migration, then re-run `/spec:verify-phase 0008 1`, or
  2. Manually apply `supabase/migrations/0012_view_counts.sql` via the Supabase SQL editor and re-run verification.
- Smoke test confirms the app still loads cleanly with the unapplied migration on disk (no Vue build break from any related code that may have been added).
