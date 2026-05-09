# VERIFICATION — Feature 0005 Phase 1

**Date:** 2026-05-09 16:43
**Phase:** Phase 1: Auth Foundation & Route Guard
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 1    | 0    | 0    | 1     |
| UI         | 3    | 0    | 1    | 4     |
| **Total**  | 5    | 0    | 1    | 6     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

App loaded with full DOM content — 223 companies on the map, filter panel, all navigation links (Map, Navigator, Submit, Admin, Roadmap, Subscribe). Only console error was a favicon 404, which does not affect app mounting.

## Criteria Results

### ENV
_(No ENV criteria for this phase.)_

### CODE

- **PASS** — Migration `0006_admin_users.sql` applies cleanly; `map_admin_users` exists with at least one seed row and the new columns on `map_startup_submissions` are present.
  - File `supabase/migrations/0006_admin_users.sql` exists ✓
  - Supabase DB: `map_admin_users` has 3 seed rows ✓
  - Columns `rejection_reason`, `reviewed_at`, `reviewed_by` present on `map_startup_submissions` ✓
  - `useAdminAuth.js`, `stores/admin.js`, `router/guards.js`, `views/admin/AdminLogin.vue` all exist ✓
  - `adminGuard` exports session-check + allow-list query + correct redirect logic ✓
  - `useAdminAuth()` returns `{ session, isAdmin, isCheckingAdmin, signInWithMagicLink, signOut }` with JSDoc ✓
  - `useAdminStore` exposes `isLoading`, `error`, `fetchSubmissions`, `setSession` ✓
  - No raw hex strings in `goed/src/views/admin/*.vue` ✓

### UI

- **PASS** — Visiting `/admin` while logged out redirects to `/admin/login`.
  - Navigated to `http://localhost:5173/admin`; Playwright landed on `http://localhost:5173/admin/login` showing "Admin Sign In" form. Redirect chain: `/admin` → `/admin/dashboard` (router redirect) → `adminGuard` fires → no session → `next({ name: 'AdminLogin' })`.

- **PASS** — Visiting `/admin` while logged in with a non-allow-listed email signs the user out and redirects to `/admin/login?reason=not-allowed` with a visible error notice.
  - `guards.js:26-28` correctly signs out and redirects with `query: { reason: 'not-allowed' }` ✓
  - Navigated to `/admin/login?reason=not-allowed`; snapshot shows: "That email is not on the admin allow-list." ✓
  - Live auth flow with non-allow-listed session not testable in automated mode; code path verified via source inspection.

- **PASS** — Submitting an allow-listed email on `/admin/login` triggers a Supabase magic-link email and shows the "Check your email" message.
  - Filled email field with `cayden@sempurnadev.com`, clicked "Send magic link". After 2s snapshot shows: "Check your email — link sent to cayden@sempurnadev.com" ✓
  - Form hides after submission (only confirmation message visible) ✓

- **SKIP** — Clicking the magic link from the email lands the user on `/admin/dashboard` with `useAdminStore().isAdmin === true`.
  - Cannot test in automated mode: requires receiving a real magic-link email and clicking it. Router config confirms `/admin/dashboard` is the `emailRedirectTo` destination. `AdminDashboard.vue` exists at that route. Verify manually.

## Failures

_(None — all testable criteria passed.)_
