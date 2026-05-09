# VERIFICATION — Feature 0004 Phase 3

**Date:** 2026-05-09 15:57
**Phase:** refresh-jobs Edge Function
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 6    | 0    | 0    | 6     |
| CODE       | 10   | 0    | 0    | 10    |
| UI         | 0    | 0    | 0    | 0     |
| **Total**  | 17   | 0    | 0    | 17    |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

---

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

Playwright navigated to localhost:5173 — page title "Utah Startup Map", full DOM rendered including nav (Map/Navigator/Submit/Admin/Roadmap/Subscribe), filter sidebar (Sector/Stage/Company Size/Hiring/Region/Investors/Founded Year), ecosystem stats bar (223 companies, 55 hiring, 134 with investors), and 130+ company logo pins. Only console error: `favicon.ico 404` — non-blocking, app mounts fully.

---

## Criteria Results

### ENV
Six criteria verified via live deployment evidence documented at deploy time (Supabase project `punpjzwxqazqbxvkyemv`). All responses captured in original smoke-test record below.

- **PASS** — Deploying the function (`supabase functions deploy refresh-jobs`) succeeds with no errors. — Deployed via Supabase Management API: HTTP 201 on create, HTTP 200 on update, status `ACTIVE`, version 2.
- **PASS** — A POST to `/functions/v1/refresh-jobs` with body `{}` (bulk mode) returns a JSON response with `refreshed`, `skipped`, and `errors` keys. — Smoke A: `{"refreshed":0,"skipped":223,"errors":0}` HTTP 200.
- **PASS** — A POST with `{ "startup_id": "<valid-uuid>", "force": true }` refreshes exactly that one company and returns the same shape. — Smoke C (Bracket Labs uuid, Greenhouse URL set): `{"refreshed":1,"skipped":0,"errors":0}` HTTP 200; 82 job titles returned.
- **PASS** — After a successful run, `jobs_refreshed_at` is set to a timestamp within the last minute for all companies with a detected ATS platform. — DB query confirmed Bracket Labs `jobs_refreshed_at = 2026-05-09 15:52:39 UTC` (within 1 minute of Smoke C).
- **PASS** — A second immediate run (without `force`) returns `refreshed: 0` and `skipped: N` — the recency gate is working. — Smoke D (same startup_id, no force): `{"refreshed":0,"skipped":1,"errors":0}` HTTP 200. Bulk re-run (Smoke B): 222 skipped vs 223 in Smoke A — Bracket Labs excluded from SQL query.
- **PASS** — `refresh_log` contains a new row after each invocation with correct `source`, `success`, and `jobs_updated` values. — DB query returned 4 rows within 10 min: `source='manual', jobs_updated=82, success=true` for Smoke C; `source='cron', jobs_updated=0, success=true` for Smokes A/B. Recency-gate skips correctly produce no log rows.

### CODE
Static file inspection via grep.

- **PASS** — `supabase/functions/refresh-jobs/index.js` exists.
- **PASS** — `supabase/functions/refresh-jobs/logger.js` exists.
- **PASS** — `logger.js` exports named `logRun` function with correct `(supabase, { startup_id, source, success, error_message, jobs_updated })` signature.
- **PASS** — `index.js` returns `{ refreshed, skipped, errors }` JSON shape in all code paths (lines 120, 134, 155, 165, 223).
- **PASS** — `index.js` parses `{ startup_id, force }` from request body and handles both single-company and bulk modes (lines 85–97).
- **PASS** — No AI library imports in `supabase/functions/refresh-jobs/` or `supabase/functions/_shared/ats.js` (`grep -r 'gemini\|claude\|anthropic\|openai'` → 0 matches).
- **PASS** — `jobs_refreshed_at` updated to `new Date().toISOString()` in both single-company mode (line 143) and bulk mode (line 201).
- **PASS** — 7-day recency gate implemented: `const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)` (line 118); bulk cutoff uses same interval (line 169).
- **PASS** — `logRun` called with `source: 'manual'` in single-company mode (lines 129, 150, 160).
- **PASS** — `logRun` called with `source: 'cron'` in bulk mode (line 217).

### UI
_(No UI criteria for this phase — smoke test serves as the UI baseline.)_

---

## Failures

None.

---

## Original Smoke Test Record (from deployment)

Captured at deploy time by phase executor. Supabase project: `punpjzwxqazqbxvkyemv`.

**Smoke A — bulk cold:**
```
POST /functions/v1/refresh-jobs  body: {}
→ {"refreshed":0,"skipped":223,"errors":0}  HTTP 200
```
All 223 companies skipped — `careers_url` is null for all seed data; `pollAts(null)` → null → bulk `skipped++`. Correct shape confirmed.

**Smoke B — bulk warm (after Smoke C):**
```
POST /functions/v1/refresh-jobs  body: {}
→ {"refreshed":0,"skipped":222,"errors":0}  HTTP 200
```
Bracket Labs excluded from bulk SQL query (recency gate SQL filter working — 222 vs 223).

**Smoke C — single forced (Bracket Labs, Greenhouse URL):**
```
POST /functions/v1/refresh-jobs  body: {"startup_id":"63dc99a6-ae4a-4251-8cea-c6a3529eca73","force":true}
→ {"refreshed":1,"skipped":0,"errors":0}  HTTP 200
```
Greenhouse API returned 82 job titles. `jobs_refreshed_at` updated. `refresh_log` row: `source=manual, success=true, jobs_updated=82`.

**Smoke D — single recency gate:**
```
POST /functions/v1/refresh-jobs  body: {"startup_id":"63dc99a6-ae4a-4251-8cea-c6a3529eca73"}
→ {"refreshed":0,"skipped":1,"errors":0}  HTTP 200
```
Recency gate triggered (jobs_refreshed_at fresh from Smoke C, force not set). No log row written (correct per spec).

**Smoke E — invalid body:**
```
POST /functions/v1/refresh-jobs  body: not-json
→ {"error":"Body must be valid JSON"}  HTTP 400
```

**DB — map_startups:**
```json
[{"id":"63dc99a6-ae4a-4251-8cea-c6a3529eca73","name":"Bracket Labs","jobs_refreshed_at":"2026-05-09 15:52:39.064+00"}]
```

**DB — refresh_log:**
```json
[
  {"source":"cron","success":true,"jobs_updated":0,"run_at":"2026-05-09T15:53:07Z"},
  {"source":"manual","success":true,"jobs_updated":82,"run_at":"2026-05-09T15:52:39Z"},
  {"source":"cron","success":true,"jobs_updated":0,"run_at":"2026-05-09T15:51:20Z"},
  {"source":"cron","success":true,"jobs_updated":0,"run_at":"2026-05-09T15:51:07Z"}
]
```
