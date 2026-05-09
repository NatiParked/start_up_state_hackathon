# Feature 0006: AI Onboarding — Claim & Self-Service Edit

Created: 2026-05-09
Status: Draft
Epic: 0001

## Goal
Enable founders to claim their company listing via a domain-verified magic-link flow (mirroring the existing admin auth pattern) and edit their public profile at `/company/:id/edit`, scoped so they can only modify their own company.

## Background
Companies appearing on the Utah Startup Map currently have no owner-facing controls. This milestone adds a founder auth layer that deliberately mirrors the existing admin auth system: `company_claims` acts as a per-startup allow-list (like `map_admin_users`), `useClaimAuth.js` mirrors `useAdminAuth.js`, and `claimGuard` in `guards.js` mirrors `adminGuard` — except the check is scoped to one startup_id rather than global. A standalone `claim-company` edge function validates email-domain ownership and inserts the claim row; the client then initiates Supabase OTP via the standard `signInWithOtp` path. No custom token columns, no `verify-claim` function.

## Success Criteria
- Founder can initiate a claim from `SubmitResult.vue` (pending/auto-published screen) or from `CompanyDrawer.vue` — both route to `/company/:id/claim`
- `/company/:id/claim` (ClaimLoginView) collects their email, calls `claim-company` to register + validate domain, then calls `supabase.auth.signInWithOtp` with redirect to `/company/:id/edit`
- `claim-company` edge function validates that the submitted email's domain matches the company's website domain; rejects mismatches with a clear error
- After OTP click, `claimGuard` checks `session.user.email` against `company_claims` for that startup_id — passes only if a matching row exists
- Authenticated founder at `/company/:id/edit` can edit all profile fields: name, description, sector, stage, employee_range, investors[], total_raised, website, contact_email
- `PhotoGallery.vue` fetches and displays Google Places photos (via `company-photos` edge function, keeping the API key server-side); founder can reorder/remove photos
- `CompanyAnalytics.vue` shows "X views this week / X views total" stat cards via `get_company_view_stats(startup_id)` RPC (returns zeros until M10)
- Non-owning authenticated users are denied access to another company's edit page (guard redirects to `/company/:id/claim` with `?reason=not-allowed`)
- Migration is named exactly `supabase/migrations/0003_claims.sql`

---

## Phases

### Phase 1: Database & Edge Function
**Goal:** Stand up `company_claims` table, `get_company_view_stats` RPC stub, and the `claim-company` edge function that validates domain ownership and registers a claim row.

#### Tasks
- [ ] Task 1.1 — `supabase/migrations/0003_claims.sql`: Create `company_claims` table with columns `id uuid primary key default gen_random_uuid()`, `startup_id uuid not null references map_startups(id) on delete cascade`, `claimer_email text not null`, `created_at timestamptz not null default now()`; unique constraint on `(startup_id, claimer_email)`; B-tree index on `startup_id`; enable RLS with service-role-only INSERT/DELETE policy and a SELECT policy allowing authenticated users to read their own rows (`auth.jwt() ->> 'email' = claimer_email`).
- [ ] Task 1.2 — `supabase/migrations/0003_claims.sql`: Add SQL function `get_company_view_stats(p_startup_id uuid) returns jsonb language sql stable as $$ select jsonb_build_object('views_this_week', 0, 'views_total', 0) $$;`; grant execute to `anon, authenticated`.
- [ ] Task 1.3 — `supabase/functions/claim-company/index.js`: New edge function accepting `POST { startup_id, claimer_email }`. Steps: (1) fetch the `map_startups` row for `startup_id`; (2) normalize both the company `website` domain and `claimer_email` domain; (3) if domains don't match, return 400 `{ error: 'EMAIL_DOMAIN_MISMATCH', message: 'Email domain does not match company website' }`; (4) upsert into `company_claims (startup_id, claimer_email)` using service-role client (conflict on `(startup_id, claimer_email)` does nothing — idempotent); (5) return 200 `{ ok: true }`. CORS preflight handler at top, same pattern as `approve-submission/index.js`.
- [ ] Task 1.4 — `supabase/functions/claim-company/index.js`: Use `createAdminClient()` from `../_shared/supabaseAdmin.js` for the DB write. The OTP email is sent by the client (not this function) — function only validates and registers. No email calls from this edge function.

#### Verification
- [ ] `supabase migration up` applies `0003_claims.sql` cleanly with no SQL errors
- [ ] `select * from company_claims` returns empty set with expected columns (id, startup_id, claimer_email, created_at)
- [ ] `select get_company_view_stats('<any uuid>'::uuid)` returns `{"views_this_week": 0, "views_total": 0}`
- [ ] POST `{ startup_id: <valid id>, claimer_email: 'admin@thatcompany.com' }` where website is `https://thatcompany.com` → 200 `{ ok: true }`, row appears in `company_claims`
- [ ] POST with mismatched email domain → 400 `EMAIL_DOMAIN_MISMATCH`
- [ ] Duplicate POST (same startup_id + email) → 200 `{ ok: true }` (idempotent, no duplicate row)

---

### Phase 2: Claim Flow Frontend
**Goal:** Wire `/company/:id/claim` (login page) and `/company/:id/edit` (gated edit page) using the same auth pattern as the admin section, with claim CTAs in CompanyDrawer and SubmitResult.

#### Tasks
- [ ] Task 2.1 — `goed/src/composables/useClaimAuth.js`: New composable mirroring `useAdminAuth.js`. Module-level `session` ref + single `onAuthStateChange` subscription guarded by a `subscribed` flag (same pattern). Exports `useClaimAuth(startupId)` which: (1) returns module-level `session`; (2) has a `watchEffect` that checks `company_claims` for `startup_id` + `session.user.email` using `.maybeSingle()`, sets `claimVerified` ref; (3) exposes `isOwner` computed (`claimVerified.value`), `isCheckingClaim` ref, `requestClaim(startupId, email)` (calls `supabase.functions.invoke('claim-company', ...)` then `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/company/' + startupId + '/edit' } })`), `signOut()`.
- [ ] Task 2.2 — `goed/src/router/guards.js`: Add `claimGuard(to, _from, next)` function alongside `adminGuard`. Pattern: check session → if none, `next({ name: 'ClaimLogin', params: { id: to.params.id } })`; check `company_claims` for `(to.params.id, session.user.email)` using `.maybeSingle()`; if no row, `signOut()` + `next({ name: 'ClaimLogin', params: { id: to.params.id }, query: { reason: 'not-allowed' } })`; else `next()`.
- [ ] Task 2.3 — `goed/src/router/index.js`: Add two routes: `{ path: '/company/:id/claim', name: 'ClaimLogin', component: () => import('@/views/ClaimLoginView.vue') }` and `{ path: '/company/:id/edit', name: 'CompanyEdit', component: () => import('@/views/CompanyEditView.vue'), beforeEnter: claimGuard }`. Import `claimGuard` from `./guards`.
- [ ] Task 2.4 — `goed/src/views/ClaimLoginView.vue`: New view mirroring `AdminLogin.vue` in structure. Shows company name (fetched by `startup_id` from route param on mount). Email input form; on submit calls `requestClaim(id, email)` from `useClaimAuth`; shows two states: form (default) and sent ("Check your inbox — we sent a magic link to `admin@<domain>`"). Watches `isOwner`; if it becomes true (i.e. session establishes and claim row exists), redirects to `{ name: 'CompanyEdit', params: { id } }`. Displays `?reason=not-allowed` message when present.
- [ ] Task 2.5 — `goed/src/components/submit/SubmitResult.vue`: Replace the broken `<router-link to="/admin">Claim your listing</router-link>` in the `pending` view with `<router-link :to="{ name: 'ClaimLogin', params: { id: result.startup_id } }">Claim your listing</router-link>`. Also add the same link to the `auto_published` success section so founders of auto-published companies can claim.
- [ ] Task 2.6 — `goed/src/components/drawer/CompanyDrawer.vue`: Add a "Claim your listing" button (ghost style) in the drawer footer area. It is a `<router-link :to="{ name: 'ClaimLogin', params: { id: company.id } }">`. No inline form needed — routing to ClaimLoginView keeps the UX consistent with admin.

#### Verification
- [ ] Navigating to `/company/<valid-id>/edit` without a session redirects to `/company/<valid-id>/claim`
- [ ] ClaimLoginView shows the company name and an email input form
- [ ] Submitting a mismatched email domain shows an error (surfaced from the edge function 400 response)
- [ ] Submitting a matching email → `claim-company` row inserted + Supabase OTP sent (verify via Supabase Auth logs or DB row in `company_claims`)
- [ ] Playwright: navigate to `/company/<seeded-id>/edit`, assert redirect to `/company/<seeded-id>/claim`; assert ClaimLoginView renders with an email input

---

### Phase 3: Edit UI & Components
**Goal:** Deliver the inline edit form, Google Places photo gallery, and analytics stat cards so a verified founder can view and update their full listing.

#### Tasks
- [ ] Task 3.1 — `goed/src/views/CompanyEditView.vue`: New view (gated by `claimGuard`). On mount fetches the full `map_startups` row for `route.params.id`. Renders a form with all editable fields: `name`, `description`, `sector`, `stage`, `employee_range`, `investors` (comma-separated text → split to array on save), `total_raised`, `website`, `contact_email`. On save calls `supabase.from('map_startups').update(patch).eq('id', id)` using the anon client (RLS must permit authenticated user whose email is in `company_claims` for this row — add that UPDATE policy to `0003_claims.sql`). Show success toast and error state using `isLoading` / `error` refs per project conventions. Embeds `<PhotoGallery>` and `<CompanyAnalytics>` components.
- [ ] Task 3.2 — `supabase/migrations/0003_claims.sql` (addendum to Task 3.1): Add an UPDATE RLS policy on `map_startups` — `using (exists (select 1 from company_claims where startup_id = id and claimer_email = auth.jwt() ->> 'email'))`. Add this policy in the same migration file, after the `company_claims` table definition.
- [ ] Task 3.3 — `supabase/functions/company-photos/index.js`: New edge function accepting `GET ?place_id=<id>`. Calls Google Places Photo API using `Deno.env.get('GOOGLE_PLACES_API_KEY')` — keeps the key server-side. Returns `{ photos: [{ url: string, attribution: string }] }`. Handles missing `GOOGLE_PLACES_API_KEY` gracefully (returns `{ photos: [] }`). CORS preflight handler.
- [ ] Task 3.4 — `goed/src/components/company/PhotoGallery.vue`: New component accepting `company` prop. On mount calls `supabase.functions.invoke('company-photos', { body: { place_id: company.google_place_id } })` if `google_place_id` is present; otherwise shows empty state ("No photos available"). Renders a responsive photo grid. Each photo has a remove button. Founder can drag to reorder (simple index swap). Save button persists the curated `photos` array to `map_startups.photos` (jsonb column — add to migration if not present). Shows empty-state message if no `google_place_id`.
- [ ] Task 3.5 — `goed/src/components/map/CompanyAnalytics.vue`: New component accepting `startupId` prop. On mount calls `supabase.rpc('get_company_view_stats', { p_startup_id: startupId })`. Renders two stat cards with utah-blue styling: "Views this week" and "Views total". Includes a small footnote: "Live stats coming soon". Uses `isLoading` / `error` refs per project conventions.
- [ ] Task 3.6 — `supabase/migrations/0003_claims.sql` (addendum for photos): Add `photos jsonb default '[]'::jsonb` column to `map_startups` if not already present (check existing migration 0001 first — add as a separate `alter table` in 0003 only if the column is absent).

#### Verification
- [ ] Visiting `/company/<seeded-id>/edit` as an authenticated claimed owner renders the full edit form pre-populated with existing data
- [ ] Editing the `description` field and clicking Save persists the change to `map_startups`; refreshing the page shows the updated value
- [ ] `PhotoGallery` renders for a company with a known `google_place_id`; remove and reorder actions update the displayed list before save
- [ ] `CompanyAnalytics` renders two `0` stat cards and the "Live stats coming soon" footnote
- [ ] Authenticated user whose email is NOT in `company_claims` for this startup is denied the update — Supabase returns a RLS violation / empty affected rows
- [ ] Playwright: seed a `company_claims` row + Supabase session token; navigate to edit view; fill description; click Save; assert success toast
