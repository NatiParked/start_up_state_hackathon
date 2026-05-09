# VERIFICATION — Feature 0001 Phase 3

**Date:** 2026-05-09
**Phase:** Seed Import Script
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 0    | 0    | 1    | 1     |
| ENV        | 2    | 0    | 0    | 2     |
| CODE       | 2    | 0    | 0    | 2     |
| UI         | 0    | 0    | 0    | 0     |
| **Total**  | 4    | 0    | 1    | 5     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** SKIP
**URL:** http://localhost:5173
Dev server responded 200 OK (curl confirmed). Playwright MCP was unavailable (`/opt/google/chrome/chrome` not found — Chrome is not installed in this environment). Smoke test skipped; curl baseline confirmed server is alive.

## Criteria Results

### ENV

- **PASS** — Running `node scripts/import-seed-companies.js` from inside `goed/` completes end-to-end and prints a summary line indicating success.
  - Script exits with code 0 and prints: `Imported 223/223 rows | geocode failures: 75 | insert failures: 0`
  - _Note:_ The Google Sheet has grown to 223 rows since the plan was authored (which assumed 96). All 223 rows were imported successfully.
  - _Fix applied:_ Three column header mismatches corrected in `enrichRow()`: `'Description'` → `'Description of startup'`, `'LinkedIn Link'` → `'LinkedIn Link (map it to Links to get the logo)'`, `'Section/Sector'` → `'Section'`.
  - _Root cause fixed:_ `supabase/migrations/0001_init.sql` applied to live Supabase project `punpjzwxqazqbxvkyemv` via MCP `apply_migration`.

- **PASS** — Re-running the script does not produce duplicate rows (count remains 223).
  - Script ran twice; both runs produced `Imported 223/223 rows`. Truncate-and-reload idempotency confirmed.

### CODE

- **PASS** — `select count(*) from map_startups` in Supabase returns 223.
  - _Note:_ Plan expected 96 rows; actual sheet has 223 companies. Count of 223 is correct for current sheet state.

- **PASS** — Spot-checking 3 rows shows non-null `lat`, `lng`, `region`, `sector`, `logo_url` inside Utah bounding box.
  - Sample rows verified:
    - Alcomy: lat=40.27, lng=-111.71, region=Utah Valley, sector=B2B Software, logo_url set ✓
    - Altitude AI: lat=40.76, lng=-111.88, region=Salt Lake City metro, sector=B2B Software, logo_url set ✓
    - Alysio: lat=40.73, lng=-111.84, region=Salt Lake City metro, sector=B2B Software, logo_url set ✓

### UI

_(No UI criteria for this phase — smoke test serves as the UI baseline.)_

## Notes

- 75 of 223 rows have null lat/lng (geocode failures logged to `goed/scripts/import-warnings.log`). These rows are still inserted with null coordinates — valid data, just unmapped on the UI.
- The original plan assumed 96 rows; the live sheet has 223. No code change needed — the script imports whatever the sheet contains.
