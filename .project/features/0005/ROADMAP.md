# Feature 0005: Admin Management UI

> Created: 2026-05-09
> Status: Draft
> Epic: 0001

## Overview

This feature delivers Milestone 6 of the Utah Startup Map epic: a protected `/admin` console giving GOED operations staff control over the live data pipeline. Authenticated allow-listed staff can review and approve/reject user submissions, edit any field on the `map_startups` table, manually trigger the M5 refresh Edge Function (bulk or per-company), and monitor a subscriber-statistics shell that M9 will populate later. The feature also ships the public `/roadmap` page used during judging to communicate the platform's product vision.

By the end of this feature, an end-to-end loop is verifiable: a staff member logs in via Supabase magic-link, opens the submission queue, approves a pending submission, and the new company appears on the public map within seconds; meanwhile, judges navigate to `/roadmap` and see a polished card grid of upcoming features.

## Problem Statement

Today the database is loaded by one-off scripts and there is no operator surface to manage data. User-submitted companies pile up in `map_startup_submissions` with no review path, errors in scraped/enriched data have no in-app correction tool, and the M5 refresh function can only be invoked via raw HTTP calls. Without a real admin console, GOED staff cannot run the platform day-to-day, and we cannot demonstrate operational maturity to judges.

The judging panel also expects to see the product's forward-looking vision (Stripe MRR leaderboard, LinkedIn integration, founder/investor matching, etc.). Without a `/roadmap` page, that vision lives only in slides and is not navigable inside the deployed product.

## User Stories

- As a GOED staff member, I want to log in to `/admin` via a magic-link sent to my GOED email so that only allow-listed operators can mutate live data.
- As a GOED reviewer, I want a queue of pending submissions with the original source preview alongside the extracted fields so that I can approve, reject, or edit-then-approve each one in seconds.
- As a GOED data steward, I want a searchable and sortable list of every `map_startups` row with a full edit form so that I can correct any field on any record without writing SQL.
- As a GOED operator, I want a "Refresh All" button and per-company refresh buttons that invoke the M5 Edge Function so that I can fix stale data without touching a terminal.
- As a GOED manager, I want a subscriber dashboard panel — even one showing zeros for now — so that the moment M9 lands the metrics show up automatically.
- As a hackathon judge, I want to navigate to `/roadmap` from the public site footer and see a polished card grid of planned features so that I can evaluate product vision alongside the working product.

---

## Codebase Context

### Technology Stack

Already installed and in use:
- Vue 3.5, Vue Router 5, Pinia 3, Vite 8 — JavaScript only (no TypeScript)
- Tailwind CSS with Utah brand tokens (`utah-blue: #0065A4`, `hiring-green`, `error-red`, `warning-yellow`)
- `@supabase/supabase-js` (anon client in `goed/src/lib/supabase.js`)
- GSAP for slide-in animations
- Supabase Edge Functions in JavaScript (Deno runtime) at `supabase/functions/<name>/index.js`

No new npm packages are required for this feature; everything builds on the M1 foundation.

### Relevant Directories

- `goed/src/views/admin/` — admin route-level views (new subfolder)
- `goed/src/views/RoadmapView.vue` — public roadmap page
- `goed/src/components/admin/` — admin-only reusable components (new subfolder)
- `goed/src/components/roadmap/` — roadmap card component (new subfolder)
- `goed/src/composables/` — `useAdminAuth.js` (new)
- `goed/src/stores/` — `admin.js` Pinia store (new)
- `goed/src/router/` — `index.js` (modify), `guards.js` (new)
- `goed/src/lib/` — `supabase.js` (modify if needed; service-role usage is server-side only)
- `supabase/migrations/` — `0006_admin_users.sql` (new)
- `supabase/functions/approve-submission/`, `supabase/functions/reject-submission/` (new Edge Functions)

### Conventions to Follow

- All Map product tables prefixed `map_` — `map_admin_users`, `map_startup_submissions`, `map_startups`, `map_refresh_log`. No exceptions.
- `<script setup>` only; SFC block order: `<script setup>` → `<template>` → `<style scoped>`.
- Setup-style Pinia stores: `export const useAdminStore = defineStore('admin', () => { ... })` exposing `isLoading: ref(false)` and `error: ref(null)` per house rule.
- `useX.js` naming for composables; named exports.
- Default exports for Vue components; named exports for composables/utils.
- Service functions in `goed/src/lib/` and admin actions return `{ data, error }` shape.
- Route names PascalCase: `'Admin'`, `'AdminLogin'`, `'AdminDashboard'`, `'AdminSubmissions'`, `'AdminCompanies'`, `'AdminRefresh'`, `'AdminSubscribers'`, `'Roadmap'`.
- Tailwind theme tokens only — no raw hex strings in templates.
- 2-space indent, single quotes, no semicolons, trailing commas.
- No `console.log` in committed code.
- No barrel/index.js files; always direct imports.
- JSDoc required on all exported functions in `goed/src/lib/` and `goed/src/composables/`.
- Edge Functions return `{ error: string, code: number }` on failure; use the Supabase service-role key (set in edge fn env, never in `goed/`).

---

## Implementation Plan

### Phase 1: Auth Foundation & Route Guard

**Goal:** Stand up the auth substrate — `map_admin_users` allow-list, route guard, magic-link login, admin Pinia store, and `useAdminAuth` composable — so that `/admin` is provably gated before any UI work begins.

**Tasks:**

- Create `supabase/migrations/0006_admin_users.sql` containing:
  - `create table map_admin_users (id uuid primary key default gen_random_uuid(), email text unique not null, created_at timestamptz default now())`
  - `alter table map_admin_users enable row level security;`
  - RLS policy: authenticated users may `select` from `map_admin_users` (so the client can verify its own email is in the allow-list); `insert`/`delete` reserved for service role.
  - RLS policy on `map_startup_submissions`: authenticated users whose email exists in `map_admin_users` may `select`, `update` (for `status` and `rejection_reason`), in addition to the existing public `insert` policy.
  - Add `rejection_reason text` column to `map_startup_submissions` if not already present, plus `reviewed_at timestamptz` and `reviewed_by text` columns for audit.
  - Seed three GOED allow-list rows via `insert into map_admin_users (email) values ('cayden@sempurnadev.com'), ('admin@goed.utah.gov'), ('staff@goed.utah.gov') on conflict (email) do nothing;` (placeholder addresses; real list confirmed at deploy).
- Create `goed/src/composables/useAdminAuth.js` — named exports:
  - `useAdminAuth()` returning `{ session, isAdmin, signInWithMagicLink, signOut, isCheckingAdmin }`
  - `session` ref derived from `supabase.auth.getSession()` and kept fresh via `supabase.auth.onAuthStateChange`
  - `isAdmin` computed: true iff `session.value?.user?.email` exists in `map_admin_users`
  - `signInWithMagicLink(email)` — calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/admin/dashboard' } })`; returns `{ data, error }`
  - `signOut()` — calls `supabase.auth.signOut()`
  - JSDoc on every exported function
- Create `goed/src/stores/admin.js` — Pinia setup store `useAdminStore`:
  - State refs: `session = ref(null)`, `submissions = ref([])`, `isLoading = ref(false)`, `error = ref(null)`
  - Computed: `isAdmin` (mirrors composable)
  - Actions: `fetchSubmissions()` (selects `map_startup_submissions` where `status = 'pending'` ordered by `submitted_at desc`), `setSession(session)`
  - Returns all state, computed, and actions via setup return
- Create `goed/src/router/guards.js` — named export `adminGuard(to, from, next)`:
  - Calls `supabase.auth.getSession()`; if no session, `next({ name: 'AdminLogin' })`
  - Queries `map_admin_users` for the session email; if not found, signs the user out and redirects to `AdminLogin` with a `?reason=not-allowed` query
  - Otherwise `next()`
- Wire `adminGuard` into `goed/src/router/index.js` against the parent `/admin` route (so it runs once for the whole admin section).
- Create `goed/src/views/admin/AdminLogin.vue` — public route at `/admin/login`:
  - Centered card with email input and "Send magic link" button
  - On success shows "Check your email — link sent to <email>"
  - If user is already authenticated and allow-listed, redirects immediately to `/admin/dashboard`
  - Renders an inline error notice if `?reason=not-allowed` is present in the query

**Success Criteria:**

- Migration `0006_admin_users.sql` applies cleanly; `map_admin_users` exists with at least one seed row and the new columns on `map_startup_submissions` are present.
- Visiting `/admin` while logged out redirects to `/admin/login`.
- Visiting `/admin` while logged in with a non-allow-listed email signs the user out and redirects to `/admin/login?reason=not-allowed` with a visible error notice.
- Submitting an allow-listed email on `/admin/login` triggers a Supabase magic-link email and shows the "Check your email" message.
- Clicking the magic link from the email lands the user on `/admin/dashboard` (which can be a bare placeholder at this phase) with `useAdminStore().isAdmin === true`.

---

### Phase 2: Admin Shell & Dashboard

**Goal:** Authenticated allow-listed staff land on a working admin shell with persistent navigation and a dashboard showing live operational metrics.

**Tasks:**

- Create `goed/src/views/admin/AdminLayout.vue`:
  - Two-column layout: left sidebar with five nav links (Dashboard, Submissions, Companies, Refresh, Subscribers) plus a "Sign out" button at the bottom; right pane is `<RouterView />` for the nested admin routes.
  - GSAP `gsap.from()` slide-in on the sidebar on `onMounted` (200ms, `power2.out`).
  - Sticky top bar showing current admin email and last login time, derived from `useAdminStore().session`.
  - All colors via Tailwind theme tokens (`bg-utah-blue`, `text-white`, etc.).
- Create `goed/src/views/admin/AdminDashboard.vue` — six metric cards in a responsive grid:
  - Pending submissions count (`select count(*) from map_startup_submissions where status = 'pending'`)
  - Total companies (`select count(*) from map_startups`)
  - Hiring companies count (`select count(*) from map_startups where is_hiring = true`)
  - Last cron run timestamp (most recent `created_at` from `map_refresh_log`)
  - Subscriber count — hardcoded `0` with a small "Populates in M9" footnote
  - Last digest send time — hardcoded "—" with the same footnote
  - Each card uses Tailwind brand tokens; loading states show a skeleton bar
- Update `goed/src/router/index.js`:
  - `/admin/login` → name `'AdminLogin'` → `AdminLogin` (no guard)
  - `/admin` → name `'Admin'` → `AdminLayout` (with `adminGuard`); children:
    - `''` (default) — redirects to `dashboard`
    - `dashboard` → `'AdminDashboard'` → `AdminDashboard`
    - `submissions` → `'AdminSubmissions'` → placeholder for Phase 3
    - `companies` → `'AdminCompanies'` → placeholder for Phase 3
    - `refresh` → `'AdminRefresh'` → placeholder for Phase 4
    - `subscribers` → `'AdminSubscribers'` → placeholder for Phase 4
- Confirm `goed/src/lib/supabase.js` is unchanged for the client (anon key); document in a header comment that service-role usage lives only in Edge Function `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, never in the Vue app.

**Success Criteria:**

- Visiting `/admin` while authenticated and allow-listed renders the `AdminLayout` with the sidebar slide-in animation and `AdminDashboard` mounted in the main pane.
- All five sidebar links render and route correctly to the nested admin routes (placeholders are acceptable for the Submissions/Companies/Refresh/Subscribers slots in this phase).
- The four live dashboard metrics (pending submissions, total companies, hiring count, last cron run) reflect the actual database state when the dashboard loads.
- The two M9 metric cards (subscriber count, last digest) show `0` and `—` respectively with a visible "Populates in M9" footnote.
- Clicking "Sign out" in the sidebar calls `signOut()` and redirects to `/admin/login`.

---

### Phase 3: Submission Queue & Company CRUD

**Goal:** Staff can review pending submissions and approve, reject, or edit-then-approve each one; staff can also search, sort, and edit any record in the `map_startups` table directly.

**Tasks:**

- Create `goed/src/views/admin/SubmissionQueue.vue`:
  - Table of `map_startup_submissions` filtered to `status = 'pending'`, ordered by `submitted_at desc`
  - Columns: submitted_at, name (from `startup_data->>name`), website, submitter email, action (View)
  - Clicking a row sets `selectedSubmissionId` and opens `SubmissionReview` as a slide-in panel (GSAP `from({ x: '100%' })`)
- Create `goed/src/components/admin/SubmissionReview.vue`:
  - Two-column layout. Left: pretty-printed extracted `startup_data` jsonb fields with each field labeled (name, website, sector, stage, description, etc.). Right: an `<iframe>` preview of the submitted website URL with a fallback "Open in new tab" link if the iframe fails to load.
  - Three action buttons: **Approve** (calls `approve-submission` Edge Function with the submission id), **Reject** (opens a small inline form for `rejection_reason` text, then calls `reject-submission`), **Edit-then-Approve** (opens an inline editable mirror of the `startup_data` form, on save passes the edited payload to `approve-submission`)
  - On success, removes the submission from the list and closes the panel.
- Create `supabase/functions/approve-submission/index.js`:
  - JS Edge Function (Deno runtime). Reads JSON body `{ submission_id, overrides? }` and a service-role Supabase client from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.
  - Verifies caller is an admin: extracts the user from the `Authorization: Bearer <jwt>` header via `supabase.auth.getUser(jwt)`, then confirms the email exists in `map_admin_users`. Returns `{ error: 'unauthorized', code: 401 }` on failure.
  - Reads the submission row, merges any `overrides` into `startup_data`, inserts the merged record into `map_startups`, and updates the submission to `status = 'approved'`, `reviewed_at = now()`, `reviewed_by = <email>`.
  - Returns `{ data: { startup_id }, error: null }` on success or `{ error, code }` on failure.
- Create `supabase/functions/reject-submission/index.js`:
  - Same auth pattern as approve. Reads `{ submission_id, rejection_reason }`.
  - Updates the submission to `status = 'rejected'`, `rejection_reason = <text>`, `reviewed_at = now()`, `reviewed_by = <email>`.
  - Returns `{ data: { submission_id }, error: null }` on success.
- Create `goed/src/views/admin/CompanyList.vue`:
  - Loads all rows from `map_startups` via `useStartupsStore().fetchAll()` (re-uses existing store)
  - Search box filters client-side by `name` (case-insensitive substring)
  - Sortable columns: name, sector, stage, created_at — clicking a header toggles asc/desc
  - Click row to open `CompanyEditor` in a slide-in panel
- Create `goed/src/components/admin/CompanyEditor.vue`:
  - Full edit form covering every column on `map_startups`: name, description, website, linkedin, address, city, lat, lng, region, sector, stage, funding_stage, business_type, employee_range, founded_year, is_hiring (checkbox), job_titles (comma-separated parsed to text[]), careers_url, logo_url, google_place_id, google_rating, phone, investors (comma-separated parsed to text[]), total_raised, verified
  - Save button calls `supabase.from('map_startups').update(payload).eq('id', id)` directly using the anon client (admin RLS permits update for allow-listed users — added in this phase's RLS update). Cancel discards changes.
  - Optimistic update of `useStartupsStore().companies` on success; rollback on error.
- RLS update (additive SQL applied via Supabase MCP `apply_migration` or appended to `0006_admin_users.sql`):
  - `create policy "admins update map_startups" on map_startups for update to authenticated using (auth.email() in (select email from map_admin_users)) with check (auth.email() in (select email from map_admin_users));`
  - `create policy "admins insert map_startups" on map_startups for insert to authenticated with check (auth.email() in (select email from map_admin_users));` (covers Edge Function inserts that occasionally use the user's JWT instead of service-role)

**Success Criteria:**

- `/admin/submissions` lists every pending row in `map_startup_submissions`; clicking a row opens `SubmissionReview` with extracted fields on the left and a website preview on the right.
- Clicking **Approve** moves the submission to `map_startups` (visible immediately on the public `/` map after a refetch) and marks the submission `approved` with `reviewed_by` set; the row disappears from the queue.
- Clicking **Reject** with a typed reason marks the submission `rejected` with `rejection_reason` persisted; the row disappears from the queue.
- `/admin/companies` lists all `map_startups` rows; the search box filters by name in real time and the column headers sort the table.
- Editing any field in `CompanyEditor` (e.g. changing `sector`, toggling `is_hiring`, adding to `investors`) and clicking Save persists the change to Supabase and the public map reflects the update on next load.

---

### Phase 4: Refresh Control, Subscriber Shell & Roadmap Page

**Goal:** Staff can manually trigger M5 refreshes (bulk and per-company) and watch a live tail of the refresh log; the subscriber panel shell is in place ready for M9; judges can navigate to a polished public `/roadmap` page.

**Tasks:**

- Create `goed/src/views/admin/RefreshControl.vue`:
  - Top section: prominent **"Refresh All"** button calling `supabase.functions.invoke('refresh-jobs', { body: {} })`; shows an inline spinner and disables the button during the call; surfaces the function's response message on completion.
  - Middle section: searchable list of all `map_startups` (re-uses `useStartupsStore`) with a per-row "Refresh" button calling `supabase.functions.invoke('refresh-jobs', { body: { startup_id: row.id } })`; each row reflects its `last_refreshed_at` timestamp.
  - Bottom section: live tail of the most recent 20 `map_refresh_log` entries. Polls every 5 seconds via `setInterval` while the page is mounted; clears the interval in `onUnmounted`. Each row shows timestamp, startup name (joined via `startup_id`), status, and the truncated message column.
- Create `goed/src/views/admin/SubscriberPanel.vue`:
  - Header card: "Subscriber Stats" with a yellow "Populates in M9" badge using `bg-warning-yellow text-utah-blue-dark`.
  - Three metric tiles, all hardcoded zero/placeholder for now: Total confirmed subscribers (`0`), Last digest sent (`Never`), Active filter saved searches (`0`).
  - Breakdown table with two sections — by sector and by stage — each showing a single row of `—` placeholders so the M9 implementer can swap in real values without changing the layout.
  - Inline note: "This panel is a UI shell. M9 (Notifications) populates the live data."
- Create `goed/src/views/RoadmapView.vue`:
  - Public route `/roadmap` (no guard). Hero header with "Where we're going" headline and a one-paragraph product-vision lede.
  - Responsive grid of `RoadmapCard` components driven by a static array defined in `<script setup>` covering: Stripe Verified MRR/ARR Leaderboard, LinkedIn Integration, Deeper Investor Analytics, Investors as First-Class Map Entities, Global Talent Identification & Recruitment Campaigns, Founder ↔ Investor Matching & Messaging, Mobile App, API Access, International Expansion Beyond Utah.
  - GSAP stagger fade-in on the cards on mount.
- Create `goed/src/components/roadmap/RoadmapCard.vue`:
  - Props: `title: String`, `description: String`, `status: String` (one of `Coming Soon`, `In Development`, `Planned`), `icon: String` (single emoji or short label, since no icon library is in scope)
  - Template: card with rounded border, brand-blue header bar, status badge in the corner — color varies by status (`bg-hiring-green` for In Development, `bg-utah-blue` for Coming Soon, `bg-warning-yellow` for Planned).
- Update `goed/src/App.vue` footer nav to link to `/roadmap` (the route already exists from Feature 0001 with a placeholder; this swaps the placeholder import for `RoadmapView`).
- Update `goed/src/router/index.js`:
  - Replace the existing `/roadmap` placeholder mapping with `() => import('@/views/RoadmapView.vue')`.
  - Add the `refresh` and `subscribers` admin children to point at the real components from this phase.

**Success Criteria:**

- Clicking **Refresh All** on `/admin/refresh` invokes the M5 `refresh-jobs` Edge Function, the button shows a loading state, and within ~5 seconds new `map_refresh_log` entries appear in the tail without a page reload.
- Clicking a per-company **Refresh** button invokes `refresh-jobs` with `{ startup_id }` and the corresponding company's `last_refreshed_at` updates after the call completes.
- `/admin/subscribers` renders the subscriber shell with the "Populates in M9" badge visible, all metric tiles showing zero/placeholder values, and the breakdown table laid out with `—` rows.
- `/roadmap` renders publicly (no auth required) showing all nine roadmap cards in a responsive grid with GSAP stagger fade-in; status badges display in the correct brand color for each status value.
- The footer link to `/roadmap` in `App.vue` navigates judges to the new page in one click from anywhere on the public site.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0006_admin_users.sql` | Create | `map_admin_users` table, RLS policies, audit columns on `map_startup_submissions`, admin update/insert policies on `map_startups` |
| `goed/src/composables/useAdminAuth.js` | Create | Auth state + allow-list check (session, isAdmin, signInWithMagicLink, signOut) |
| `goed/src/stores/admin.js` | Create | Pinia setup store: session, submissions, fetchSubmissions, isLoading, error |
| `goed/src/router/guards.js` | Create | `adminGuard` navigation hook checking session + `map_admin_users` |
| `goed/src/router/index.js` | Modify | Register nested admin routes under `/admin`, swap `/roadmap` placeholder for real view |
| `goed/src/views/admin/AdminLogin.vue` | Create | Magic-link login screen with `?reason=not-allowed` notice |
| `goed/src/views/admin/AdminLayout.vue` | Create | Sidebar nav + RouterView shell with GSAP slide-in |
| `goed/src/views/admin/AdminDashboard.vue` | Create | Six metric cards (4 live, 2 M9 placeholders) |
| `goed/src/views/admin/SubmissionQueue.vue` | Create | Pending submissions table |
| `goed/src/components/admin/SubmissionReview.vue` | Create | Side-by-side review panel with Approve/Reject/Edit-then-Approve |
| `goed/src/views/admin/CompanyList.vue` | Create | Searchable, sortable list of all `map_startups` |
| `goed/src/components/admin/CompanyEditor.vue` | Create | Full edit form for every `map_startups` column |
| `goed/src/views/admin/RefreshControl.vue` | Create | Bulk + per-company refresh buttons + live `map_refresh_log` tail |
| `goed/src/views/admin/SubscriberPanel.vue` | Create | M9 shell — zero metrics + breakdown placeholders |
| `supabase/functions/approve-submission/index.js` | Create | Edge Function: move submission → `map_startups`, mark approved |
| `supabase/functions/reject-submission/index.js` | Create | Edge Function: mark submission rejected with reason |
| `goed/src/views/RoadmapView.vue` | Create | Public `/roadmap` page with hero + card grid |
| `goed/src/components/roadmap/RoadmapCard.vue` | Create | Vision feature card (icon, title, description, status badge) |
| `goed/src/App.vue` | Modify | Footer link to `/roadmap` |

---

## Testing Strategy

No automated test framework is in scope during the hackathon. Verification is manual and observable, executed at the end of each phase per the success criteria above.

### Manual Verification Checklist (end of feature)

- Logged-out visit to `/admin` redirects to `/admin/login`.
- Magic-link login with an allow-listed email lands on `/admin/dashboard` with all six metric cards rendered.
- Magic-link login with a non-allow-listed email returns to `/admin/login?reason=not-allowed` with a visible error.
- Submission queue lists at least one pending submission; Approve moves it to `map_startups` and the company appears on the public `/` map after a refetch; Reject persists `rejection_reason`.
- Company list search filters by name as you type; sort headers reorder the table; opening any record in `CompanyEditor`, changing a field, and saving persists to Supabase.
- "Refresh All" on `/admin/refresh` triggers `refresh-jobs` and new `map_refresh_log` entries show up in the tail within ~5s; per-company refresh updates that row's `last_refreshed_at`.
- `/admin/subscribers` shows the M9 shell with the "Populates in M9" badge.
- `/roadmap` (public) renders all nine vision cards with GSAP fade-in and footer-nav link works.

---

## Dependencies

### Prerequisites

- Feature 0001 (Map Foundation) — provides `map_startups`, `map_startup_submissions`, `useStartupsStore`, router scaffold, Supabase client, Tailwind brand tokens.
- Feature 0003 / Milestone 3 — the public `/submit` flow that populates `map_startup_submissions` with `status='pending'` rows for staff to review.
- Feature 0004 / Milestone 5 — `refresh-jobs` Edge Function and `map_refresh_log` table consumed by `RefreshControl.vue`.
- Supabase Auth enabled on the project with magic-link (email OTP) provider configured and the SMTP/email sender verified.
- A confirmed allow-list of GOED staff emails for seeding into `map_admin_users` at deploy time.

### External Dependencies

- No new npm packages.
- No new external APIs — all interactions go through Supabase (Auth, Postgres, Edge Functions) which is already provisioned.

### Blocking/Blocked By

- **Blocks:** Feature 0006 / Milestone 9 (Notifications) populates the `SubscriberPanel.vue` shell built here. Without this feature, M9 has no admin surface to wire its metrics into.
- **Blocked by:** Features 0001, 0003, and 0004 must be merged and deployed first.

---

## Open Questions

- Final allow-list of GOED staff emails for the migration seed — should we ship with placeholder addresses and a follow-up "real allow-list" task, or wait for the confirmed list before merging? (Default assumption: ship with placeholders so the migration is reviewable, then update via a follow-on `0007_*` migration when the real list lands.)
- Should `CompanyEditor` writes go through the anon client + admin RLS policy (current plan, simpler) or through a dedicated `update-startup` Edge Function (more auditable)? (Default assumption: anon client + RLS for hackathon scope; revisit if audit logging becomes a requirement.)
- Should the `/roadmap` page include any "vote for next" or interest-capture interaction, or remain purely informational for the judging demo? (Default assumption: informational only; interactive variants slot into a later feature.)

