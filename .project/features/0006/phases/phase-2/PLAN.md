# Feature Plan: Phase 2 — Claim Flow Frontend

Feature: 0006 — AI Onboarding — Claim & Self-Service Edit
Phase: 2 of N

## Objective

Wire `/company/:id/claim` (login page) and `/company/:id/edit` (gated edit page) using the same auth pattern as the admin section, with claim CTAs surfaced from CompanyDrawer and SubmitResult so founders can reach the claim flow from both the map and post-submit screens.

**Purpose:** Give founders a route into the claim flow today (Phase 1 already shipped the DB + edge function), even though the actual edit UI is a stub. This unblocks dogfooding of the magic-link flow and sets the routing/composable contract that Phase 3 (edit form) will fill in.

**Output:**
- New composable `goed/src/composables/useClaimAuth.js`
- New route guard `claimGuard` in `goed/src/router/guards.js`
- Two new routes (`ClaimLogin`, `CompanyEdit`) in `goed/src/router/index.js`
- New views `ClaimLoginView.vue` and `CompanyEditView.vue` (the latter as a minimal stub gated by `claimGuard`)
- Claim CTAs added to `SubmitResult.vue` and `CompanyDrawer.vue`

## Must-Haves (Goal-Backward)

### Observable Truths

- A logged-out founder visiting `/company/:id/edit` is redirected to `/company/:id/claim`.
- The claim login page shows the company name (fetched by `:id`) and an email input form.
- Submitting an email whose domain does not match the company's website returns a visible error sourced from the `claim-company` edge function 400 response.
- Submitting a matching email inserts a `company_claims` row and triggers a Supabase OTP magic link (verifiable in Supabase Auth logs / `company_claims` table).
- Once authenticated AND a `company_claims` row exists for `(startup_id, email)`, the user lands on `/company/:id/edit` and is not bounced back.
- A non-allow-listed authenticated user hitting `/company/:id/edit` is signed out and redirected to `/company/:id/claim?reason=not-allowed`.
- From the map drawer (`CompanyDrawer.vue`) and from `SubmitResult.vue` (`pending` and `auto_published` states), there is a "Claim your listing" link that routes to `ClaimLogin` with the correct startup id.

### Required Artifacts

| Path | Provides | Key Exports |
|---|---|---|
| `goed/src/composables/useClaimAuth.js` | Founder auth composable mirroring `useAdminAuth.js`, scoped per startup id | `useClaimAuth(startupId)` returning `{ session, isOwner, isCheckingClaim, requestClaim, signOut }` |
| `goed/src/router/guards.js` | New `claimGuard` alongside existing `adminGuard` | `claimGuard(to, _from, next)` |
| `goed/src/router/index.js` | Routes for claim login and gated edit | New `ClaimLogin` and `CompanyEdit` route entries |
| `goed/src/views/ClaimLoginView.vue` | Email entry + magic-link sent confirmation, scoped to a startup | Default Vue component |
| `goed/src/views/CompanyEditView.vue` | Stub edit page (real UI lands in Phase 3); proves guard works | Default Vue component |
| `goed/src/components/submit/SubmitResult.vue` | Existing component — claim CTA fix | Now links to `ClaimLogin` with the result's startup id |
| `goed/src/components/drawer/CompanyDrawer.vue` | Existing component — adds a footer CTA | "Claim your listing" `RouterLink` for the selected company |

### Required Wiring

- `useClaimAuth.js` must use a **module-level** `session` ref + a **single** `onAuthStateChange` subscription guarded by a `subscribed` flag — exactly the same singleton pattern used in `useAdminAuth.js`.
- `useClaimAuth(startupId)` returns `session` (module-level), and a `watchEffect` that queries `company_claims` filtered by `startup_id = startupId` AND `email = session.user.email` using `.maybeSingle()`, writing the result into a `claimVerified` ref. `isOwner` is a `computed(() => claimVerified.value)`.
- `requestClaim(startupId, email)` first calls `supabase.functions.invoke('claim-company', { body: { startup_id, email } })`. If that returns `{ error }`, surface it. Otherwise call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/company/' + startupId + '/edit' } })`.
- `claimGuard` must read `to.params.id`, query `company_claims` by `(startup_id, email)` with `.maybeSingle()`, and on miss `await supabase.auth.signOut()` before calling `next({ name: 'ClaimLogin', params: { id: to.params.id }, query: { reason: 'not-allowed' } })`. On no-session: `next({ name: 'ClaimLogin', params: { id: to.params.id } })`.
- The new routes are registered in the same top-level `routes` array in `router/index.js`. Only `CompanyEdit` has `beforeEnter: claimGuard`.
- `ClaimLoginView.vue` fetches `map_startups` by `id = route.params.id` on mount to display the company name; uses `useClaimAuth(id)`; watches `isOwner` and on `true` calls `router.replace({ name: 'CompanyEdit', params: { id } })`. Surfaces `?reason=not-allowed` as a banner the same way `AdminLogin.vue` does.
- `CompanyEditView.vue` is a minimal stub (heading + sign-out button using `useClaimAuth(id).signOut`) — its job in this phase is to prove the guard chain works; the actual edit form ships in Phase 3.
- `SubmitResult.vue` replaces the broken `<router-link to="/admin">` claim CTA in the `pending` section AND adds the same CTA to the `auto_published` section. Both target `{ name: 'ClaimLogin', params: { id: result.startup_id } }`.
- `CompanyDrawer.vue` adds a ghost-styled `<router-link :to="{ name: 'ClaimLogin', params: { id: company.id } }">` in the drawer footer area (after the existing region/county tag). Use existing `btn btn-ghost` class — no new styles.

### Key Links

| From | To | Via |
|---|---|---|
| `CompanyDrawer.vue` footer CTA | `ClaimLoginView` | `<router-link :to="{ name: 'ClaimLogin', params: { id: company.id } }">` |
| `SubmitResult.vue` (pending + auto_published) | `ClaimLoginView` | `<router-link :to="{ name: 'ClaimLogin', params: { id: result.startup_id } }">` |
| `ClaimLoginView` form submit | `claim-company` edge fn | `useClaimAuth.requestClaim()` → `supabase.functions.invoke('claim-company', ...)` |
| `ClaimLoginView` form submit | Supabase OTP email | `useClaimAuth.requestClaim()` → `supabase.auth.signInWithOtp(...)` with `emailRedirectTo: /company/:id/edit` |
| `/company/:id/edit` route | `claimGuard` | `beforeEnter: claimGuard` in `router/index.js` |
| `claimGuard` | `company_claims` table | `.from('company_claims').select('email').eq('startup_id', id).eq('email', session.user.email).maybeSingle()` |
| `useClaimAuth` `watchEffect` | `company_claims` table | Same query as guard (drives `isOwner` reactively after OTP redirect) |

## Dependency Graph

```
Task 1 (useClaimAuth.js)         — needs nothing
Task 2 (claimGuard in guards.js) — needs nothing (independent of Task 1)
Task 3 (router routes + views)   — needs Tasks 1 & 2 (imports both)
Task 4 (CTA wiring)              — needs Task 3 (uses ClaimLogin route name)
```

## Execution Sequences

| Sequence | Tasks | Parallel? | Notes |
|---|---|---|---|
| 1 | Task 1, Task 2 | Yes | Composable and guard are independent — different files, no shared symbols |
| 2 | Task 3 | No | Registers routes + creates the two view files; depends on both Sequence 1 outputs |
| 3 | Task 4 | No | Adds CTAs that resolve `{ name: 'ClaimLogin' }` — requires the route to exist |

## Tasks

### Task 1: Create `useClaimAuth` composable

**Status:** Complete
**Completed:** 2026-05-09
**Type:** auto
**Sequence:** 1

<files>
goed/src/composables/useClaimAuth.js
</files>

<action>
Create a new composable that mirrors `goed/src/composables/useAdminAuth.js` exactly in structure, but scoped to a single startup id.

Module-level singletons (declared once, outside the exported function):
- `let subscribed = false`
- `const session = ref(null)`
- `const claimVerified = ref(false)`
- `const isCheckingClaim = ref(false)`
- An IIFE that calls `supabase.auth.getSession()` and seeds `session.value`.
- An `if (!subscribed)` block that flips the flag and registers a single `supabase.auth.onAuthStateChange((_event, newSession) => { session.value = newSession; if (!newSession) claimVerified.value = false })`.

Exported function `useClaimAuth(startupId)`:
- A `watchEffect` that reads `session.value?.user?.email` and `startupId`. If either is missing, set `claimVerified.value = false` and return. Otherwise set `isCheckingClaim.value = true`, query `supabase.from('company_claims').select('email').eq('startup_id', startupId).eq('email', email).maybeSingle()`, write `claimVerified.value = !!data`, and reset `isCheckingClaim.value` in `finally`.
- `const isOwner = computed(() => claimVerified.value)`
- `async function requestClaim(id, email)`: invoke `supabase.functions.invoke('claim-company', { body: { startup_id: id, email } })`. If that result has an `error`, return `{ data: null, error }`. Otherwise call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/company/' + id + '/edit' } })` and return its `{ data, error }`.
- `async function signOut()`: `await supabase.auth.signOut()`, then `session.value = null` and `claimVerified.value = false`.
- Return `{ session, isOwner, isCheckingClaim, requestClaim, signOut }`.

Add the standard file header comment ("Reactive auth composable for the founder claim flow. Consumers: router/guards.js (claimGuard), ClaimLoginView.vue, CompanyEditView.vue. Subscribes to onAuthStateChange once at module level.") and JSDoc on each exported function. No semicolons (frontend convention).
</action>

<verify>
1. File exists: `goed/src/composables/useClaimAuth.js` and exports a named `useClaimAuth` function.
2. Code review: only ONE `supabase.auth.onAuthStateChange(...)` call exists, guarded by the `subscribed` flag (mirrors `useAdminAuth.js`).
3. Code review: `requestClaim` calls `supabase.functions.invoke('claim-company', ...)` BEFORE `supabase.auth.signInWithOtp(...)` and short-circuits on edge-fn error.
4. Lint/typecheck via `npm --prefix goed run build` succeeds (the file is statically importable).
</verify>

<done>
`useClaimAuth(startupId)` is importable from `@/composables/useClaimAuth`, follows the singleton subscription pattern of `useAdminAuth`, and exposes `{ session, isOwner, isCheckingClaim, requestClaim, signOut }`.
</done>

---

### Task 2: Add `claimGuard` to `router/guards.js`

**Status:** Complete
**Completed:** 2026-05-09
**Type:** auto
**Sequence:** 1

<files>
goed/src/router/guards.js
</files>

<action>
Append a new exported function `claimGuard(to, _from, next)` to the existing `goed/src/router/guards.js` (do not modify or remove `adminGuard`). Update the file header comment to also list the claim subtree as a consumer.

Behavior:
1. `const { data: { session } } = await supabase.auth.getSession()`.
2. If `!session`, return `next({ name: 'ClaimLogin', params: { id: to.params.id } })`.
3. Otherwise query `supabase.from('company_claims').select('email').eq('startup_id', to.params.id).eq('email', session.user.email).maybeSingle()`.
4. If no row returned (`!data`), `await supabase.auth.signOut()` and return `next({ name: 'ClaimLogin', params: { id: to.params.id }, query: { reason: 'not-allowed' } })`.
5. Else `return next()`.

Add JSDoc matching the style of `adminGuard`. No semicolons. Reuse the existing `import { supabase } from '@/lib/supabase'` line.
</action>

<verify>
1. File `goed/src/router/guards.js` now exports both `adminGuard` and `claimGuard`.
2. Code review: `claimGuard` uses `to.params.id` (NOT a hardcoded id) when filtering `company_claims` and when constructing the redirect target.
3. `npm --prefix goed run build` still succeeds.
</verify>

<done>
`claimGuard` is exported from `@/router/guards`, mirrors the structure of `adminGuard`, and is scoped to one startup id from the route params.
</done>

---

### Task 3: Register routes and create `ClaimLoginView` + `CompanyEditView` stub

**Status:** Complete
**Completed:** 2026-05-09
**Type:** auto
**Sequence:** 2

<files>
goed/src/router/index.js
goed/src/views/ClaimLoginView.vue
goed/src/views/CompanyEditView.vue
</files>

<action>
**3a. `goed/src/router/index.js`:** Update the import line to `import { adminGuard, claimGuard } from './guards'`. Add two route entries inside the existing `routes` array (place them after the `/submit` block and before `/admin/login`):

```
{ path: '/company/:id/claim', name: 'ClaimLogin', component: () => import('@/views/ClaimLoginView.vue') },
{ path: '/company/:id/edit', name: 'CompanyEdit', component: () => import('@/views/CompanyEditView.vue'), beforeEnter: claimGuard },
```

**3b. `goed/src/views/ClaimLoginView.vue`:** Create a new Vue SFC that mirrors the structure of `goed/src/views/admin/AdminLogin.vue`. Use `<script setup>`, no semicolons, Tailwind utilities, existing brand classes (`btn`, `btn-primary`, etc.) where they parallel the admin login.

Logic:
- Read `id` from `useRoute().params.id`.
- On mount, fetch the company name: `supabase.from('map_startups').select('name').eq('id', id).maybeSingle()`. Store into a `companyName` ref. Tolerate the not-found case (show "this company" fallback).
- `const { isOwner, requestClaim } = useClaimAuth(id)`.
- Local refs: `email`, `isSubmitting`, `submitError`, `linkSent`.
- `notAllowedNotice` computed: `route.query.reason === 'not-allowed'` → "That email isn't authorized to manage this listing."
- `confirmationMessage` computed: when `linkSent.value` is true → `Check your inbox — we sent a magic link to ${email.value}`.
- `handleSubmit`: set `isSubmitting`, call `requestClaim(id, email.value)`, on `error` set `submitError.value = error.message`, else `linkSent.value = true`. Always reset `isSubmitting` in `finally`.
- `watch(isOwner, ...)` and `onMounted` redirect: if `isOwner.value` is true, `router.replace({ name: 'CompanyEdit', params: { id } })`.

Template:
- Heading: `Claim {{ companyName ?? 'this listing' }}`.
- Banners for `notAllowedNotice`, `submitError`, `confirmationMessage` (same color/border conventions as `AdminLogin.vue`).
- `v-if="!linkSent"` form with email input + submit button labeled "Send magic link" / "Sending…".
- `v-else` short copy directing the user to check their email.

**3c. `goed/src/views/CompanyEditView.vue`:** Create a minimal stub view (the real edit form is Phase 3). It should:
- Read `id` from the route.
- Call `useClaimAuth(id)` to get `signOut`.
- Render a heading like `Edit your listing` and a paragraph noting that the editor is coming in the next phase.
- Render a "Sign out" button that calls `signOut()` and then `router.push({ name: 'Map' })`.

Use `<script setup>`, no semicolons, brand-styled buttons. The point is to prove the guard works end-to-end.
</action>

<verify>
1. Files exist: `goed/src/router/index.js` (modified), `goed/src/views/ClaimLoginView.vue` (new), `goed/src/views/CompanyEditView.vue` (new).
2. `npm --prefix goed run build` succeeds (router compiles, both views import cleanly).
3. With dev server running (`npm --prefix goed run dev`), navigating to `/company/<known-startup-id>/claim` renders the email form with the company name. (Manual or Playwright check during phase verification.)
4. With dev server running and no session, navigating to `/company/<known-startup-id>/edit` 302s to `/company/<known-startup-id>/claim` (guard works).
5. Code review: `router/index.js` imports `claimGuard` and only the `CompanyEdit` route uses `beforeEnter: claimGuard`.
</verify>

<done>
The two new routes are registered, the claim login view renders with company name + email input + reason banner, and the edit view stub is reachable only when both a session AND a matching `company_claims` row exist.
</done>

---

### Task 4: Wire claim CTAs in `SubmitResult.vue` and `CompanyDrawer.vue`

**Type:** auto
**Sequence:** 3

<files>
goed/src/components/submit/SubmitResult.vue
goed/src/components/drawer/CompanyDrawer.vue
</files>

<action>
**4a. `goed/src/components/submit/SubmitResult.vue`:**
- In the `pending` section, replace the existing `<router-link to="/admin" class="btn btn-ghost">Claim your listing</router-link>` with `<router-link :to="{ name: 'ClaimLogin', params: { id: result.startup_id } }" class="btn btn-ghost">Claim your listing</router-link>`.
- Add the same `<router-link>` to the `auto_published` section, placed after the existing "Copy share link" button block, so founders of auto-published companies can also claim. Use the same classes/styling.
- Do not change any other existing markup or script.

**4b. `goed/src/components/drawer/CompanyDrawer.vue`:**
- Inside the `<div v-if="company">` block, after the existing `<p class="county-tag inline-block">{{ regionLabel }}</p>` line and before the closing `</div>`, add a footer block containing a single `<router-link :to="{ name: 'ClaimLogin', params: { id: company.id } }" class="btn btn-ghost mt-6 inline-block">Claim your listing</router-link>`.
- No script changes — the link uses the already-available `company` computed. No new style rules — reuse `btn btn-ghost`.
</action>

<verify>
1. Files modified, no untouched files added.
2. Code review: neither component contains a hardcoded `to="/admin"` or a literal company id; both use `params: { id: ... }` with the dynamic id.
3. `npm --prefix goed run build` succeeds.
4. With dev server running: opening the company drawer for any startup shows a "Claim your listing" ghost button that, when clicked, routes to `/company/<that-id>/claim` and shows the matching company name. (Manual / Playwright.)
5. Submitting a brand-new company that lands in `pending` shows a "Claim your listing" link pointing to `/company/<new-id>/claim`. (Manual / Playwright if a fresh seed is available.)
</verify>

<done>
Both CTA surfaces route to `ClaimLogin` with the correct dynamic startup id, and the broken `to="/admin"` link in `SubmitResult.vue` is gone.
</done>

## Verification Checklist

Maps 1:1 to the phase's roadmap verification list, plus the redirect/sign-out edge.

- [ ] Navigating to `/company/<valid-id>/edit` without a session redirects to `/company/<valid-id>/claim`.
- [ ] `ClaimLoginView` renders the company name (fetched from `map_startups` by `:id`) and an email input form.
- [ ] Submitting a mismatched email domain shows an error message surfaced from the `claim-company` edge function (400).
- [ ] Submitting a matching email inserts a `company_claims` row AND triggers a Supabase OTP email (verified via `company_claims` table OR Supabase Auth logs).
- [ ] After clicking the magic link, the user lands on `/company/:id/edit` and the page renders (guard passes because `company_claims` row exists).
- [ ] An authenticated user not in `company_claims` for a given id is signed out and redirected to `/company/:id/claim?reason=not-allowed` with the banner shown.
- [ ] `CompanyDrawer` displays a "Claim your listing" ghost button that routes to `ClaimLogin` with the selected company's id.
- [ ] `SubmitResult` (both `pending` and `auto_published` sections) shows a "Claim your listing" link routing to `ClaimLogin` with `result.startup_id`.
- [ ] Playwright: navigate to `/company/<seeded-id>/edit`, assert redirect to `/company/<seeded-id>/claim`; assert email input is present.

## Success Criteria

The full claim entry flow is reachable end-to-end from the UI: a logged-out founder can land on `ClaimLoginView` from the map drawer or the submit result, request a magic link (validated by the existing `claim-company` edge function), follow the OTP email, and arrive on a guarded `/company/:id/edit` page that recognizes them as the owner. Non-owners are bounced back with a clear reason banner. No admin-route plumbing is touched; the new flow lives entirely in parallel files (`useClaimAuth.js`, two new routes, two new views, one new guard, two CTA edits).
