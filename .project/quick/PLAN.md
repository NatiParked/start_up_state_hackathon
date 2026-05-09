# Quick Plan: Hide & Soft-Delete for `map_startups`

## Context

Add an admin-controlled visibility (`is_hidden`) flag and soft-delete (`deleted_at`) capability to the `map_startups` table, with corresponding RLS hardening and admin UI controls.

**Key findings from research:**
- Table `map_startups` is defined in `supabase/migrations/0001_init.sql` with public SELECT policy `map_startups_public_select` using `USING (true)` (lines 98-102). This needs tightening.
- Admin RLS policies exist in `supabase/migrations/0007_admin_map_startups_rls.sql` for UPDATE and INSERT, gated by membership in `map_admin_users` (created in `0006_admin_users.sql`). No admin SELECT or DELETE policy exists yet — admins currently rely on the broad public SELECT to read rows, which will break once it is tightened.
- Migration filenames follow `NNNN_snake_case.sql`. Next available slot is **`0010`** (0009 is taken by subscriptions; 0008 is skipped).
- Admin UI: `goed/src/views/admin/CompanyList.vue` (table of companies, opens slide-in editor) and `goed/src/components/admin/CompanyEditor.vue` (form with `verified` and `is_hiring` checkboxes already as templates to follow).
- `CompanyEditor.vue` already destructures `id, created_at, updated_at, last_refreshed_at` out of the update payload (line 21) — `deleted_at` should be added to that exclusion list to avoid clobbering it on save.
- `goed/src/stores/startups.js` `fetchAll()` does `select('*')` — RLS will transparently filter hidden/deleted rows from the public site; **no store changes are required for the public map**. The admin list, however, must bypass that filter so admins can see and manage hidden/deleted rows.
- Project conventions: JS-only, 2-space indent, single quotes, no semicolons in `goed/src/`, Tailwind utility classes only with brand tokens (`utah-blue`, `error-red`, etc.), Vue 3 `<script setup>`, all `map_*` table prefix.

## Tasks

### Task 1: [x] Create migration `0010_map_startups_hide_softdelete.sql`

<files>
supabase/migrations/0010_map_startups_hide_softdelete.sql
</files>

<action>
Create a new idempotent SQL migration that:
1. Adds two columns to `map_startups`: `is_hidden boolean NOT NULL DEFAULT false` and `deleted_at timestamptz` (nullable). Use `ADD COLUMN IF NOT EXISTS`.
2. Replaces (DROP IF EXISTS + CREATE) the existing public SELECT policy `map_startups_public_select` so it filters out hidden/deleted rows: `USING (is_hidden = false AND deleted_at IS NULL)`. Keep grantees `anon, authenticated`.
3. Adds a new admin SELECT policy `admins select map_startups` granting full read (no `is_hidden`/`deleted_at` filter) to authenticated users whose email is in `map_admin_users` — mirror the auth check pattern from `0007_admin_map_startups_rls.sql` (`auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users)`). Use `DROP POLICY IF EXISTS` first for idempotency.
4. (Optional, recommended) Add a partial B-tree index on `deleted_at` where `deleted_at IS NULL` to keep public-facing queries fast: `CREATE INDEX IF NOT EXISTS map_startups_active_idx ON map_startups (id) WHERE is_hidden = false AND deleted_at IS NULL;` — only include if it does not bloat the migration; otherwise skip.

Follow the file-header conventions used by `0006_admin_users.sql` and `0007_admin_map_startups_rls.sql` (purpose comment, manual-apply note, idempotency note, ASCII section dividers).
</action>

<verify>
Run from repo root:
```
grep -n "is_hidden\|deleted_at\|admins select map_startups\|map_startups_public_select" supabase/migrations/0010_map_startups_hide_softdelete.sql
```
Expect to see the two new columns added, the public SELECT policy redefined with the hidden/deleted filter, and the new admin SELECT policy.
</verify>

<done>
- File `supabase/migrations/0010_map_startups_hide_softdelete.sql` exists.
- Adds `is_hidden boolean NOT NULL DEFAULT false` and `deleted_at timestamptz` to `map_startups` (idempotent via `IF NOT EXISTS`).
- Tightens `map_startups_public_select` to `USING (is_hidden = false AND deleted_at IS NULL)`.
- Creates an admin-only SELECT policy gated by `map_admin_users` allow-list.
- Migration is idempotent (safe to re-run).
- Migration must still be applied manually by the user (`supabase db push` or SQL editor) — do **not** auto-apply.
</done>

Completed: 2026-05-09

### Task 2: [x] Add `is_hidden` checkbox to `CompanyEditor.vue`

<files>
goed/src/components/admin/CompanyEditor.vue
</files>

<action>
Add an `is_hidden` checkbox field to the editor form, modeled exactly on the existing `is_hiring` (lines 254-262) and `verified` (lines 350-358) checkboxes — same Tailwind classes, same `<label>` pattern, label text "Hidden from public map". Place it next to (immediately after) the `verified` checkbox so all boolean visibility flags are grouped.

Also update the destructure on line 21 (`const { id, created_at, updated_at, last_refreshed_at, ...payload } = form`) to also strip `deleted_at` from the payload, so editing a row never accidentally writes/clears the soft-delete timestamp via this form.

Do not touch unrelated form fields. Follow project conventions: `<script setup>`, 2-space indent, single quotes, no semicolons, Tailwind brand tokens only.
</action>

<verify>
Run from repo root:
```
grep -n "is_hidden\|deleted_at" goed/src/components/admin/CompanyEditor.vue
```
Expect: an `id="is_hidden"` checkbox bound to `form.is_hidden`, a "Hidden from public map" label, and `deleted_at` listed in the destructure exclusion on the save handler.
</verify>

<done>
- A working `is_hidden` checkbox is rendered in the editor form, visually consistent with `verified` and `is_hiring`.
- `form.is_hidden` is included in the UPDATE payload sent to Supabase.
- `deleted_at` is excluded from the UPDATE payload (so the editor cannot accidentally overwrite a soft-delete timestamp).
- No other form fields are altered.
</done>

Completed: 2026-05-09

### Task 3: [x] Add Hide/Show + Soft-Delete controls to `CompanyList.vue`

<files>
goed/src/views/admin/CompanyList.vue
</files>

<action>
Extend the admin company list with row-level visibility controls:

1. **Add an "Actions" column** as the rightmost `<th>` and `<td>` in the table. Update the empty-state row's `colspan` from 4 to 5.
2. In each row's Actions cell, render two buttons (do **not** trigger row-click — call `@click.stop` on each):
   - **Hide / Show toggle** — label flips based on `c.is_hidden`. On click, call a new `toggleHidden(c)` action that runs `supabase.from('map_startups').update({ is_hidden: !c.is_hidden }).eq('id', c.id)` and on success refreshes the list via `store.fetchAll()`.
   - **Delete (soft)** — on click, prompt with `window.confirm('Soft-delete this company? It will be hidden from the public map but recoverable.')`. If confirmed, run `supabase.from('map_startups').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)` and refresh via `store.fetchAll()`. Style with `text-error-red` (or equivalent destructive-action Tailwind brand token) so it reads as destructive.
3. **Add a status indicator** in the Name cell: when `c.is_hidden` is true, append a small "Hidden" pill (gray badge); when `c.deleted_at` is not null, append a small "Deleted" pill (red/error badge). Use Tailwind utility classes consistent with the existing `bg-utah-blue` count badge in the page header (line 62).
4. **Show error feedback** if either action's Supabase call returns an error — add a transient `actionError` ref displayed near the search input area, mirroring the `saveError` pattern in `CompanyEditor.vue` (lines 361-363).
5. Import `supabase` from `@/lib/supabase` at the top of the `<script setup>` block.

**Note on visibility of hidden/deleted rows in this admin view:** The new admin SELECT RLS policy from Task 1 grants admins full read access regardless of `is_hidden` / `deleted_at`. The store's existing `fetchAll()` (`select('*')`) will therefore return them automatically — no store changes needed.

Follow project conventions throughout: `<script setup>`, 2-space indent, single quotes, no semicolons, Tailwind brand tokens, event handlers prefixed with `handle`/`on`/verb, error-handling pattern (`try`/`catch`/`finally` with reactive error ref).
</action>

<verify>
1. From the repo root, grep for the new logic:
```
grep -n "toggleHidden\|deleted_at\|Hidden from public\|window.confirm" goed/src/views/admin/CompanyList.vue
```
Expect to see the toggle handler, soft-delete handler with confirm prompt, and references to the new columns.

2. Visually verify (manual): start the dev server (`cd goed && npm run dev`), sign in as an allow-listed admin (`cayden@sempurnadev.com`), navigate to `/admin/companies`, and confirm the new Actions column with Hide/Show and Delete buttons appears, plus "Hidden"/"Deleted" pills on the relevant rows.
</verify>

<done>
- Admin Companies table displays a new "Actions" column with working Hide/Show and Soft-Delete buttons per row.
- Clicking Hide flips `is_hidden` in `map_startups`; clicking Show flips it back.
- Clicking Delete (after confirm) sets `deleted_at` to `now()` on the row.
- After a successful action, the list re-fetches and the row's status pill ("Hidden" / "Deleted") reflects the new state.
- Action buttons do not trigger the row's existing `openEditor` click (event propagation is stopped).
- Errors from Supabase surface in a visible message; success path is silent.
- Public map (`/`) no longer shows hidden or soft-deleted companies after the migration is applied (RLS-driven; no client code change).
</done>

Completed: 2026-05-09
