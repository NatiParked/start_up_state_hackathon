# VERIFICATION — Feature 0007 Phase 1

**Date:** 2026-05-09 17:42
**Phase:** Database Schema & Migration
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 5    | 0    | 0    | 5     |
| UI         | 0    | 0    | 0    | 0     |
| **Total**  | 6    | 0    | 0    | 6     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
App loaded with full DOM content — nav, map filters, 223 companies rendered, OpenLayers tiles visible. Only console error was a benign `404 Not Found` for `/favicon.ico`, which does not affect app mounting.

## Criteria Results

### ENV
_(No ENV criteria for this phase.)_

### CODE

All 5 criteria verified against the live Supabase database (project `punpjzwxqazqbxvkyemv`):

- **PASS** — `map_subscriptions` table exists with all columns including `confirm_token`, `confirmed`, and `filter_criteria jsonb`
  - Confirmed columns: `id uuid`, `email text`, `filter_criteria jsonb NOT NULL DEFAULT '{}'`, `frequency text`, `last_digest_sent timestamptz`, `confirm_token uuid NOT NULL DEFAULT gen_random_uuid()`, `confirmed boolean NOT NULL DEFAULT false`, `created_at timestamptz`

- **PASS** — `map_digest_runs` table exists with `run_at`, `subscribers_sent`, `errors` columns
  - Confirmed columns: `id uuid`, `run_at timestamptz NOT NULL DEFAULT now()`, `subscribers_sent int NOT NULL DEFAULT 0`, `errors int NOT NULL DEFAULT 0`

- **PASS** — Anon client can `insert` into `map_subscriptions` but cannot `select` rows from it
  - Policy `map_subscriptions_anon_insert` (role: anon, cmd: INSERT) is present. No SELECT policy exists for anon role. RLS is enabled, so no policy = no access.

- **PASS** — Service-role client can `select *` from `map_subscriptions`
  - Policy `map_subscriptions_service_select` (role: service_role, cmd: SELECT, qual: `auth.role() = 'service_role'`) is present.

- **PASS** — RLS is enabled on both tables
  - `map_subscriptions`: `rls_enabled = true`
  - `map_digest_runs`: `rls_enabled = true`

### UI
_(No UI criteria for this phase — all criteria are schema/DB level. Smoke test serves as the UI baseline.)_

## Failures

_(None — all criteria passed.)_
