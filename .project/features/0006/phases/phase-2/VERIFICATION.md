# VERIFICATION — Feature 0006 Phase 2

**Date:** 2026-05-09 18:12
**Phase:** Claim Flow Frontend
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 1    | 0    | 0    | 1     |
| CODE       | 7    | 0    | 0    | 7     |
| UI         | 3    | 0    | 2    | 5     |
| **Total**  | 12   | 0    | 2    | 14    |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

---

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

App loaded with title "Utah Startup Map". Full DOM content rendered: nav links, map view with 224 companies, filter sidebar with all controls. No console errors.

---

## Criteria Results

### ENV
- **PASS** — Dev server running and responding (HTTP 200 at http://localhost:5173)

### CODE
- **PASS** — `claimGuard` exported from `goed/src/router/guards.js` (line 42)
- **PASS** — Route `{ path: '/company/:id/claim', name: 'ClaimLogin' }` registered in `router/index.js` (line 22)
- **PASS** — Route `{ path: '/company/:id/edit', name: 'CompanyEdit', beforeEnter: claimGuard }` registered in `router/index.js` (line 23)
- **PASS** — `SubmitResult.vue` has ClaimLogin CTA with `result.startup_id` in both `pending` (line 75) and `auto_published` (line 62) sections; no `/admin` hardcoded link
- **PASS** — `CompanyDrawer.vue` has "Claim your listing" `<router-link :to="{ name: 'ClaimLogin', params: { id: company.id } }">` (line 142)
- **PASS** — `useClaimAuth.js` exports `requestClaim`, `isOwner`, `signInWithOtp`; calls `supabase.functions.invoke('claim-company', ...)` then `supabase.auth.signInWithOtp`
- **PASS** — `ClaimLoginView.vue` exists (107 lines); fetches `map_startups.name` on mount; renders email input form with submit button; watches `isOwner` and redirects

### UI
- **PASS** — Navigating to `/company/00000000-0000-0000-0000-000000000001/edit` without a session redirected to `/company/00000000-0000-0000-0000-000000000001/claim` (confirmed via Playwright URL change)
- **PASS** — ClaimLoginView renders with heading "Claim this listing", email input (`type=email`, placeholder "you@example.com"), and "Send magic link" submit button
- **PASS** — Playwright: navigated to `/company/<test-id>/edit`, confirmed redirect to `/company/<test-id>/claim`, confirmed email input present
- **SKIP** — Submitting a mismatched email domain shows an error — requires live edge function call with a real company UUID in the database; cannot verify without seeded data
- **SKIP** — Submitting a matching email → `claim-company` row inserted + Supabase OTP sent — requires live DB row + email delivery; verify manually via Supabase Auth logs

---

## Failures

_(none)_
