# Feature Plan: Admin Management UI — Phase 1: Auth Foundation & Route Guard

## Objective

Stand up the auth substrate that gates every future admin feature. By the end of this phase, the `/admin` URL is provably gated: an allow-list table (`map_admin_users`) governs access, a route guard enforces it, magic-link login backs it, and a Pinia store + composable expose `isAdmin` to the rest of the app. No admin UI work (queue, drawer, rejection modal) happens until this gate is verified — every later phase assumes a logged-in, allow-listed user is the only thing that can reach `/admin/*` routes.

**Purpose:** Lock down admin surface area before building it. RLS + route guard form a defense-in-depth pair so a bug in one doesn't expose the queue.
**Output:** A migration, a composable, a Pinia store, a router guard wired into `/admin`, and a public `AdminLogin.vue` view.

## Must-Haves (Goal-Backward)

### Observable Truths

- Visiting `/admin` while logged out redirects to `/admin/login`.
- Visiting `/admin` while logged in with a non-allow-listed email signs the user out and redirects to `/admin/login?reason=not-allowed` with a visible error notice.
- Submitting an allow-listed email on `/admin/login` triggers a Supabase magic-link email and shows the "Check your email — link sent to <email>" confirmation.
- Clicking the magic link from the email lands the user on `/admin/dashboard` (placeholder for this phase) with `useAdminStore().isAdmin === true`.
- `map_admin_users` exists with at least one seed row and the new audit columns (`rejection_reason`, `reviewed_at`, `reviewed_by`) on `map_startup_submissions` are present (some already exist from migration `0002`; this migration must be idempotent and only add what is missing).
- An authenticated user whose email is in `map_admin_users` can `SELECT` and `UPDATE` `map_startup_submissions` (status, rejection_reason); a user whose email is NOT in the table cannot.

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `supabase/migrations/0006_admin_users.sql` | `map_admin_users` table, RLS policies (admin-gated by email lookup), audit columns on `map_startup_submissions`, three seed admin emails | (SQL) |
| `goed/src/composables/useAdminAuth.js` | Reactive session + admin-status composable | named: `useAdminAuth()` returning `{ session, isAdmin, signInWithMagicLink, signOut, isCheckingAdmin }` |
| `goed/src/stores/admin.js` | Pinia setup store for admin domain (session + future submissions list) | named: `useAdminStore` |
| `goed/src/router/guards.js` | Route guard that enforces session + allow-list before any `/admin` child route | named: `adminGuard(to, from, next)` |
| `goed/src/router/index.js` | Adds `/admin/login`, `/admin/dashboard`, wires `adminGuard` to the parent `/admin` route | (modify) |
| `goed/src/views/admin/AdminLogin.vue` | Public magic-link login page | default export (Vue component) |
| `goed/src/views/admin/AdminDashboard.vue` | Bare placeholder dashboard the magic link redirects to (so Phase 2 has a target) | default export (Vue component) |

### Key Links

| From | To | Via |
|------|----|-----|
| `router/index.js` `/admin` route | `adminGuard` | `beforeEnter: adminGuard` on parent route |
| `adminGuard` | `map_admin_users` | `supabase.from('map_admin_users').select('email').eq('email', session.user.email)` |
| `AdminLogin.vue` | `signInWithMagicLink` | `useAdminAuth()` composable |
| `AdminLogin.vue` | redirect to dashboard | Watches `isAdmin`; if true on mount, `router.push({ name: 'AdminDashboard' })` |
| `useAdminAuth` | `useAdminStore` | Composable updates `store.setSession(session)` on `onAuthStateChange` so the store mirrors auth state |
| Magic-link email | `/admin/dashboard` | `emailRedirectTo: window.location.origin + '/admin/dashboard'` in `signInWithOtp` options |

## Dependency Graph

```
Task 1 (migration: map_admin_users + RLS + audit columns)
   |
   +--> Task 2 (composable + Pinia store)
            |
            +--> Task 3 (router guard + routes + AdminLogin/AdminDashboard views)
```

- Task 1 is independent and must run first (RLS policies and the table must exist before anything queries them).
- Task 2 depends on Task 1 (composable + store are useless without the table to query).
- Task 3 depends on Task 2 (guard + login view consume the composable + store).

## Execution Sequences

| Sequence | Tasks | Parallel |
|----------|-------|----------|
| 1 | Task 1 | — |
| 2 | Task 2 | — |
| 3 | Task 3 | — |

All three tasks are sequential; each builds directly on the previous.

## Tasks

### Task 1: Create `0006_admin_users.sql` migration and apply it

**Type:** auto
**Sequence:** 1
**Status:** Complete
**Completed:** 2026-05-09

**Files:**
- `supabase/migrations/0006_admin_users.sql` (create)

**Action:**
Author an idempotent SQL migration that:

1. Creates `map_admin_users` with `id uuid primary key default gen_random_uuid()`, `email text unique not null`, `created_at timestamptz default now()`. Use `create table if not exists`.
2. Enables RLS on `map_admin_users` and adds a policy allowing `authenticated` users to `select` (so the client can verify its own email is in the allow-list). `insert`/`delete` are not granted to anyone — service role bypasses RLS naturally.
3. Adds `rejection_reason text`, `reviewed_at timestamptz`, `reviewed_by text` columns to `map_startup_submissions` using `add column if not exists` (these may already exist from `0002_submissions.sql`; the migration must be safe to re-run).
4. Replaces the existing broad admin RLS policies on `map_startup_submissions` (`map_startup_submissions_admin_select`, `map_startup_submissions_admin_update`) with allow-list-gated versions: `using (auth.jwt() ->> 'email' in (select email from map_admin_users))`. Keep the existing public `insert` policy untouched. Use `drop policy if exists` then `create policy` so re-runs are clean.
5. Seeds three admin emails: `cayden@sempurnadev.com`, `admin@goed.utah.gov`, `staff@goed.utah.gov` via `insert ... on conflict (email) do nothing`.

Header comment must follow the style of `0002_submissions.sql` (apply instructions, idempotency note, `map_` prefix reminder). After authoring, apply the migration to the remote Supabase project using the Supabase MCP `apply_migration` tool (or `supabase db push` if local CLI is the established workflow — check `.project/features/0004/phases/*/EXECUTED` notes for which pattern this repo uses).

**Verify:**
1. File exists: `supabase/migrations/0006_admin_users.sql`
2. Migration applies cleanly: `supabase db push` (or MCP `apply_migration`) returns success with no errors.
3. Schema verified via MCP `list_tables`: `map_admin_users` is present with columns `id`, `email`, `created_at`; `map_startup_submissions` has `rejection_reason`, `reviewed_at`, `reviewed_by`.
4. Seed rows verified via MCP `execute_sql`: `select email from map_admin_users order by email` returns the three seed emails.
5. RLS gate verified via MCP `execute_sql` running as the `authenticated` role with a non-admin JWT: a `select * from map_startup_submissions limit 1` returns 0 rows (RLS denies). With an admin JWT (email in `map_admin_users`), the same query returns rows. If running this check is impractical with the MCP, document the manual SQL editor steps in the EXECUTED log instead.

**Done when:** Migration file exists and is applied; `map_admin_users` is queryable, contains the three seed emails, and the RLS policy on `map_startup_submissions` references `map_admin_users` (verified by reading the policy definition with `execute_sql`).

---

### Task 2: Build `useAdminAuth` composable and `useAdminStore` Pinia store

**Type:** auto
**Sequence:** 2
**Status:** Complete
**Completed:** 2026-05-09

**Files:**
- `goed/src/composables/useAdminAuth.js` (create)
- `goed/src/stores/admin.js` (create)

**Action:**
Create the composable and store that expose admin auth state to the rest of the app.

**`goed/src/composables/useAdminAuth.js`:**
- Top-of-file orientation comment describing purpose and consumers (router guard + AdminLogin view).
- Named export `useAdminAuth()` returning `{ session, isAdmin, signInWithMagicLink, signOut, isCheckingAdmin }`.
- `session = ref(null)` initialized on first call by awaiting `supabase.auth.getSession()` and writing `data.session` into the ref.
- Subscribe to `supabase.auth.onAuthStateChange((_event, newSession) => { session.value = newSession })`. The composable should be safe to call from multiple components without double-subscribing — gate the subscription on a module-level flag.
- `isAdmin` is a `computed` that returns `false` when `session.value?.user?.email` is missing, otherwise it triggers an async lookup against `map_admin_users` with that email. Because `computed` cannot be async, store the verification result in a separate `ref` (`adminVerified = ref(false)`) and a `ref` (`isCheckingAdmin = ref(false)`); use `watchEffect` to re-run the lookup whenever `session.value?.user?.email` changes. `isAdmin` is then a synchronous computed reading `adminVerified.value`.
- `signInWithMagicLink(email)`: calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/admin/dashboard' } })`. Returns `{ data, error }` (Supabase client already returns this shape — pass through).
- `signOut()`: calls `await supabase.auth.signOut()`. Resets `session.value = null` and `adminVerified.value = false` defensively.
- JSDoc on every exported function with `@param`/`@returns`. JSDoc on the inner returned helper functions too.

**`goed/src/stores/admin.js`:**
- Setup-style Pinia store: `export const useAdminStore = defineStore('admin', () => { ... })`.
- Header comment naming the domain (admin queue session + submissions list) and consumers (AdminQueue view in later phases).
- State refs: `session = ref(null)`, `submissions = ref([])`, `isLoading = ref(false)`, `error = ref(null)`.
- `isAdmin` computed: mirrors the composable logic — but for the store version, treat it as a derived flag the composable pushes into the store via `setSession`. Simplest path: store exposes `adminVerified = ref(false)`, and `isAdmin` computed returns `adminVerified.value && session.value?.user?.email`.
- Actions:
  - `setSession(newSession)`: assigns `session.value = newSession`; if email present, runs the `map_admin_users` lookup and assigns `adminVerified.value`.
  - `fetchSubmissions()`: runs `supabase.from('map_startup_submissions').select('*').eq('status', 'pending').order('submitted_at', { ascending: false })`. Wrap in `try/catch/finally`, toggle `isLoading`, write `error.value` on failure. Returns `{ data, error }`.
- Return `{ session, submissions, isLoading, error, isAdmin, adminVerified, setSession, fetchSubmissions }`.

**Verify:**
1. Files exist: `goed/src/composables/useAdminAuth.js`, `goed/src/stores/admin.js`.
2. Type-check / dev server boot: `cd goed && npm run dev` starts without import errors. Hit `http://localhost:5173/` to confirm the existing app still loads (the new files are not yet referenced anywhere, so they should just sit silently).
3. Manual REPL test inside browser devtools console at the running dev server: `import('@/composables/useAdminAuth.js').then(m => m.useAdminAuth())` — confirm it returns an object with the five expected keys and no exception.
4. Lint by inspection: every exported function has JSDoc; no `console.log`; 2-space indent, single quotes, no semicolons, trailing commas; named export only.

**Done when:** Both files exist, dev server boots without errors, dynamic-importing `useAdminAuth` from the browser console returns the documented shape.

---

### Task 3: Wire route guard, add `/admin/login` + `/admin/dashboard` routes, build login view

**Type:** auto
**Sequence:** 3
**Status:** Complete
**Completed:** 2026-05-09

**Files:**
- `goed/src/router/guards.js` (create)
- `goed/src/router/index.js` (modify)
- `goed/src/views/admin/AdminLogin.vue` (create)
- `goed/src/views/admin/AdminDashboard.vue` (create)

**Action:**

**`goed/src/router/guards.js`:**
- Named export `adminGuard(to, from, next)`.
- `await supabase.auth.getSession()`; if no `session`, `return next({ name: 'AdminLogin' })`.
- Query `map_admin_users` for the session email. If the row is not found, `await supabase.auth.signOut()`, then `return next({ name: 'AdminLogin', query: { reason: 'not-allowed' } })`.
- Otherwise `next()`.
- JSDoc.

**`goed/src/router/index.js`:**
- Import `adminGuard` from `./guards`.
- Replace the existing `/admin` route. The new structure has three admin-related routes:
  - `/admin/login` → `name: 'AdminLogin'`, lazy-imports `@/views/admin/AdminLogin.vue`. **No guard.**
  - `/admin` → `name: 'Admin'`, lazy-imports `@/views/admin/AdminDashboard.vue`, with `beforeEnter: adminGuard`. Add a redirect from `/admin` to `/admin/dashboard` so the named route is unambiguous.
  - `/admin/dashboard` → `name: 'AdminDashboard'`, lazy-imports `@/views/admin/AdminDashboard.vue`, with `beforeEnter: adminGuard`.
- Remove the old `PlaceholderView` `/admin` route. Keep `/roadmap` and `/subscribe` placeholder routes as-is.

**`goed/src/views/admin/AdminLogin.vue`:**
- `<script setup>` first, then `<template>`, then `<style scoped>`.
- Imports: `useAdminAuth` composable, `useRouter`, `useRoute`, `ref`, `computed`, `onMounted`, `watch`.
- State: `email = ref('')`, `isSubmitting = ref(false)`, `submitError = ref(null)`, `linkSent = ref(false)`.
- Computed: `notAllowedNotice` returns `route.query.reason === 'not-allowed' ? 'That email is not on the admin allow-list.' : null`. `confirmationMessage` returns `linkSent.value ? \`Check your email — link sent to ${email.value}\` : null`.
- `onMounted`: if `isAdmin.value` is already true, immediately `router.replace({ name: 'AdminDashboard' })`. Also `watch(isAdmin, ...)` to handle the case where the auth state arrives slightly after mount.
- `handleSubmit()`: sets `isSubmitting = true`, calls `signInWithMagicLink(email.value)`, on `error` writes `submitError.value = error.message`, on success sets `linkSent.value = true`. Always resets `isSubmitting` in `finally`.
- Template: centered card (Tailwind: `min-h-screen flex items-center justify-center bg-gray-50`, card `bg-white p-8 rounded-lg shadow max-w-md w-full`). Heading "Admin Sign In". Email input + "Send magic link" button. Conditional notices: red `notAllowedNotice` banner, red `submitError` banner, green `confirmationMessage` banner. Use only Tailwind tokens — no raw hex.
- No logic in template: every conditional class / displayed string is a `computed`.
- Default export (implicit via SFC).

**`goed/src/views/admin/AdminDashboard.vue`:**
- Bare placeholder for this phase. `<script setup>` imports `useAdminStore` and `useAdminAuth`; renders an `<h1>Admin Dashboard</h1>`, the signed-in email, and a "Sign out" button that calls `signOut()` then `router.push({ name: 'AdminLogin' })`. Phase 2 will replace this with the real queue.

**Verify:**
1. Files exist at all four paths.
2. Dev server boots: `cd goed && npm run dev` reports no errors.
3. **Logged-out redirect:** In a private/incognito window, visit `http://localhost:5173/admin`. Must redirect to `/admin/login`. Must redirect from `/admin/dashboard` too.
4. **Login form renders:** `/admin/login` shows the centered card, email input, and "Send magic link" button.
5. **`?reason=not-allowed` notice:** Visit `/admin/login?reason=not-allowed` directly — the red "not on the admin allow-list" notice renders.
6. **Magic-link send (allow-listed email):** Submit `cayden@sempurnadev.com`. The button disables, then "Check your email — link sent to cayden@sempurnadev.com" appears. Confirm an email arrives in that inbox (Supabase auth dashboard logs are sufficient evidence if email delivery is throttled).
7. **Magic-link send (NOT-allow-listed email):** Submitting an arbitrary non-listed email still triggers Supabase to send a magic link (Supabase doesn't gate `signInWithOtp` by allow-list). When that user clicks the link, they land on `/admin/dashboard` → guard runs → `map_admin_users` lookup fails → `signOut()` → redirect to `/admin/login?reason=not-allowed` with the red notice visible. Reproduce this end-to-end with a non-listed test email.
8. **Successful magic-link flow (allow-listed):** Click the magic link in the email for `cayden@sempurnadev.com`. Lands on `/admin/dashboard`. The placeholder dashboard renders the email and Sign Out button. In devtools console: `await (await import('@/stores/admin.js')).useAdminStore().isAdmin` evaluates to `true` (or read it from Vue devtools).
9. **Sign out:** Clicking Sign Out from the dashboard returns to `/admin/login` and a subsequent visit to `/admin` redirects to `/admin/login` again (session cleared).

**Done when:** All nine verification steps pass and are recorded in `.project/features/0005/phases/phase-1/EXECUTED` with command output / screenshots where applicable.

---

## Verification Checklist

- [x] Migration `0006_admin_users.sql` exists and applies cleanly.
- [x] `map_admin_users` has the three seed rows (`cayden@sempurnadev.com`, `admin@goed.utah.gov`, `staff@goed.utah.gov`).
- [x] `map_startup_submissions` has `rejection_reason`, `reviewed_at`, `reviewed_by` columns (idempotent — may already be present from `0002`).
- [x] RLS policy on `map_startup_submissions` is gated by `auth.jwt() ->> 'email' in (select email from map_admin_users)`.
- [x] `useAdminAuth` composable exists with the documented five-key return shape and JSDoc on every export.
- [x] `useAdminStore` Pinia store exists, follows setup-style pattern, exposes `isLoading` + `error` refs and `setSession` + `fetchSubmissions` actions.
- [x] `adminGuard` exists and is wired into `/admin` and `/admin/dashboard` via `beforeEnter`.
- [ ] `/admin` while logged out redirects to `/admin/login`.
- [ ] `/admin` while logged in with a non-allow-listed email signs the user out and redirects to `/admin/login?reason=not-allowed` with a visible red notice.
- [ ] `/admin/login` submits an allow-listed email and shows "Check your email — link sent to <email>".
- [ ] Clicking the magic link from an allow-listed email arrives at `/admin/dashboard` with `useAdminStore().isAdmin === true`.

## Success Criteria

`/admin` is provably gated: only authenticated, allow-listed users reach `/admin/dashboard`. Database RLS and route-guard layer agree — pulling either layer alone (e.g., bypassing the router by hitting Supabase directly with a non-admin JWT) still cannot read or update `map_startup_submissions`. The composable + store are ready for Phase 2 (queue UI) to consume without further auth work.
