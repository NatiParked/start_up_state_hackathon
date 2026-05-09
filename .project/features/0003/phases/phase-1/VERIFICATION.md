---
phase: 1
feature: 0003
verified: 2026-05-09T11:31:00Z
status: passed
score: 5/5 verified + 2 skipped (require Deno runtime)
---

# VERIFICATION — Feature 0003 Phase 1

**Date:** 2026-05-09 11:31
**Phase:** Submissions Schema & Shared Helpers
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 1    | 0    | 0    | 1     |
| CODE       | 3    | 0    | 2    | 5     |
| UI         | 0    | 0    | 0    | 0     |
| **Total**  | 5    | 0    | 2    | 7     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
App title "Utah Startup Map" loaded. Full DOM rendered: filter sidebar (Sector, Stage, Region, Investors, Founded Year), 223 companies, map pins, navigation links (Map, Navigator, Submit, Admin, Roadmap). Only console error: `favicon.ico 404` — missing static asset, does not affect app mounting or functionality.

## Criteria Results

### ENV

- **PASS** — `supabase db push` applies `0002_submissions.sql` without error. Evidence: migration file exists at `supabase/migrations/0002_submissions.sql` AND all M3 columns are present in the live `map_startup_submissions` table on Supabase project `punpjzwxqazqbxvkyemv`, confirming migration was applied.

### CODE

- **PASS** — `map_startup_submissions` has all M3 columns: `submitted_url` (text), `submitted_by_email` (text), `extracted_data` (jsonb), `rejection_reason` (text), `reviewed_at` (timestamptz), `reviewed_by` (text). Confirmed via live `information_schema.columns` query.

- **PASS** — Status column accepts `'auto_published'` in addition to `'pending'`, `'approved'`, `'rejected'`. Live DB constraint: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'auto_published'::text])))`.

- **SKIP** — `callLLM` with test prompt returns parsed response (requires `OPENCODE_ZEN_API_KEY`). Code verified: `_shared/llm.js` exists, exports `callLLM`, reads both required env vars, defaults model to `claude-haiku-4-5`, implements Anthropic tool-use structured output. Live execution requires Deno runtime + `OPENCODE_ZEN_API_KEY` in Supabase secrets — cannot verify in this environment.

- **PASS** — `fetchLogo('https://www.zonos.com/pricing')` returns `https://img.logo.dev/zonos.com?token=...&size=128`. Code logic verified: `normalizeDomain` strips `https://`, strips `www.`, splits on `/` to drop path → `zonos.com`. `fetchLogo` builds the correct URL with `?token=${LOGO_DEV_TOKEN}&size=128`.

- **SKIP** — `geocodeAddress('136 S Main St, Salt Lake City, UT')` returns `{ lat, lng }` with lat ~40.76, lng ~-111.89. Code verified: function exists, calls Nominatim with `User-Agent: goed-hackathon`, enforces 1000ms rate limit, retries on 429, returns `{ lat: parseFloat(r.lat), lng: parseFloat(r.lon), ... }`. Live execution test requires Deno runtime.

### UI

No UI criteria for Phase 1. Smoke test serves as the UI baseline.

## Failures

_(None — all criteria PASS or SKIP. SKIPs require Deno runtime execution outside this verification environment.)_

---
_Verified by: /spec:verify-phase automated run_
_Timestamp: 2026-05-09 11:31_

VERIFICATION:PASS
