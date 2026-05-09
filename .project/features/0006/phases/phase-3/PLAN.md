# Feature Plan: Phase 3 — Edit UI & Components

Feature: 0006 — AI Onboarding: Claim & Self-Service Edit
Phase: 3 of 3

---

## Objective

Deliver the inline edit form, Google Places photo gallery, and analytics stat cards so a verified founder can view and update their full listing at `/company/:id/edit`. This phase fleshes out the existing `CompanyEditView.vue` stub (created in Phase 2), adds the supporting `PhotoGallery` and `CompanyAnalytics` components, ships a server-side `company-photos` edge function (keeping the Google API key off the client), and applies the migration addenda required by the new edit surface (UPDATE RLS policy on `map_startups`, plus `photos jsonb` column).

**Purpose:** Phases 1+2 already shipped the auth / claim plumbing. Phase 3 turns the gated edit URL into a working self-service editor and is the last milestone before the feature is end-to-end usable.

**Output:**
- Migration addendum in `supabase/migrations/0003_claims.sql` (UPDATE RLS policy on `map_startups` + `photos jsonb` column)
- New edge function `supabase/functions/company-photos/index.js`
- New components `goed/src/components/company/PhotoGallery.vue` and `goed/src/components/map/CompanyAnalytics.vue`
- Filled-out `goed/src/views/CompanyEditView.vue` (replacing the Phase 2 stub)
- **Phase 2 bug fix** in `goed/src/composables/useClaimAuth.js` and `goed/src/router/guards.js` (column name mismatch — see Notes)

---

## Must-Haves (Goal-Backward)

### Observable Truths

Each must be **provable inside Phase 3**, not deferred:

1. An authenticated, claimed founder visiting `/company/<seeded-id>/edit` sees a form pre-populated with the existing `map_startups` row data (name, description, sector, stage, employee_range, investors, total_raised, website, contact_email).
2. Editing the `description` field and clicking **Save** updates `map_startups`; refreshing the page shows the new value.
3. An authenticated user whose email is NOT in `company_claims` for this startup gets an RLS-denied response on save (PostgREST returns zero affected rows / RLS violation).
4. `<PhotoGallery>` renders a responsive grid for a company with a `google_place_id`. Remove and reorder controls update the displayed list before save; clicking Save persists the curated array to `map_startups.photos`.
5. For a company without `google_place_id`, `<PhotoGallery>` shows an empty state ("No photos available") instead of erroring.
6. `<CompanyAnalytics>` renders two stat cards (utah-blue) reading "0 Views this week" and "0 Views total" plus the footnote "Live stats coming soon."
7. The `company-photos` edge function returns `{ photos: [] }` (200) when `GOOGLE_PLACES_API_KEY` is missing — never 500.

### Required Artifacts

| Path | Provides | Key Exports |
|---|---|---|
| `supabase/migrations/0003_claims.sql` (addendum) | UPDATE RLS policy on `map_startups`; `photos jsonb default '[]'::jsonb` column | SQL only — apply via Supabase MCP `apply_migration` |
| `supabase/functions/company-photos/index.js` | Server-side proxy to Google Places Photo API | `Deno.serve` handler accepting `GET ?place_id=...` and POST `{ place_id }` |
| `goed/src/components/company/PhotoGallery.vue` | Photo grid with remove + reorder + save | Default Vue component; props `{ company }` |
| `goed/src/components/map/CompanyAnalytics.vue` | Two-card stats panel | Default Vue component; props `{ startupId }` |
| `goed/src/views/CompanyEditView.vue` | Full editable form embedding the two new components | Default Vue component (overwrites the Phase 2 stub) |
| `goed/src/composables/useClaimAuth.js` (bug fix) | Auth composable now queries the correct column | Same exports — fixes broken WHERE clause |
| `goed/src/router/guards.js` (bug fix) | `claimGuard` queries the correct column | Same exports — fixes broken WHERE clause |

### Required Wiring

- `CompanyEditView.vue` fetches the row on mount via the **anon** Supabase client: `supabase.from('map_startups').select('*').eq('id', route.params.id).maybeSingle()`. This works because `map_startups` already has a public SELECT policy from `0001_init.sql`.
- Save uses the **anon** Supabase client too (`supabase.from('map_startups').update(patch).eq('id', id)`). Authorization comes entirely from the new UPDATE RLS policy added in Task 1 of this phase — the policy checks `claimer_email = auth.jwt() ->> 'email'`, so a logged-in claimer's update succeeds and a stranger's update returns zero affected rows.
- `PhotoGallery.vue` calls `supabase.functions.invoke('company-photos', { body: { place_id: company.google_place_id } })`. Local `photos` ref starts as `company.photos ?? []` merged with the fetched Google photos (de-duped). Save persists via `supabase.from('map_startups').update({ photos }).eq('id', company.id)`.
- `CompanyAnalytics.vue` calls `supabase.rpc('get_company_view_stats', { p_startup_id: startupId })` on mount; defaults to `{ views_this_week: 0, views_total: 0 }` on error so the cards always render.
- `CompanyEditView` embeds `<CompanyAnalytics :startup-id="id" />` and `<PhotoGallery :company="company" />` once the company row has loaded (`v-if="company"`).
- The `company-photos` edge function uses the **two-step** Places (New) Photo flow: first GET `https://places.googleapis.com/v1/places/<place_id>?fields=photos&key=<key>` to list photo `name`s, then for each return a constructed media URL `https://places.googleapis.com/v1/<photo_name>/media?maxWidthPx=800&key=<key>` (or do a `HEAD` follow once for stable URLs). Attribution comes from `photo.authorAttributions[0]?.displayName` if present.

### Key Links

| From | To | Via |
|---|---|---|
| `CompanyEditView` Save button | `map_startups` UPDATE | Anon Supabase client, gated by new RLS policy in Task 1 |
| `CompanyEditView` mount | `map_startups` SELECT | Anon Supabase client (existing public read policy) |
| `PhotoGallery` mount | `company-photos` edge fn | `supabase.functions.invoke('company-photos', { body: { place_id } })` |
| `company-photos` edge fn | Google Places API | `fetch('https://places.googleapis.com/v1/places/<id>?fields=photos', { headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY } })` |
| `PhotoGallery` Save | `map_startups.photos` | `supabase.from('map_startups').update({ photos }).eq('id', id)` (uses same RLS policy) |
| `CompanyAnalytics` mount | `get_company_view_stats` RPC | `supabase.rpc('get_company_view_stats', { p_startup_id })` (existing from Phase 1) |
| `useClaimAuth.watchEffect` | `company_claims` row | `.eq('claimer_email', email)` — **fix from `'email'`** |
| `claimGuard` | `company_claims` row | `.eq('claimer_email', session.user.email)` — **fix from `'email'`** |

---

## Dependency Graph

```
Task 1 (DB addendum: RLS UPDATE + photos column)         — needs Phase 1 migration
   └─► Task 2 (PhotoGallery + company-photos edge fn)    — needs photos column + edge fn deployed
   └─► Task 3 (CompanyEditView + CompanyAnalytics)       — needs RLS policy (for save) + Task 2 components (to embed)
```

## Execution Sequences

| Sequence | Tasks | Parallel? | Notes |
|---|---|---|---|
| 1 | Task 1 | No | DB migration MUST land first; the executor needs the `photos` column to exist before PhotoGallery can save, and the UPDATE policy before CompanyEditView can save |
| 2 | Task 2 | No | Edge function + PhotoGallery component (server-side key handling lives here) |
| 3 | Task 3 | No | CompanyEditView embeds PhotoGallery (Task 2) and CompanyAnalytics (built in this task); also fixes the Phase 2 column-name bug |

---

## Tasks

### Task 1: Migration addendum — UPDATE RLS on `map_startups` + `photos jsonb` column

**Type:** auto
**Sequence:** 1

<files>
supabase/migrations/0003_claims.sql
</files>

<action>
Append two sections to the EXISTING `supabase/migrations/0003_claims.sql` (do not remove or edit the existing `company_claims` table / `get_company_view_stats` definitions). The file currently ends after the `grant execute on function get_company_view_stats(uuid) to anon, authenticated;` line.

Append:

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 addendum: claimer UPDATE policy on map_startups
-- ─────────────────────────────────────────────────────────────────────────────
-- Allows an authenticated user to update the map_startups row for a startup
-- they have claimed (matched via company_claims.claimer_email = JWT email).
-- This sits alongside the admin UPDATE policy from 0007_admin_map_startups_rls.sql.

drop policy if exists "claimers update own map_startups" on map_startups;
create policy "claimers update own map_startups"
  on map_startups
  for update
  to authenticated
  using (
    exists (
      select 1 from company_claims
      where company_claims.startup_id = map_startups.id
        and company_claims.claimer_email = auth.jwt() ->> 'email'
    )
  )
  with check (
    exists (
      select 1 from company_claims
      where company_claims.startup_id = map_startups.id
        and company_claims.claimer_email = auth.jwt() ->> 'email'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 addendum: photos jsonb column on map_startups
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores the curated, ordered list of photo objects { url, attribution } that
-- the founder has selected/reordered in the PhotoGallery editor.
-- Confirmed missing from 0001_init.sql — safe to add with IF NOT EXISTS.

alter table map_startups
  add column if not exists photos jsonb not null default '[]'::jsonb;
```

Apply the migration via the Supabase MCP `apply_migration` tool (NOT `supabase db push` — the CLI rejects out-of-sequence numbers; this exact pattern was used in Phase 1, see STATE.md "Decisions Log"). Pass the migration **name** as `0003_claims_addendum` (or similar) and the SQL body as just the new SQL above (the MCP tool tracks already-applied statements; running the addendum independently is the cleanest path). If the MCP tool errors because the existing `company_claims` table already exists, that is expected — only the appended SQL needs to run. As a fallback, use the Supabase MCP `execute_sql` tool to run the new SQL directly.

After applying, verify:
- `select policyname from pg_policies where tablename = 'map_startups';` includes `claimers update own map_startups`.
- `select column_name, data_type, column_default from information_schema.columns where table_name = 'map_startups' and column_name = 'photos';` returns one row with `data_type = 'jsonb'` and `column_default = "'[]'::jsonb"`.
</action>

<verify>
1. File `supabase/migrations/0003_claims.sql` contains both new sections (`claimers update own map_startups` policy + `add column if not exists photos`).
2. Supabase MCP `list_migrations` (or equivalent) shows the addendum applied.
3. SQL check via Supabase MCP `execute_sql`: `select 1 from pg_policies where tablename = 'map_startups' and policyname = 'claimers update own map_startups';` returns one row.
4. SQL check: `select column_name from information_schema.columns where table_name = 'map_startups' and column_name = 'photos';` returns `photos`.
5. Functional check (RLS): `set local role authenticated; set local request.jwt.claims to '{"email":"nobody@nowhere.test"}'; update map_startups set description = description where id = '<seeded-id>';` returns `UPDATE 0` (RLS denies).
</verify>

<done>
The `claimers update own map_startups` policy exists on `map_startups`, the `photos jsonb` column exists with default `'[]'`, and a non-claimed authenticated identity cannot update the row.
</done>

---

### Task 2: PhotoGallery component + `company-photos` edge function

**Type:** auto
**Sequence:** 2

<files>
supabase/functions/company-photos/index.js
goed/src/components/company/PhotoGallery.vue
</files>

<action>
**2a. Create `supabase/functions/company-photos/index.js`** following the same skeleton as `supabase/functions/claim-company/index.js`:

- CORS preflight handler at top (allow `GET, POST, OPTIONS`).
- Accept `POST { place_id }` (preferred — matches what `supabase.functions.invoke` sends as JSON body) and also `GET ?place_id=...` for manual curl testing.
- Read `Deno.env.get('GOOGLE_PLACES_API_KEY')`. If missing, return `200 { photos: [] }` immediately — DO NOT throw or 500. Log `console.warn('[company-photos] GOOGLE_PLACES_API_KEY not set; returning empty list')`.
- Call `https://places.googleapis.com/v1/places/<place_id>?fields=photos` with header `X-Goog-Api-Key: <key>`. Parse the JSON response; map each `photo.name` (e.g. `places/ChIJ.../photos/AeR...`) into an absolute media URL of the form `https://places.googleapis.com/v1/<photo.name>/media?maxWidthPx=800&key=<key>` and pull attribution from `photo.authorAttributions?.[0]?.displayName ?? null`.
- Return `200 { photos: [{ url, attribution }] }`. On any fetch failure, return `200 { photos: [] }` and `console.error('[company-photos] fetch failed:', err)` — keep the UI graceful.
- Use the same `jsonResponse` / `errorResponse` helpers from `claim-company/index.js`.
- Add a JSDoc header at the top describing the function and a curl example.

Deploy via Supabase MCP `deploy_edge_function` with `name: 'company-photos'`, `entrypoint_path: 'index.js'`, and `files: [{ name: 'index.js', content: <full file body> }]`.

**2b. Create `goed/src/components/company/PhotoGallery.vue`** — note this is a NEW component subdirectory (`components/company/`); create the directory by writing the file at this path. Use `<script setup>`, no semicolons, Tailwind utility classes, project conventions (`isLoading` / `error` refs).

Component contract:
- Props: `{ company: { type: Object, required: true } }` — must have at least `id` and may have `google_place_id`, `photos` (jsonb array).
- Local refs: `isLoading`, `error`, `photos` (mutable array of `{ url, attribution }`), `isSaving`, `saveSuccess`.
- On mount:
  - Initialize `photos.value = Array.isArray(props.company.photos) ? [...props.company.photos] : []`.
  - If `props.company.google_place_id` is truthy, call `supabase.functions.invoke('company-photos', { body: { place_id: props.company.google_place_id } })`. On success, merge any new photos NOT already present (de-dupe by `url`) into `photos.value`. On error, set `error.value = err.message` but keep the existing curated list.
  - If no `google_place_id` AND `photos.value.length === 0`, render an empty state — "No photos available. Connect a Google Place ID in your listing to import photos automatically." (Don't break — this is the common pre-Places-enrichment case.)
- Render a responsive grid: `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">`. Each photo cell shows the image, an "X" remove button (top-right), and "Move left / Move right" arrow buttons (bottom). Use simple index swap for reorder — no drag-and-drop library required (`function moveLeft(i)` / `function moveRight(i)` swap with neighbor). Removing splices the array in place.
- "Save photos" button at the bottom: `isSaving.value = true; const { error: e } = await supabase.from('map_startups').update({ photos: photos.value }).eq('id', props.company.id); if (e) error.value = e.message; else saveSuccess.value = true; isSaving.value = false`.
- Surface a green toast `<div v-if="saveSuccess" ...>Photos saved.</div>` and a red error banner per project conventions.

Imports:
```js
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
```

File header comment: `// PhotoGallery — fetches Google Places photos via the company-photos edge function and lets the founder curate the order. Consumers: CompanyEditView.vue.`
</action>

<verify>
1. File `supabase/functions/company-photos/index.js` exists; calling `curl -X POST https://<project>.supabase.co/functions/v1/company-photos -H 'Authorization: Bearer <anon-key>' -H 'Content-Type: application/json' -d '{"place_id":"ChIJN1t_tDeuEmsRUsoyG83frY4"}'` returns 200 with a JSON body containing `photos: [...]`.
2. With `GOOGLE_PLACES_API_KEY` unset (or temporarily blanked in MCP), the same curl returns `200 { photos: [] }` — NOT a 500.
3. File `goed/src/components/company/PhotoGallery.vue` exists; `npm --prefix goed run build` succeeds.
4. Manual / Playwright check: mount `<PhotoGallery :company="{ id: '<id>', google_place_id: '<known-place-id>', photos: [] }"/>` in `CompanyEditView` (Task 3) and confirm a grid renders. With `google_place_id: null` confirm the empty-state copy renders instead of an error.
5. Click "X" removes the cell; "Move left/right" reorders it; click "Save photos" persists; refresh the page and the order matches.
</verify>

<done>
The edge function returns photo URLs (or empty list on missing key), and the component renders a curatable grid that saves to `map_startups.photos`.
</done>

---

### Task 3: CompanyEditView (full edit form) + CompanyAnalytics + Phase 2 column-name bug fix

**Type:** auto
**Sequence:** 3

<files>
goed/src/views/CompanyEditView.vue
goed/src/components/map/CompanyAnalytics.vue
goed/src/composables/useClaimAuth.js
goed/src/router/guards.js
</files>

<action>
**3a. Fix the Phase 2 column-name bug** in TWO files. The `company_claims` table column is `claimer_email` (per `0001_init.sql` and `0003_claims.sql`), but Phase 2 accidentally queried `email`. This means `isOwner` is currently always `false` and `claimGuard` always sends users back to ClaimLogin even after they sign in. Without this fix, the entire Phase 3 happy path fails.

In `goed/src/composables/useClaimAuth.js` (around line 36-38), change:

```js
.from('company_claims')
.select('email')
.eq('startup_id', startupId)
.eq('email', email)
```

to:

```js
.from('company_claims')
.select('claimer_email')
.eq('startup_id', startupId)
.eq('claimer_email', email)
```

In `goed/src/router/guards.js` (around line 49-53), change:

```js
.from('company_claims')
.select('email')
.eq('startup_id', to.params.id)
.eq('email', session.user.email)
```

to:

```js
.from('company_claims')
.select('claimer_email')
.eq('startup_id', to.params.id)
.eq('claimer_email', session.user.email)
```

**3b. Create `goed/src/components/map/CompanyAnalytics.vue`** — `<script setup>`, no semicolons:

- Props: `{ startupId: { type: String, required: true } }`.
- Local refs: `isLoading`, `error`, `stats` (defaults to `{ views_this_week: 0, views_total: 0 }`).
- On mount: `const { data, error: rpcError } = await supabase.rpc('get_company_view_stats', { p_startup_id: props.startupId }); if (rpcError) error.value = rpcError; else if (data) stats.value = data;` wrapped in try/finally that toggles `isLoading`.
- Template: a flex/grid row of two cards. Each card uses `bg-utah-blue text-white` (per project tokens — see `goed/tailwind.config.js`), rounded corners, big number on top, label below. Below the cards, a small grey footnote: `<p class="text-xs text-gray-500 mt-2">Live stats coming soon</p>`.

Imports:
```js
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
```

File header comment: `// CompanyAnalytics — two stat cards backed by the get_company_view_stats RPC. Consumers: CompanyEditView.vue.`

**3c. Replace `goed/src/views/CompanyEditView.vue`** entirely (the current file is the Phase 2 stub — only ~30 lines). Pattern after `goed/src/components/admin/CompanyEditor.vue` for form structure but adapted for a route-level view. Editable fields per ROADMAP Phase 3 Task 3.1: `name`, `description`, `sector`, `stage`, `employee_range`, `investors[]` (comma-separated text input), `total_raised`, `website`, `contact_email` (note: `contact_email` is NOT in the current `map_startups` schema — see Notes; for now, render the input but skip it from the saved patch if the column doesn't exist, OR include it and let Postgres ignore unknown columns — the executor should `select column_name from information_schema.columns where table_name = 'map_startups'` first and only include fields that exist).

Use `<script setup>`, no semicolons, Tailwind, project conventions:

```js
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useClaimAuth } from '@/composables/useClaimAuth'
import PhotoGallery from '@/components/company/PhotoGallery.vue'
import CompanyAnalytics from '@/components/map/CompanyAnalytics.vue'
```

Logic outline:
- `id = route.params.id`.
- `const { signOut } = useClaimAuth(id)`.
- `company` ref (null until loaded), `form` reactive object, `isLoading`, `isSaving`, `saveError`, `saveSuccess` refs.
- `onMounted`: fetch via `supabase.from('map_startups').select('*').eq('id', id).maybeSingle()`. On success, set `company.value = data` and `Object.assign(form, data)`. Coerce `form.investors` to a comma-joined string for the input (`Array.isArray(data.investors) ? data.investors.join(', ') : ''`) — same trick as `CompanyEditor.vue`.
- `async function save()`: build a `patch` object with ONLY the editable keys (`name, description, sector, stage, employee_range, investors, total_raised, website, contact_email`). Convert `investors` back to an array (`patch.investors = form.investors.split(',').map(s => s.trim()).filter(Boolean)`). Call `supabase.from('map_startups').update(patch).eq('id', id).select()`. If `error`, set `saveError.value = error.message`. If `data` is empty array (no rows updated → RLS denied), set `saveError.value = 'You do not have permission to edit this listing.'`. Otherwise `saveSuccess.value = true`. Always toggle `isSaving`.
- `async function handleSignOut()`: `await signOut(); router.push({ name: 'Map' })` (preserved from the stub).

Template structure:
- Outer container: `<div class="max-w-3xl mx-auto py-8 px-4 space-y-6">`.
- Header row: page title `Edit your listing` + `Sign out` button (right-aligned, ghost style — same as the stub).
- `<CompanyAnalytics :startup-id="id" />` immediately below the header.
- `<div v-if="isLoading">Loading…</div>` while fetching.
- `<form v-else-if="company" @submit.prevent="save" class="space-y-4 bg-white p-6 rounded-lg shadow">` containing each field in the same `<label> + <input/select>` pattern used by `CompanyEditor.vue`. Use `<select>` for `sector`, `stage`, `employee_range` with the SAME option lists as `CompanyEditor.vue`.
- Save button uses `bg-utah-blue hover:bg-utah-blue-dark` (same as admin editor save).
- Success / error banners use the green / red conventions from `AdminLogin.vue` and `CompanyEditor.vue`.
- `<PhotoGallery :company="company" />` after the form (same outer padding).
- File header comment: `// CompanyEditView — gated by claimGuard; renders the founder-facing inline edit form, photo gallery, and analytics for a single map_startups row. Consumers: router/index.js (CompanyEdit route).`
</action>

<verify>
1. Files exist / modified: `goed/src/views/CompanyEditView.vue` (rewritten, NOT a stub anymore), `goed/src/components/map/CompanyAnalytics.vue` (new), `goed/src/composables/useClaimAuth.js` (column-name fix), `goed/src/router/guards.js` (column-name fix).
2. `npm --prefix goed run build` succeeds.
3. Code review of `useClaimAuth.js` and `guards.js`: no remaining `.eq('email', ...)` or `.select('email')` against `company_claims`. Both queries now use `claimer_email`.
4. Manual / Playwright (with a seeded session whose email is in `company_claims` for `<seeded-id>`):
   - Navigate to `/company/<seeded-id>/edit` — form pre-populates with existing values.
   - Two utah-blue stat cards render at the top with `0` values + the "Live stats coming soon" footnote.
   - Edit the `description` field, click Save — green "Saved" banner appears; refresh the page — new value is shown.
   - PhotoGallery renders below the form (grid for known place_id, empty state otherwise).
5. Negative path (Playwright): with a seeded session whose email is NOT in `company_claims`, calling the same update from the browser console — `supabase.from('map_startups').update({ description: 'hax' }).eq('id', '<seeded-id>').select()` — returns `data: []` (RLS-denied; zero rows affected). The `claimGuard` should also have already redirected, but this is the defense-in-depth check.
</verify>

<done>
A logged-in claimer can fetch, edit, save, and refresh a `map_startups` row from `/company/:id/edit`; analytics cards and photo gallery render alongside; non-claimers are blocked at both the guard and RLS layers; the Phase 2 column-name bug is fixed.
</done>

---

## Verification Checklist

Maps 1:1 to ROADMAP.md Phase 3 verification list:

- [ ] Visiting `/company/<seeded-id>/edit` as an authenticated claimed owner renders the full edit form pre-populated with existing data.
- [ ] Editing the `description` field and clicking Save persists the change to `map_startups`; refreshing the page shows the updated value.
- [ ] `PhotoGallery` renders for a company with a known `google_place_id`; remove and reorder actions update the displayed list before save.
- [ ] `CompanyAnalytics` renders two `0` stat cards and the "Live stats coming soon" footnote.
- [ ] Authenticated user whose email is NOT in `company_claims` for this startup is denied the update — Supabase returns RLS violation / empty affected rows.
- [ ] Playwright: seed a `company_claims` row + Supabase session token; navigate to edit view; fill description; click Save; assert success toast.

Plus implicit phase-3 only checks:

- [x] `company-photos` edge function returns `200 { photos: [] }` (not 500) when `GOOGLE_PLACES_API_KEY` is missing.
- [x] `useClaimAuth.js` and `guards.js` query `claimer_email` (not `email`) on `company_claims`.
- [x] `map_startups.photos` column exists and defaults to `'[]'::jsonb`.
- [x] `claimers update own map_startups` policy is present in `pg_policies`.
<!-- Task 3.2 Completed: 2026-05-09 -->
<!-- Task 3.3 Completed: 2026-05-09 -->

## Success Criteria

A founder whose email is registered in `company_claims` for a given startup can navigate to `/company/:id/edit`, see their listing pre-populated in an inline form alongside two analytics cards and a photo gallery, edit any of the nine listed fields, save changes (gated server-side by RLS — not by the client), curate Google Places photos that the new server-side edge function fetches, and have all changes survive a page refresh. A logged-in user not in `company_claims` cannot reach the page (guard) and cannot update the row even by directly invoking the Supabase client (RLS).

---

## Notes for Executor

1. **`photos` column does NOT exist anywhere yet** — verified by grepping all of `supabase/migrations/`. Task 1's `add column if not exists photos jsonb default '[]'::jsonb` is genuinely additive; not a no-op. The ROADMAP's wording "ONLY IF NOT ALREADY PRESENT" was a guard against duplication — `if not exists` covers it.

2. **`google_place_id` column DOES exist** on `map_startups` (line 37 of `0001_init.sql`). The PhotoGallery key-link is intact.

3. **`CompanyEditView.vue` already exists as a stub** from Phase 2 (Task 2.3). Read the current ~30-line file first; you are REPLACING it, not creating from scratch. The stub's `Sign out` flow and `useClaimAuth(id)` import pattern are good to preserve.

4. **CRITICAL Phase 2 bug fix is part of Task 3.** Phase 2 wrote `.eq('email', ...)` against `company_claims`, but the column is `claimer_email` (see `0003_claims.sql:5`). This means `isOwner` is currently always false in production and the entire claim-guard happy path is broken. Without fixing this, NONE of the Phase 3 verification will pass — the executor will be locked out of the page they just built. The fix is two two-line edits in `useClaimAuth.js` and `guards.js` and is non-negotiable.

5. **Migration application path** — apply via the Supabase MCP `apply_migration` tool, NOT `supabase db push`. The repo has out-of-sequence migration numbers (0003 was filled in after 0007 existed) and the CLI rejects this. Phase 1 already used MCP for the same reason (see `STATE.md` Decisions Log). If `apply_migration` errors because the file already partially applied, fall back to `execute_sql` with just the new SQL appended in Task 1.

6. **`GOOGLE_PLACES_API_KEY` secret** must be set on the Supabase project for `company-photos` to return real photos. Per memory, this is already configured project-side as part of the `0005` (enrichment) work. The edge function MUST still handle the missing-key case gracefully (return `200 { photos: [] }`) so dev environments without the secret don't break the UI. Do NOT throw on missing key.

7. **`contact_email` column may not exist on `map_startups`.** The ROADMAP lists it as an editable field, but `0001_init.sql` does not include it (verified — grep found no `contact_email` in any migration). When implementing the form: either (a) include the input but only put the value into the `update()` patch if the column actually exists (do a one-time `select column_name from information_schema.columns where table_name = 'map_startups' and column_name = 'contact_email'` check via Supabase MCP and decide), OR (b) skip the field for now and add a TODO. **Recommendation: skip `contact_email` from the form for this phase** — the ROADMAP verification doesn't actually test it (it tests `description`), and silently dropping a field from a save patch is worse than not rendering it. Document the omission inline.

8. **Save uses anon client (not admin).** The whole point of Task 1's RLS policy is so the existing anon Supabase client (`@/lib/supabase`) can do the update with the user's session JWT, and Postgres enforces ownership. Do NOT introduce a service-role client into the frontend. Do NOT add a `update-company` edge function. The RLS policy is the entire authorization story.

9. **Don't use `.single()` for the load** — the listing might have been deleted; use `.maybeSingle()` per project convention (CONVENTIONS.md error-handling section).

10. **No new admin nav links.** This view is not surfaced in the top nav — it's only reachable via the deep link sent in the OTP magic-link email. The only entry points are the CTAs Phase 2 already wired in `SubmitResult.vue` and `CompanyDrawer.vue`.

11. **PhotoGallery directory is new.** `goed/src/components/company/` does not exist yet (verified — only `map/`, `drawer/`, `filters/`, `submit/`, `admin/`, `roadmap/` exist). Creating the file at `goed/src/components/company/PhotoGallery.vue` will create the directory; no separate mkdir needed.

12. **Build sanity check** — after each task, run `npm --prefix goed run build` (already used successfully in Phase 2 verification per `STATE.md`). It catches missing imports faster than the dev server.
