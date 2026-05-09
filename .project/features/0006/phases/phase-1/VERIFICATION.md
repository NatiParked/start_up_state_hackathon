# VERIFICATION — Feature 0006 Phase 1

**Date:** 2026-05-09 17:57
**Phase:** Database & Edge Function
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 3    | 3     |
| CODE       | 3    | 0    | 0    | 3     |
| UI         | 0    | 0    | 0    | 0     |
| **Total**  | 4    | 0    | 3    | 7     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
App loaded with title "Utah Startup Map". DOM has banner, navigation, and main content area. One console error: `favicon.ico 404` — non-critical, does not affect app mounting.

## Criteria Results

### ENV
- **SKIP** — POST `{ startup_id: <valid id>, claimer_email: 'admin@thatcompany.com' }` where website is `https://thatcompany.com` → 200 `{ ok: true }`, row appears in `company_claims` — requires live edge function invocation with test data; blocked by `verify_jwt: true` on the deployed function (see note below)
- **SKIP** — POST with mismatched email domain → 400 `EMAIL_DOMAIN_MISMATCH` — same blocker
- **SKIP** — Duplicate POST (same startup_id + email) → 200 `{ ok: true }` (idempotent) — same blocker

### CODE
- **PASS** — `supabase migration up` applies `0003_claims.sql` cleanly: file exists at `supabase/migrations/0003_claims.sql`; migration listed as applied in Supabase (`version 20260509175304`, name `0003_claims`)
- **PASS** — `select * from company_claims` returns empty set with expected columns: DB query confirmed columns `id (uuid)`, `startup_id (uuid)`, `claimer_email (text)`, `created_at (timestamptz)` — all NOT NULL; row count = 0
- **PASS** — `select get_company_view_stats('<any uuid>'::uuid)` returns `{"views_this_week": 0, "views_total": 0}`: DB query returned `{"views_total":0,"views_this_week":0}` ✓

Additional code-level verifications (beyond stated criteria):
- Migration has unique constraint on `(startup_id, claimer_email)` ✓
- Migration has B-tree index on `startup_id` ✓
- RLS enabled; SELECT policy `"claimer read own"` confirmed via `pg_policies` ✓
- `grant execute on function get_company_view_stats(uuid) to anon, authenticated` present ✓
- Edge function `claim-company` deployed and ACTIVE (id `22c28a85-19b4-4e9b-a939-82d3066e69c6`) ✓
- Edge function imports `createAdminClient` from `_shared/supabaseAdmin.js` ✓
- CORS preflight handler present ✓
- Domain normalization logic correctly extracts hostname, strips `www.`, lowercases ✓
- Returns `EMAIL_DOMAIN_MISMATCH` (400) on domain mismatch ✓
- Upsert uses `onConflict: 'startup_id,claimer_email', ignoreDuplicates: true` for idempotency ✓
- No OTP/email calls in edge function (client sends OTP) ✓

### UI
_(No UI criteria for Phase 1 — smoke test serves as the UI baseline.)_

## Failures

None.

## Notes

**⚠ Concern for Phase 2:** The deployed `claim-company` function has `verify_jwt: true`. The Phase 2 flow requires an unauthenticated founder to POST to this function before receiving the OTP magic link. With JWT verification enabled, the Supabase edge function runtime will reject the request with 401 before the function code runs. The function needs `verify_jwt: false` (matching `onboard-company`) to work correctly in the Phase 2 claim flow.
