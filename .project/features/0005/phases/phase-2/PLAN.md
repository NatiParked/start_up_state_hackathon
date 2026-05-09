# Feature Plan: Admin Management UI — Phase 2: Admin Shell & Dashboard

## Objective

Build the persistent admin shell that wraps every admin route and replace the Phase 1 placeholder dashboard with six live metric cards. After this phase, an authenticated admin lands on `/admin` and sees a sidebar layout (GSAP slide-in) with working navigation and a dashboard reflecting actual database state. Phases 3 and 4 drop their views into the `<RouterView />` slot that this phase installs.

**Purpose:** Give allow-listed staff a working operational home base they can navigate, and surface live database health (pending submissions, company counts, hiring count, last cron run) at a glance.

**Output:** `AdminLayout.vue` (sidebar shell), a fully-implemented `AdminDashboard.vue` (six metric cards), a restructured `router/index.js` using nested routes under `AdminLayout`, and a documenting header comment on `supabase.js` clarifying the anon-vs-service-role boundary.

## Must-Haves (Goal-Backward)

### Observable Truths

- Visiting `/admin` while authenticated and allow-listed renders `AdminLayout` with a GSAP sidebar slide-in and `AdminDashboard` in the main pane.
- All five sidebar links render and route correctly to their named routes (placeholders acceptable for Submissions/Companies/Refresh/Subscribers in this phase).
- The four live metric cards (pending submissions, total companies, hiring count, last cron run) reflect actual database state on load.
- The two M9 metric cards (subscriber count, last digest) show `0` and `—` with a visible "Populates in M9" footnote.
- Clicking "Sign out" in the sidebar calls `signOut()` and redirects to `/admin/login`.
- Visiting any `/admin/*` route (other than `/admin/login`) while logged out is bounced to `/admin/login` by the parent-route `adminGuard`.
- The sticky top bar shows the signed-in admin email and the session's last login time.

### Required Artifacts

| Path                                         | Action    | Key Details                                                                                                                                                |
| -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goed/src/views/admin/AdminLayout.vue`       | Create    | Sidebar + `<RouterView />` shell; GSAP `gsap.from(sidebar, { x: -40, opacity: 0, duration: 0.2, ease: 'power2.out' })` on mount; sticky top bar with admin email + last login; five nav links + sign-out |
| `goed/src/views/admin/AdminDashboard.vue`    | Overwrite | Six metric cards in responsive grid; 4 live (Supabase queries), 2 hardcoded M9 placeholders; per-card skeleton loading states                              |
| `goed/src/router/index.js`                   | Modify    | Restructure `/admin/*` to nested layout route; `AdminLayout` as parent with `adminGuard`; five named children + `''` redirect to `dashboard`              |
| `goed/src/lib/supabase.js`                   | Modify    | Add header comment documenting anon-only browser client + `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` Edge-Function boundary. No runtime change.           |

### Key Links

| From                                | To                                          | Via                                                                                                  |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `router/index.js` `/admin` parent   | `adminGuard`                                | `beforeEnter: adminGuard` on the parent `/admin` route only                                          |
| `AdminLayout.vue` sidebar "Sign out"| `signOut()` -> `AdminLogin`                 | `useAdminAuth()` composable; `router.push({ name: 'AdminLogin' })`                                   |
| `AdminLayout.vue` sticky top bar    | admin email + last login                    | `useAdminStore().session?.user?.email` and `session?.user?.last_sign_in_at`                          |
| `AdminLayout.vue` sidebar element   | GSAP slide-in                               | template ref -> `gsap.from(ref.value, { x: -40, opacity: 0, duration: 0.2, ease: 'power2.out' })`    |
| `AdminLayout.vue` sidebar links     | nested admin routes                         | `<RouterLink :to="{ name: 'AdminDashboard' }">` etc. for all five named routes                       |
| `AdminDashboard.vue` 4 live metrics | Supabase tables                             | `supabase.from('map_startup_submissions' / 'map_startups' / 'map_refresh_log').select(...)` on mount |
| Phase 3+ child views                | `AdminLayout.vue`                           | Router `children` — each child renders inside `<RouterView />` in the layout                         |

## Dependency Graph

```
Task 1 (AdminLayout.vue — create sidebar shell)
Task 2 (AdminDashboard.vue — overwrite with real metrics)
   |           |
   +-----------+
         |
    Task 3 (router/index.js + supabase.js header comment)
```

- Tasks 1 and 2 are independent (different files, no shared imports) and can run in parallel.
- Task 3 depends on both — the router must import components that already exist.

## Execution Sequences

| Sequence | Tasks         | Parallel | Notes                                                              |
| -------- | ------------- | -------- | ------------------------------------------------------------------ |
| 1        | Task 1, Task 2 | Yes      | Both create new/replacement SFCs in different files                |
| 2        | Task 3        | —        | Imports both Task 1 + Task 2 components; modifies router + supabase|

## Tasks

### Task 1: Create `AdminLayout.vue` — sidebar shell with GSAP slide-in

**Type:** auto
**Sequence:** 1
**Status:** Pending

**Files:**
- `goed/src/views/admin/AdminLayout.vue` (create)

**Action:**

Create `goed/src/views/admin/AdminLayout.vue` as the persistent admin shell.

SFC block order: `<script setup>` -> `<template>` -> `<style scoped>` (empty `<style scoped></style>` is fine).

**`<script setup>`:**
- Imports: `ref`, `onMounted`, `computed` from `vue`; `useRouter`, `useRoute` from `vue-router` (RouterLink/RouterView are globally registered); `gsap` from `gsap`; `useAdminAuth` from `@/composables/useAdminAuth`; `useAdminStore` from `@/stores/admin`.
- `const { signOut } = useAdminAuth()`.
- `const adminStore = useAdminStore()`.
- `const router = useRouter()`, `const route = useRoute()`.
- `const sidebarEl = ref(null)` — template ref for GSAP target.
- `async function handleSignOut()`: calls `await signOut()`, then `router.push({ name: 'AdminLogin' })`.
- `onMounted`: `gsap.from(sidebarEl.value, { x: -40, opacity: 0, duration: 0.2, ease: 'power2.out' })`.
- `const adminEmail = computed(() => adminStore.session?.user?.email ?? '')`.
- `const lastLogin = computed(() => { const t = adminStore.session?.user?.last_sign_in_at; return t ? new Date(t).toLocaleString() : '—' })`.
- `const navLinks = [{ label: 'Dashboard', name: 'AdminDashboard' }, { label: 'Submissions', name: 'AdminSubmissions' }, { label: 'Companies', name: 'AdminCompanies' }, { label: 'Refresh', name: 'AdminRefresh' }, { label: 'Subscribers', name: 'AdminSubscribers' }]`.
- Helper `function isActive(name) { return route.name === name }`.

**`<template>`:** Two-column flex layout. Left `<aside ref="sidebarEl">` ~`w-56` with `bg-utah-blue text-white flex flex-col`. Sidebar contents top-to-bottom: brand heading ("GOED Admin"), then `<nav class="flex-1">` with five `<RouterLink>` items iterated from `navLinks` (use active class such as `bg-utah-blue-dark` when `isActive(link.name)` is true), then a "Sign out" `<button>` anchored at the bottom (use `mt-auto` on its container) wired to `handleSignOut`. Right column is `<div class="flex-1 flex flex-col">` with a sticky top bar (`<header class="sticky top-0 ...">`) showing `adminEmail` on the left and `Last login: {{ lastLogin }}` on the right, then `<main class="flex-1 p-6"><RouterView /></main>` below it.

Tailwind brand tokens only — no raw hex strings (`#xxxxxx`) anywhere in the template. Use `bg-utah-blue`, `bg-utah-blue-dark`, `text-white`, plus standard Tailwind utilities (`bg-white`, `border-b`, `text-gray-500`, etc.) for the right column / top bar styling.

JS only. Single quotes, no semicolons, 2-space indent, trailing commas. No `console.log`. Default export is implicit via SFC.

**Verify:**
1. File exists at `goed/src/views/admin/AdminLayout.vue` with `<script setup>`, `<template>`, `<style scoped>` blocks in that order.
2. Grep confirms five `<RouterLink>` entries with names `AdminDashboard`, `AdminSubmissions`, `AdminCompanies`, `AdminRefresh`, `AdminSubscribers`.
3. Grep confirms `gsap.from(` is called with `duration: 0.2` and `ease: 'power2.out'` inside `onMounted`.
4. Grep confirms `useAdminAuth` and `useAdminStore` are both imported; `handleSignOut` calls `signOut()` and `router.push({ name: 'AdminLogin' })`.
5. Grep `#[0-9a-fA-F]\{3,6\}` inside the `<template>` block returns no matches (no raw hex colors).
6. `cd goed && npm run build` compiles without errors.

**Done when:** File exists and the build passes; sidebar will render with the slide-in once Task 3 wires the router.

---

### Task 2: Overwrite `AdminDashboard.vue` with six metric cards

**Type:** auto
**Sequence:** 1
**Status:** Pending

**Files:**
- `goed/src/views/admin/AdminDashboard.vue` (overwrite — discard the Phase 1 placeholder body entirely)

**Action:**

Replace the existing Phase 1 placeholder content end-to-end with a real metrics dashboard.

SFC block order: `<script setup>` -> `<template>` -> `<style scoped>`.

**`<script setup>`:**
- Imports: `ref`, `onMounted`, `computed` from `vue`; `supabase` from `@/lib/supabase`.
- Six data refs (null while loading so the skeleton renders): `pendingCount = ref(null)`, `totalCompanies = ref(null)`, `hiringCount = ref(null)`, `lastCronRun = ref(null)`, `isLoading = ref(true)`, `loadError = ref(null)`.
- `onMounted` calls `loadMetrics()`.
- `async function loadMetrics()` runs four Supabase queries in parallel via `Promise.all`:
  - `supabase.from('map_startup_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending')` -> use `count`.
  - `supabase.from('map_startups').select('*', { count: 'exact', head: true })` -> `count`.
  - `supabase.from('map_startups').select('*', { count: 'exact', head: true }).eq('is_hiring', true)` -> `count`.
  - `supabase.from('map_refresh_log').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()` -> format `data?.created_at` via `new Date(...).toLocaleString()`, fallback `'Never'`.
  - Wrap the whole thing in try/catch. On any of the three count-query errors, set `loadError.value = err.message`. The cron query is non-fatal (table can be empty). Always set `isLoading.value = false` in `finally`.
- `const metrics` computed array yields six objects in order: Pending Submissions, Total Companies, Hiring Companies, Last Cron Run (these four use `loading: isLoading.value`, `m9: false`), Subscribers (`value: '0'`, `loading: false`, `m9: true`), Last Digest Sent (`value: '—'`, `loading: false`, `m9: true`).

**`<template>`:** A heading "Dashboard", an optional `loadError` banner styled with `border-error-red text-error-red bg-red-50`, then a responsive grid `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">`. For each metric render a card `<div class="bg-white rounded-lg border border-gray-200 p-5">` containing a small uppercase label, then either a skeleton `<div class="h-7 w-24 bg-gray-200 rounded animate-pulse" />` (when `metric.loading`) or the value as a large bold number/text. When `metric.m9` is true, append a `<p class="mt-1 text-xs text-gray-400">Populates in M9</p>` footnote.

Use Tailwind brand tokens (`bg-utah-blue`, `text-utah-blue-dark`, `border-error-red`, `text-error-red`) and standard Tailwind utilities only. No raw hex colors. No `console.log`. JS only. Single quotes, no semicolons, 2-space indent.

**Verify:**
1. `goed/src/views/admin/AdminDashboard.vue` exists; the previous placeholder body (sign-in email + sign out button) is completely gone.
2. Grep confirms six metric labels: `Pending Submissions`, `Total Companies`, `Hiring Companies`, `Last Cron Run`, `Subscribers`, `Last Digest Sent`.
3. Grep confirms the literal string `Populates in M9` appears at least twice.
4. Grep confirms imports of `supabase` from `@/lib/supabase` and at least four `.from(` calls inside the script block.
5. Grep confirms `animate-pulse` appears in the template (skeleton loader).
6. `cd goed && npm run build` succeeds.
7. Domain check (after Task 3 wires the router): with the dev server running and an admin signed in, `/admin/dashboard` shows six cards; the four live values match `select count(*)` results from Supabase Studio for each table; the two M9 cards show `0` / `—` with the footnote.

**Done when:** File overwrites the placeholder; the build passes; the six-card grid renders with skeletons during load and real values after the queries resolve.

---

### Task 3: Restructure `router/index.js` and document `supabase.js` boundary

**Type:** auto
**Sequence:** 2
**Status:** Pending

**Files:**
- `goed/src/router/index.js` (modify)
- `goed/src/lib/supabase.js` (modify — header comment only)

**Action:**

**A. Restructure the admin section of `goed/src/router/index.js`.** Keep the non-admin routes (`Map`, `Navigator`, `Submit`, `Roadmap`, `Subscribe`) completely untouched. Replace the existing flat admin entries (the three current records: `/admin/login`, `/admin` redirect, `/admin/dashboard` with `beforeEnter: adminGuard`) with this nested structure:

- Top-level: `{ path: '/admin/login', name: 'AdminLogin', component: () => import('@/views/admin/AdminLogin.vue') }` — no guard.
- Top-level: `{ path: '/admin', name: 'Admin', component: () => import('@/views/admin/AdminLayout.vue'), beforeEnter: adminGuard, children: [...] }`.
  - Children, in order:
    - `{ path: '', redirect: { name: 'AdminDashboard' } }`
    - `{ path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/admin/AdminDashboard.vue') }`
    - `{ path: 'submissions', name: 'AdminSubmissions', component: () => import('@/views/PlaceholderView.vue'), props: { title: 'Submissions' } }`
    - `{ path: 'companies', name: 'AdminCompanies', component: () => import('@/views/PlaceholderView.vue'), props: { title: 'Companies' } }`
    - `{ path: 'refresh', name: 'AdminRefresh', component: () => import('@/views/PlaceholderView.vue'), props: { title: 'Refresh' } }`
    - `{ path: 'subscribers', name: 'AdminSubscribers', component: () => import('@/views/PlaceholderView.vue'), props: { title: 'Subscribers' } }`

The `adminGuard` import at the top of the file stays. The guard moves to the parent `/admin` route only — do NOT add `beforeEnter: adminGuard` to any individual child (the parent guard covers them all).

**B. Add a header comment block to `goed/src/lib/supabase.js`** above the existing `import` line. The comment must explicitly state:
- This file exports the BROWSER (anon-key) Supabase client used by the Vue app.
- Service-role key usage is restricted to Edge Functions via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.
- The service-role key MUST NEVER be imported into the Vue app or any `goed/src/**` file.

Do not change the runtime behavior of `supabase.js` — only prepend the comment. Keep the existing JSDoc on the `supabase` export intact.

JS only. Single quotes, no semicolons, 2-space indent, trailing commas where applicable. No `console.log`.

**Verify:**
1. `goed/src/router/index.js` contains exactly one route record with `path: '/admin'` that has both `beforeEnter: adminGuard` and a `children:` array with six entries (one redirect + five named routes).
2. The five child route names are present and PascalCase: `AdminDashboard`, `AdminSubmissions`, `AdminCompanies`, `AdminRefresh`, `AdminSubscribers`.
3. The old flat `/admin/dashboard` standalone route record is gone (grep `path: '/admin/dashboard'` returns no matches).
4. `/admin/login` still exists as a TOP-LEVEL route with no guard; the import for `adminGuard` remains.
5. `goed/src/lib/supabase.js` contains a header comment mentioning both `SUPABASE_SERVICE_ROLE_KEY` and "Edge Function" (or equivalent boundary language); the runtime export `supabase` is unchanged.
6. `cd goed && npm run build` succeeds with no router/import errors.
7. Domain check (manual, with `npm run dev` running):
   - `/admin` while signed-in-as-admin -> redirects to `/admin/dashboard` and renders `AdminLayout` with sidebar slide-in + dashboard in the main pane.
   - Each of the five sidebar links navigates to the matching `/admin/<slug>` and renders either the dashboard (Dashboard) or `PlaceholderView` "Coming soon." (the other four).
   - "Sign out" calls `signOut()` and lands on `/admin/login`.
   - Visiting any `/admin/*` route while signed out is redirected to `/admin/login` (parent `adminGuard` still protects all children).
   - Public routes (`/`, `/navigator`, `/submit`, `/roadmap`, `/subscribe`) all still load.

**Done when:** All seven verify steps pass; no console errors in the dev server; the router uses the nested `/admin` tree with `adminGuard` on the parent; `supabase.js` documents the anon-vs-service-role boundary; the runtime `supabase` export is unchanged.

---

## Verification Checklist

- [ ] `goed/src/views/admin/AdminLayout.vue` exists with sidebar, sticky top bar, `<RouterView />`, and GSAP slide-in (`x: -40`, `duration: 0.2`, `ease: 'power2.out'`).
- [ ] `goed/src/views/admin/AdminDashboard.vue` has six metric cards (4 live, 2 M9 placeholders with "Populates in M9" footnote) and per-card skeleton loading state.
- [ ] `goed/src/router/index.js` has `/admin` as a parent route with `AdminLayout`, `beforeEnter: adminGuard`, a `''` child redirecting to `dashboard`, and five named children (`AdminDashboard`, `AdminSubmissions`, `AdminCompanies`, `AdminRefresh`, `AdminSubscribers`).
- [ ] `goed/src/lib/supabase.js` carries a header comment documenting the anon-only browser client / Edge-Function `SUPABASE_SERVICE_ROLE_KEY` boundary.
- [ ] Visiting `/admin` while logged out redirects to `/admin/login` (parent guard fires).
- [ ] Visiting `/admin` while authenticated and allow-listed renders `AdminLayout` with GSAP sidebar slide-in and `AdminDashboard` in the main pane.
- [ ] All five sidebar links render and route to their named routes without errors.
- [ ] The four live dashboard metrics (pending submissions, total companies, hiring count, last cron run) reflect actual database state on load.
- [ ] The two M9 metric cards show `0` and `—` with a visible "Populates in M9" footnote.
- [ ] Clicking "Sign out" from the sidebar calls `signOut()` and redirects to `/admin/login`.
- [ ] Sticky top bar shows admin email and last login time pulled from `useAdminStore().session`.
- [ ] No raw hex color values appear in `AdminLayout.vue` or `AdminDashboard.vue` templates — Tailwind brand tokens only.
- [ ] `cd goed && npm run build` succeeds with no errors.

## Success Criteria

An authenticated admin navigates to `/admin` and lands on a polished two-column shell: sidebar slides in from the left (GSAP), sticky top bar shows their email and last login, five nav links are visible, and the dashboard pane shows six metric cards reflecting live database counts plus two M9 stubs with footnotes. The route guard from Phase 1 is preserved unchanged on the parent `/admin` route — logged-out users are still blocked from every child. The `supabase.js` client file documents the anon-vs-service-role boundary. All Phase 3+ views will drop into `<RouterView />` without any further routing work.
