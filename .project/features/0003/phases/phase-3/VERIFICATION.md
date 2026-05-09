# VERIFICATION — Feature 0003 Phase 3

**Date:** 2026-05-09 13:57
**Phase:** onboard-company Edge Function
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 6    | 6     |
| CODE       | 6    | 0    | 0    | 6     |
| UI         | 0    | 0    | 0    | 0     |
| **Total**  | 7    | 0    | 6    | 13    |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

App loaded as "Utah Startup Map". Full map with OpenLayers pins, filter sidebar (Sector, Stage, Company Size, Hiring, Region, Investors, Founded Year), stats bar (223 companies, 55 hiring, 134 with investors), and navigation links (Map, Navigator, Submit, Admin, Roadmap, Subscribe) all rendered correctly. Only console error was favicon.ico 404 — non-critical, does not affect app mounting.

## Criteria Results

### ENV
All 6 ENV criteria require live Supabase Edge Function invocation + database access. `supabase` CLI is not installed in this environment, so runtime invocation is not possible. All 6 are SKIP. CODE-level analysis (below) confirms the implementation satisfies the intent of each criterion.

- **SKIP** — `supabase functions invoke onboard-company` returns JSON with `status` of `'auto_published'` or `'pending'` — _Supabase CLI not installed; see CODE check C1_
- **SKIP** — Quality gate pass → `map_startups` row with `verified = false` — _requires live DB; see CODE check C2_
- **SKIP** — Quality gate fail → `map_startup_submissions` with `status = 'pending'` and non-null `rejection_reason` — _requires live DB; see CODE check C3_
- **SKIP** — Duplicate URL → no second `map_startups` row; returns existing `startup_id` — _requires live DB; see CODE check C4_
- **SKIP** — Non-Utah company URL fails quality gate with Utah-bounds reason → pending review — _requires live invocation; see CODE check C5_
- **SKIP** — Malformed URL → `{ error, code }` JSON response, not unhandled exception — _requires live invocation; see CODE check C6_

### CODE
Supplemental code-level checks confirm each criterion's logic is correctly implemented:

- **PASS** — C1: `index.js` contains two `return jsonResponse({ status: 'auto_published', ... })` paths and one `return jsonResponse({ status: 'pending', ... })` path; no path exits without a `status` field in the response body.
- **PASS** — C2: `index.js:194` builds `mapStartupsPayload = { ...scalars, verified: false }` and inserts into `map_startups`; `{ status: 'auto_published', startup_id, company: record }` returned.
- **PASS** — C3: `index.js:173–189` inserts into `map_startup_submissions` with `status: 'pending'` and `rejection_reason: gateResult.reason`; `gateResult.reason` is always a non-null string when `passed: false` (per `quality-gate.js`).
- **PASS** — C4: `quality-gate.js:59–88` queries `map_startups` and `map_startup_submissions` for matching domain; on duplicate, returns `{ passed: false, existing_id }`. `index.js:146–171` handles `gateResult.existing_id` — returns `{ status: 'auto_published', startup_id: gateResult.existing_id }` without inserting a new `map_startups` row.
- **PASS** — C5: `utah-bounds.js:20–28` implements `isInsideUtah` with lat 37.0–42.0, lng -114.05–-109.05. `quality-gate.js:48–53` returns `{ passed: false, reason: 'Coordinates are outside Utah bounding box ...' }` for out-of-bounds coordinates. A San Francisco company (lat ~37.77, lng ~-122.4) fails `lng >= -109.05` and would return a Utah-bounds rejection reason.
- **PASS** — C6: `index.js:108–115` validates the `url` field; malformed URLs fail `new URL(url)` and return `errorResponse('INVALID_INPUT', '...', 400)` which calls `jsonResponse({ error: message, code }, 400)` — a proper `{ error, code }` response at all times via the `errorResponse` helper.

### UI
_No UI criteria defined for Phase 3 — smoke test (step 5) serves as the UI baseline._

## Failures

_None — all checks passed or were skipped due to environment constraints._
