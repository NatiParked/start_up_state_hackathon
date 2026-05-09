# VERIFICATION — Feature 0005 Phase 1

**Date:** 2026-05-09 16:34
**Phase:** Phase 1: Auth Foundation & Route Guard
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 1    | 0    | 1    | 2     |
| UI         | 0    | 2    | 2    | 4     |
| **Total**  | 2    | 2    | 3    | 7     |

**Overall: FAIL**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
App loaded fully — Utah Startup Map rendered with 223 companies, filter sidebar, and full navigation. Only console error was a favicon 404, which is not an app-mounting failure.

## Criteria Results

### ENV
_(No ENV criteria for this phase)_

### CODE

- **PASS** — Migration `supabase/migrations/0006_admin_users.sql` exists and contains: `CREATE TABLE IF NOT EXISTS map_admin_users` with `id`, `email`, `created_at` columns; `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS rejection_reason/reviewed_at/reviewed_by`; seed rows for `cayden@sempurnadev.com`, `admin@goed.utah.gov`, `staff@goed.utah.gov`; RLS policies on both tables.
- **SKIP** — `map_admin_users` exists in live DB with at least one seed row and audit columns applied to `map_startup_submissions` — requires live DB access to verify; migration file content is correct but apply status unknown.

### UI

- **FAIL** — Visiting `/admin` while logged out redirects to `/admin/login`
  - Navigated to `http://localhost:5173/admin`; URL stayed at `/admin` and page rendered an empty PlaceholderView (blank main area). No redirect occurred. Root cause: `goed/src/router/index.js` maps `/admin` to `PlaceholderView.vue` with no `adminGuard` and no nested children; `goed/src/router/guards.js` does not exist.

- **SKIP** — Visiting `/admin` while logged in with a non-allow-listed email signs the user out and redirects to `/admin/login?reason=not-allowed` with a visible error notice — requires authenticated browser session, which cannot be obtained without a working `/admin/login` route.

- **FAIL** — Submitting an allow-listed email on `/admin/login` triggers a Supabase magic-link email and shows the "Check your email" message
  - `/admin/login` is not registered in `goed/src/router/index.js`; `goed/src/views/admin/AdminLogin.vue` does not exist. The route is unreachable.

- **SKIP** — Clicking the magic link from the email lands the user on `/admin/dashboard` with `useAdminStore().isAdmin === true` — requires real email delivery and magic-link auth flow; cannot be verified without a working login screen.

## Failures

- **[UI] Criterion 2** — Visiting `/admin` while logged out does NOT redirect to `/admin/login`. Router maps `/admin` to `PlaceholderView.vue` with no navigation guard. `guards.js` is missing. `AdminLogin.vue` is missing.
- **[UI] Criterion 4** — `/admin/login` form does not exist. `AdminLogin.vue` not created, route not registered in router.

## Missing Files (root cause)

The following files defined in the Phase 1 task list have not been created:
- `goed/src/composables/useAdminAuth.js`
- `goed/src/stores/admin.js`
- `goed/src/router/guards.js`
- `goed/src/views/admin/AdminLogin.vue`

And `goed/src/router/index.js` has not been updated to add admin routes or the navigation guard.
