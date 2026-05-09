# Feature Plan: Phase 3 — Submission Queue & Company CRUD

## Objective

Deliver the staff workflow that lets admins approve, reject, or edit-then-approve pending submissions, and search/sort/edit any record in `map_startups` directly — backed by two new Edge Functions and an additive RLS migration that allows allow-listed admins to write to `map_startups`.

**Purpose:** Close the moderation loop for the Utah Startup Map so submissions become live records and existing records can be corrected without touching SQL.
**Output:** 2 Vue views, 2 Vue components, 2 Edge Functions, 1 SQL migration, router wiring updates.

## Must-Haves (Goal-Backward)

### Observable Truths

- An admin visiting `/admin/submissions` sees every `map_startup_submissions` row with `status = 'pending'`, newest first.
- Clicking a submission row opens a slide-in `SubmissionReview` panel with extracted `startup_data` fields on the left and a website iframe preview on the right.
- Clicking **Approve** in the review panel inserts the submission's `startup_data` into `map_startups`, marks the submission `approved` (with `reviewed_by` = current admin email), and removes it from the queue.
- Clicking **Reject** with a typed reason marks the submission `rejected` (with `rejection_reason` persisted) and removes it from the queue.
- Clicking **Edit-then-Approve** lets the admin override fields before insert; the merged record lands in `map_startups`.
- An admin visiting `/admin/companies` sees all `map_startups` rows; the search box filters by name in real time and column headers (name, sector, stage, created_at) toggle asc/desc sorting.
- Clicking a company row opens a slide-in `CompanyEditor`; saving any change persists to Supabase and the public `/` map reflects the update on next refetch.
- Non-admin authenticated users still cannot UPDATE/INSERT `map_startups` (RLS gates writes to allow-listed emails).

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `supabase/migrations/0007_admin_map_startups_rls.sql` | RLS policies allowing allow-listed admins to UPDATE/INSERT `map_startups` | (SQL only) |
| `supabase/functions/approve-submission/index.js` | Edge Function: verify admin → merge overrides → insert into `map_startups` → mark submission approved | `Deno.serve` handler |
| `supabase/functions/reject-submission/index.js` | Edge Function: verify admin → mark submission rejected with `rejection_reason` | `Deno.serve` handler |
| `goed/src/views/admin/SubmissionQueue.vue` | Pending-submissions table + slide-in review panel host | default export (Vue SFC) |
| `goed/src/components/admin/SubmissionReview.vue` | Two-column review panel; Approve/Reject/Edit-then-Approve actions | default export (Vue SFC) |
| `goed/src/views/admin/CompanyList.vue` | All-companies table with client-side search + sort | default export (Vue SFC) |
| `goed/src/components/admin/CompanyEditor.vue` | Full edit form for every `map_startups` column | default export (Vue SFC) |
| `goed/src/router/index.js` | Wires `AdminSubmissions` and `AdminCompanies` to real views (replacing placeholders) | (modified) |

### Key Links

| From | To | Via |
|------|----|-----|
| `SubmissionQueue.vue` | `useAdminStore().submissions` | `fetchSubmissions()` action (already exists) |
| `SubmissionReview.vue` Approve button | `approve-submission` Edge Function | `supabase.functions.invoke('approve-submission', { body: { submission_id, overrides? } })` with current session JWT |
| `SubmissionReview.vue` Reject button | `reject-submission` Edge Function | `supabase.functions.invoke('reject-submission', { body: { submission_id, rejection_reason } })` |
| `approve-submission` | `map_startups` INSERT + `map_startup_submissions` UPDATE | service-role client from `_shared/supabaseAdmin.js`; auth via JWT in `Authorization` header → `supabase.auth.getUser(jwt)` → `map_admin_users` lookup |
| `reject-submission` | `map_startup_submissions` UPDATE | same auth pattern as approve |
| `CompanyList.vue` | `useStartupsStore().companies` | existing `fetchAll()` action |
| `CompanyEditor.vue` Save | `map_startups` UPDATE via anon client | `supabase.from('map_startups').update(payload).eq('id', id)` — RLS allows because user email is in `map_admin_users` (new policy in 0007) |

## Dependency Graph

```
Task 1 (RLS migration + 2 Edge Functions)
  └─→ creates: 0007 migration, approve-submission, reject-submission

Task 2 (SubmissionQueue.vue + SubmissionReview.vue)  ← needs Task 1
  └─→ depends on: approve-submission + reject-submission Edge Functions

Task 3 (CompanyList.vue + CompanyEditor.vue + router wire-up)  ← needs Task 1
  └─→ depends on: 0007 RLS policy granting admin UPDATE on map_startups
```

## Execution Sequences

| Sequence | Tasks | Parallel? |
|----------|-------|-----------|
| 1 | Task 1 | — (single task) |
| 2 | Task 2, Task 3 | Yes (independent of each other; both depend only on Task 1) |

## Tasks

### Task 1: RLS migration + approve-submission and reject-submission Edge Functions

**Type:** auto
**Sequence:** 1

<files>
supabase/migrations/0007_admin_map_startups_rls.sql
supabase/functions/approve-submission/index.js
supabase/functions/reject-submission/index.js
</files>

<action>
Create migration `0007_admin_map_startups_rls.sql` with two additive policies on `map_startups`: an `admins update map_startups` policy (FOR UPDATE TO authenticated, USING + WITH CHECK = `auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users)`) and an `admins insert map_startups` policy (FOR INSERT TO authenticated, WITH CHECK same predicate). Make idempotent with `DROP POLICY IF EXISTS` before each `CREATE POLICY`. Apply via Supabase MCP `apply_migration`.

Create `supabase/functions/approve-submission/index.js` as a Deno `Deno.serve` handler. Import `createAdminClient` from `../_shared/supabaseAdmin.js` and `createClient` from `npm:@supabase/supabase-js@2`. Read JSON body `{ submission_id, overrides }`. Extract JWT from the `Authorization: Bearer <jwt>` header, call `supabase.auth.getUser(jwt)` using a non-service client built with the JWT, then look up the user's email in `map_admin_users` via the admin client. On unauthorized return `{ error: 'unauthorized', code: 401 }` with HTTP 401. On success: select the submission row, deep-merge `overrides` into `startup_data`, insert the merged record into `map_startups`, then update the submission with `status = 'approved'`, `reviewed_at = now()`, `reviewed_by = <admin email>`. Return `{ data: { startup_id }, error: null }`. Handle CORS preflight (`OPTIONS`) and include `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`.

Create `supabase/functions/reject-submission/index.js` with the same admin-auth pattern. Read body `{ submission_id, rejection_reason }`. Update the submission with `status = 'rejected'`, `rejection_reason`, `reviewed_at = now()`, `reviewed_by = <admin email>`. Return `{ data: { submission_id }, error: null }`. Same CORS handling.

Deploy both functions via Supabase MCP (or `supabase functions deploy approve-submission` / `reject-submission` if CLI is wired up). Do not log secrets; do not include `console.log` in committed code (Deno `console.error` for genuine error paths is acceptable since project rule is "no `console.log`").
</action>

<verify>
1. Files exist:
   - `supabase/migrations/0007_admin_map_startups_rls.sql`
   - `supabase/functions/approve-submission/index.js`
   - `supabase/functions/reject-submission/index.js`
2. Migration applied: Supabase MCP `list_tables` (or `execute_sql` `SELECT polname FROM pg_policies WHERE tablename = 'map_startups';`) returns the two new policies (`admins update map_startups`, `admins insert map_startups`).
3. Functions deployed: Supabase MCP `list_edge_functions` (or `supabase functions list`) shows `approve-submission` and `reject-submission`.
4. Auth gate works: `curl -X POST $SUPABASE_URL/functions/v1/approve-submission -H 'Authorization: Bearer <invalid-jwt>' -d '{}'` returns HTTP 401 with body containing `"error":"unauthorized"`.
5. Functional smoke (optional, requires real admin JWT): an admin-authenticated invocation of `approve-submission` with a valid pending `submission_id` inserts a row into `map_startups` and flips the submission to `approved`.
</verify>

<done>
Migration is applied to remote Supabase, both Edge Functions are deployed and respond, and the unauthorized path returns 401 with the documented `{ error, code }` shape.
</done>

---

### Task 2: SubmissionQueue.vue + SubmissionReview.vue

**Type:** auto
**Sequence:** 2

<files>
goed/src/views/admin/SubmissionQueue.vue
goed/src/components/admin/SubmissionReview.vue
</files>

<action>
Create `goed/src/views/admin/SubmissionQueue.vue` (SFC block order: `<script setup>` → `<template>` → `<style scoped>`). On mount, call `useAdminStore().fetchSubmissions()`. Render a Tailwind-styled table with columns: `submitted_at` (formatted), `name` (read from `row.startup_data?.name ?? '—'`), `website` (read from `row.startup_data?.website`), submitter email (`row.submitter_email` or whatever column exists; verify against the schema — if the column is named differently, use the actual name), and an action cell with a "View" button. Track `selectedSubmissionId` as a `ref(null)`. Clicking a row sets it and renders `<SubmissionReview>` as a slide-in panel using GSAP (`gsap.from(panelEl, { x: '100%', duration: 0.3, ease: 'power2.out' })` inside `onMounted` of the panel, or via `v-if` + `@vue:mounted`). Provide a close handler that animates out and clears `selectedSubmissionId`. Use Tailwind brand tokens only (`utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`); no raw hex.

Create `goed/src/components/admin/SubmissionReview.vue` accepting prop `submissionId` (or the full submission row — pick one and stay consistent). Layout: two columns (CSS grid `grid-cols-2` or flex). Left: pretty-printed extracted `startup_data` jsonb — render labeled fields for `name`, `website`, `sector`, `stage`, `description`, plus any other keys present (loop `Object.entries(startup_data)` for the fallback). Right: `<iframe :src="startup_data.website" class="w-full h-full" referrerpolicy="no-referrer">` with a fallback "Open in new tab" anchor below it. Three action buttons:
- **Approve**: calls `supabase.functions.invoke('approve-submission', { body: { submission_id } })`. On success, emits `approved` event; parent removes row from list and closes panel.
- **Reject**: toggles a small inline `<textarea>` for `rejection_reason`. Submitting calls `supabase.functions.invoke('reject-submission', { body: { submission_id, rejection_reason } })`. On success, emits `rejected`.
- **Edit-then-Approve**: toggles an inline editable mirror of `startup_data` (text inputs for each scalar key). Save passes `{ submission_id, overrides }` to `approve-submission`.

Wire button states to a local `isSaving` ref to disable during in-flight calls. Show inline error if the function returns `{ error }`. No `console.log`. Default export the SFC.

Update router: in `goed/src/router/index.js`, replace the `submissions` placeholder with `component: () => import('@/views/admin/SubmissionQueue.vue')` and remove the `props: { title }`.
</action>

<verify>
1. Files exist:
   - `goed/src/views/admin/SubmissionQueue.vue`
   - `goed/src/components/admin/SubmissionReview.vue`
   - `goed/src/router/index.js` has `AdminSubmissions` route pointing to `SubmissionQueue.vue` (no longer placeholder).
2. Build passes: `cd goed && npm run build` exits 0 with no errors.
3. Functional (manual or Playwright):
   - Navigate to `/admin/submissions` as logged-in admin → table renders with at least the column headers.
   - If pending rows exist, clicking one opens the slide-in review panel.
   - Approve button on a real pending submission inserts a row in `map_startups` (verify via Supabase MCP `execute_sql`) and the submission disappears from the queue.
   - Reject button with a typed reason flips the submission to `status = 'rejected'` with `rejection_reason` persisted.
4. Domain complete: an admin can clear a pending submission by approving or rejecting it without leaving `/admin/submissions`.
</verify>

<done>
`/admin/submissions` lists pending submissions, the review panel opens with extracted fields + website iframe, and Approve/Reject/Edit-then-Approve all round-trip through the Edge Functions and update both `map_startups` and `map_startup_submissions` correctly.
</done>

---

### Task 3: CompanyList.vue + CompanyEditor.vue + router wire-up

**Type:** auto
**Sequence:** 2

<files>
goed/src/views/admin/CompanyList.vue
goed/src/components/admin/CompanyEditor.vue
goed/src/router/index.js
</files>

<action>
Create `goed/src/views/admin/CompanyList.vue` (SFC block order: `<script setup>` → `<template>` → `<style scoped>`). On mount, call `useStartupsStore().fetchAll()`. Bind `companies` via `storeToRefs`. Add a `searchQuery` ref and a `sortKey` / `sortDir` pair (`sortKey` ∈ `'name' | 'sector' | 'stage' | 'created_at'`, `sortDir` ∈ `'asc' | 'desc'`). Render a computed `displayedCompanies` that (a) filters by case-insensitive substring of `name` matching `searchQuery`, then (b) sorts by `sortKey` in `sortDir`. Header cells for sortable columns are clickable buttons that toggle `sortDir` if same key, else set new key with `'asc'`. Track `selectedCompanyId` ref; clicking a row opens `<CompanyEditor>` as a slide-in panel (same GSAP pattern as Task 2). Tailwind brand tokens only.

Create `goed/src/components/admin/CompanyEditor.vue` accepting prop `companyId` (or the company row). Render a full edit form with inputs for every `map_startups` column: `name`, `description` (textarea), `website`, `linkedin`, `address`, `city`, `lat` (number), `lng` (number), `region` (select), `sector` (select), `stage` (select), `funding_stage` (select), `business_type` (select), `employee_range` (select), `founded_year` (number), `is_hiring` (checkbox), `job_titles` (text input — comma-separated, parse to `text[]` on save by splitting on `,` and trimming), `careers_url`, `logo_url`, `google_place_id`, `google_rating` (number), `phone`, `investors` (comma-separated → `text[]`), `total_raised` (number), `verified` (checkbox). Initialize form state from the company row.

Save handler:
1. Capture pre-update snapshot from `useStartupsStore().companies` for rollback.
2. Optimistically update the store entry (`Object.assign` on the matching `companies` ref item).
3. Call `await supabase.from('map_startups').update(payload).eq('id', companyId)`.
4. If `error` is non-null, restore the snapshot in the store and surface an inline error message.
5. On success, close the panel.

Cancel button discards form state and closes panel without writing.

Update `goed/src/router/index.js`: replace the `companies` placeholder with `component: () => import('@/views/admin/CompanyList.vue')`. Confirm submissions route was wired in Task 2 (no-op if so). No `console.log`. Single quotes, 2-space indent, no semicolons, trailing commas.
</action>

<verify>
1. Files exist:
   - `goed/src/views/admin/CompanyList.vue`
   - `goed/src/components/admin/CompanyEditor.vue`
   - `goed/src/router/index.js` has `AdminCompanies` route pointing to `CompanyList.vue`.
2. Build passes: `cd goed && npm run build` exits 0 with no errors.
3. Functional:
   - Navigate to `/admin/companies` as admin → table renders all `map_startups` rows.
   - Typing in the search box filters by name in real time.
   - Clicking the `name` header sorts asc; clicking again sorts desc; same for `sector`, `stage`, `created_at`.
   - Clicking a row opens the editor panel with every field populated from the row.
   - Editing a field (e.g. toggling `is_hiring`, changing `sector`) and clicking Save updates the row in Supabase (verify via Supabase MCP `execute_sql SELECT ... WHERE id = ...`) and updates the local store; navigating back to `/` shows the change after refetch.
   - Cancel button discards changes (no Supabase write).
4. Domain complete: any column on any `map_startups` row can be edited from the admin UI without touching SQL.
</verify>

<done>
`/admin/companies` lists every company with working search and sort, and `CompanyEditor` round-trips edits to Supabase with optimistic store updates and rollback-on-error.
</done>

## Verification Checklist

- [x] Migration `0007_admin_map_startups_rls.sql` is applied; `pg_policies` shows `admins update map_startups` and `admins insert map_startups` policies on `map_startups`.
  - Completed: 2026-05-09 — `execute_sql` confirmed both policies active on `map_startups`.
- [x] `approve-submission` and `reject-submission` Edge Functions are deployed; unauthenticated `curl` returns HTTP 401 with `{ error: 'unauthorized', code: 401 }`.
  - Completed: 2026-05-09 — Both functions ACTIVE (v1); smoke test confirmed 401 + correct body for invalid JWT; CORS preflight returns 204 with correct headers.
- [ ] `/admin/submissions` lists every `status = 'pending'` row; Approve writes to `map_startups` and flips status to `approved`; Reject writes `rejection_reason` and flips status to `rejected`; both remove the row from the queue.
- [ ] `/admin/companies` lists all `map_startups`; search filters by name, header clicks sort asc/desc on `name`, `sector`, `stage`, `created_at`.
- [ ] Editing a `map_startups` row in `CompanyEditor` and clicking Save persists to Supabase, optimistically updates the store, and the public `/` map reflects the change after refetch.
- [ ] `cd goed && npm run build` exits 0; no `console.log` in committed code; Tailwind brand tokens only (no raw hex).

## Success Criteria

Phase 3 is complete when an admin user can:
1. Open `/admin/submissions`, click a pending submission, and approve, reject, or edit-then-approve it — with all three actions correctly persisting to Supabase via the new Edge Functions and removing the row from the queue.
2. Open `/admin/companies`, search and sort the full company list, click a row to open the editor, change any field, save, and observe the change both in Supabase and on the public `/` map after refetch.
3. Non-admin users (authenticated or anonymous) still cannot UPDATE or INSERT `map_startups` directly — RLS continues to gate writes to allow-listed emails only.
