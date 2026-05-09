# VERIFICATION — Feature 0005 Phase 2

**Date:** 2026-05-09 16:51
**Phase:** Admin Shell & Dashboard
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 9    | 0    | 0    | 9     |
| UI         | 0    | 0    | 5    | 5     |
| **Total**  | 10   | 0    | 5    | 15    |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

App mounts fully. Map renders with 223 companies visible, filter sidebar active, all nav links present (Map, Navigator, Submit, Admin, Roadmap, Subscribe). Only console error was `favicon.ico` 404 — non-critical, does not affect app mounting. Page title: "Utah Startup Map".

## Criteria Results

### ENV
_(No ENV criteria for this phase)_

### CODE

- **PASS** — `goed/src/views/admin/AdminLayout.vue` exists
- **PASS** — `goed/src/views/admin/AdminDashboard.vue` exists
- **PASS** — GSAP slide-in animation present in AdminLayout.vue: `gsap.from(sidebarEl.value, { x: '-100%', duration: 0.2, ease: 'power2.out' })`
- **PASS** — All five sidebar nav links coded in AdminLayout.vue: Dashboard, Submissions, Companies, Refresh, Subscribers
- **PASS** — Sign out button calls `signOut()` and navigates to AdminLogin
- **PASS** — Router (`goed/src/router/index.js`) has all nested admin children: dashboard, submissions, companies, refresh, subscribers — all guarded by `adminGuard` on the parent `/admin` route
- **PASS** — AdminDashboard.vue has four live DB metric queries: pending submissions (`map_startup_submissions where status='pending'`), total companies (`map_startups`), hiring count (`map_startups where is_hiring=true`), last cron run (`map_refresh_log`)
- **PASS** — M9 cards coded with hardcoded `'0'` and `'—'` values, each with "Populates in M9" footnote (`<p v-if="metric.m9" ...>Populates in M9</p>`)
- **PASS** — No raw hex strings in AdminLayout.vue or AdminDashboard.vue templates (grep returned 0 matches)

### UI

All five UI criteria require an active admin session obtained via Supabase magic-link email. In automated non-interactive mode, email delivery cannot be triggered or intercepted, so these criteria cannot be tested via Playwright.

The route guard behaviour was partially verified: navigating to `http://localhost:5173/admin` without a session redirected immediately to `/admin/login` (confirmed via Playwright — page URL changed from `/admin` to `/admin/login`). This confirms the guard and router structure are wired correctly.

- **SKIP** — Visiting `/admin` while authenticated and allow-listed renders `AdminLayout` with sidebar slide-in animation and `AdminDashboard` in main pane — *requires admin auth session*
  - Code evidence: AdminLayout.vue + AdminDashboard.vue exist; GSAP animation present; router mounts AdminLayout as parent with AdminDashboard as default child; redirect to /admin/login confirmed for unauthenticated access.
- **SKIP** — All five sidebar links render and route correctly to nested admin routes — *requires admin auth session*
  - Code evidence: All five links (Dashboard, Submissions, Companies, Refresh, Subscribers) coded with correct route names in AdminLayout.vue; all five children registered in router.
- **SKIP** — Four live dashboard metrics reflect actual database state when dashboard loads — *requires admin auth session*
  - Code evidence: All four Supabase queries present in AdminDashboard.vue with correct table names and filters; loading skeleton pattern implemented.
- **SKIP** — M9 metric cards show `0` and `—` with visible "Populates in M9" footnote — *requires admin auth session*
  - Code evidence: Hardcoded `value: '0'` and `value: '—'` with `m9: true` flag; `v-if="metric.m9"` footnote present in template.
- **SKIP** — Clicking "Sign out" in sidebar calls `signOut()` and redirects to `/admin/login` — *requires admin auth session*
  - Code evidence: Sign out button calls `signOut()` from `useAdminAuth()` then routes to `{ name: 'AdminLogin' }`.

## Failures

_(None — 0 ENV failures, 0 CODE failures, 0 UI failures. UI criteria skipped due to automated-mode auth constraint.)_
