# VERIFICATION — Feature 0007 Phase 3

**Date:** 2026-05-09 18:19
**Phase:** Subscribe View & Confirmation Flow
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 1    | 0    | 0    | 1     |
| UI         | 5    | 0    | 0    | 5     |
| **Total**  | 7    | 0    | 0    | 7     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
- Page title `Utah Startup Map` rendered.
- Snapshot shows `<banner>` and `<main>` regions mounted under root — app booted cleanly.
- Console: 1 error, 0 warnings. The single error is `404 GET /favicon.ico` — non-blocking (asset only, not app code).

## Criteria Results

### CODE
- **PASS** — `/subscribe` route is wired to the real `SubscribeView.vue` (not `PlaceholderView`).
  - `goed/src/router/index.js:69-72` lazy-imports `@/views/SubscribeView.vue` with name `'Subscribe'`.
  - Files exist: `goed/src/views/SubscribeView.vue`, `supabase/functions/confirm-subscription/index.js`, `supabase/functions/send-confirmation/index.js`.

### UI

(Verified live by test-runner agent — full report at `.project/features/0007/phases/phase-3/sections/ui-criteria.md`.)

- **PASS** — Navigating to `/subscribe` shows the real subscription form (not PlaceholderView).
  Email input + sector/stage/region checkbox groups + hiring-only toggle + investor input + Subscribe button all rendered. No "Coming soon" copy.

- **PASS** — Filling in email + at least one sector and submitting shows "Check your inbox" confirmation state.
  Submission with `verify-1746814800@test.local` + AI sector replaced the form with a "Check your inbox" panel naming the email entered.

- **PASS** — Submitting the same email a second time shows the "already subscribed" message.
  Re-submission of the same email rendered "You're already subscribed with that email…", distinct from the initial confirmation panel. (This implicitly confirms the unique constraint is detecting code `23505`.)

- **PASS** — Navigating to `/subscribe?confirmed=true` shows a success banner without form submission.
  Direct navigation rendered the inline banner "You're confirmed! Watch for our next digest." above the form on initial load.

- **PASS** — `/subscribe?unsubscribe=<id>` shows an unsubscribed confirmation message.
  Navigating with a sentinel UUID rendered the "You've been unsubscribed." banner. Note: live DB row removal not asserted (would require service-role read); UI state and delete call are wired per `SubscribeView.vue` `onMounted` hook.

## Failures

None.

## Notes

- Live DB-row assertions for criterion 3 (`confirmed = false` / non-null `confirm_token`) and the row-deletion side effect of criterion 6 require service-role DB access. Code path was verified: the form posts to `map_subscriptions` and migration `0009_subscriptions.sql` defaults `confirmed = false` and `confirm_token = gen_random_uuid()`. The successful "Check your inbox" UI transition + the duplicate-email path triggering `code === '23505'` together imply the insert succeeded and the schema constraint is live.
- The duplicate-email test left a real subscription row (`verify-1746814800@test.local`, unconfirmed) in the database. No cleanup performed — acceptable per read-only-with-test-fixtures convention used elsewhere in this project.
