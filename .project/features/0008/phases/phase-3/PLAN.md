# Feature 0008 — Phase 3 Plan: Live `CompanyAnalytics` + Digest Backfill

## Objective

Replace the placeholder behavior in `goed/src/components/map/CompanyAnalytics.vue` with a correct, live RPC call that surfaces real `views_this_week` and `views_total` counts inside `CompanyEditView`, and update the `send-digest` Edge Function so its weekly email actually includes a "most-viewed this week" section sourced from the new `company_views` table. After this phase, a founder visiting `/edit/<id>` sees real view counts that update on every refresh, and the weekly digest reports actual map engagement instead of relying solely on hiring/newest fallbacks.

**Purpose:** Close the founder retention loop — give claimed founders a visible, real-time engagement signal — and make the M9 digest engagement-driven, not just inventory-driven.

**Output:**
- A working `CompanyAnalytics.vue` (correct RPC unwrap + skeleton + error states).
- A `CompanyEditView.vue` that renders an intro line above the analytics cards (the import + tag are already present; this phase tightens the surface).
- A `send-digest/index.js` that queries `company_views` for the top-5 most-viewed companies in the past 7 days and threads that data into the prompt.
- Either: an updated `prompts.js` that consumes a new `mostViewed` highlight in `buildEcosystemPrompt`, OR a new optional shape on the personalized prompt — chosen by the executor based on the existing pattern (see Task 3.3).

---

## Pre-flight: Repo State Snapshot (read first)

Before writing code, verify the following — Phases 1 and 2 already shipped artifacts that change task scope:

- `goed/src/components/map/CompanyAnalytics.vue` **already exists** but is buggy:
  - It assigns `stats.value = data` directly. PostgREST `rpc()` against a `returns table (...)` function returns `data` as an **array** (`[{ views_this_week, views_total }]`), not a single row object — current code renders blank cards.
  - It has no skeleton state and no rendered error state.
  - It has a stale `"Live stats coming soon"` caption that must be removed.
- `goed/src/views/CompanyEditView.vue` **already imports and renders** `<CompanyAnalytics :startup-id="id" />` between the header and the loading state. The roadmap's "replace the placeholder body" work is mostly done — the only remaining ask is a brief intro line for context above the cards. The Sign Out button is already wired.
- `supabase/functions/send-digest/index.js` does **not** currently have a "most-viewed this week" section — neither in the personalized branch nor in the ecosystem branch. The roadmap's instruction to "replace the existing fallback for most-viewed this week" is misleading: there is no such fallback today; this phase is **adding** the section. Document this in the executor's commit message and proceed with the additive interpretation.
- `supabase/migrations/0012_view_counts.sql` is applied; `get_company_view_stats(p_startup_id)` returns `views_this_week bigint, views_total bigint`. The RPC is callable from the anon client.
- `company_views` has **no select RLS policy**, which means anon `select` is blocked. The digest function uses the **service-role admin client** (`createAdminClient()`), which bypasses RLS — so direct selects against `company_views` from `send-digest` will work.

Decisions documented inline below (no AskUserQuestion):
- **Where to thread `mostViewed` into the digest prompt:** add it to `buildEcosystemPrompt`'s `highlights` argument. Rationale: the personalized prompt is already dense; the ecosystem branch is the natural home for ecosystem-wide engagement signals. If `mostViewed` is empty (zero rows in past 7 days), omit the section gracefully — no 500.
- **How to query top-5 most-viewed:** pull raw rows with `viewed_at >= now() - 7 days`, aggregate counts in JS by `startup_id`, then `select('id, name, sector, stage')` from `map_startups` for the top 5 ids. Rationale: `count: 'exact'` with `head: true` only returns one number, and PostgREST does not support GROUP BY aggregation directly without a SQL view or RPC. JS aggregation over a single-week slice is cheap and matches the function's existing imperative style.
- **`CompanyAnalytics` skeleton style:** mirror the stat-card geometry (two `bg-gray-200 animate-pulse rounded-lg` blocks) so layout does not jump on transition from skeleton → data. Tailwind's `animate-pulse` is built-in.
- **Error UI:** muted `text-sm text-gray-500` line that says `Couldn't load view stats.` — never throw to the route, never crash the parent view.

---

## Must-haves (Goal-Backward)

Derived from the Phase 3 success criteria in `.project/features/0008/ROADMAP.md` lines 144–149. Each truth must be provable inside this phase.

### Observable Truths

- A claimed founder visiting `/edit/<id>` sees **two live stat cards** populated with real numbers from `get_company_view_stats` (not zeros from a buggy unwrap, not skeletons indefinitely).
- A fresh page refresh after a new drawer open shows an **incremented** `views_this_week` — no memoization, no localStorage cache.
- If the RPC fails (network error, malformed id), the analytics block **degrades to a muted error message** — the rest of the edit view continues to render.
- A manual invocation of `send-digest` (against a database with at least one `company_views` row from the past 7 days) produces a digest payload whose ecosystem-mode prompt **mentions the top-viewed companies** of the past week.
- A manual invocation of `send-digest` against a database with **zero** `company_views` rows in the past 7 days still returns 200 — the empty case is handled, no 500.
- `CompanyAnalytics.vue` renders correctly **in isolation** when given a valid `startupId` prop (no surrounding `CompanyEditView` required).

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `goed/src/components/map/CompanyAnalytics.vue` | Correct RPC unwrap (`data[0]`), skeleton + error UI, two stat cards | default export (component) |
| `goed/src/views/CompanyEditView.vue` | Intro line above analytics cards; existing Sign Out preserved | default export (view) |
| `supabase/functions/send-digest/index.js` | Most-viewed-this-week query against `company_views` joined to `map_startups`; threads result into ecosystem prompt | `Deno.serve(...)` handler |
| `supabase/functions/send-digest/prompts.js` | Updated `buildEcosystemPrompt` signature accepting `mostViewed` highlight; renders gracefully when empty | `buildEcosystemPrompt` (named) |

### Key Links

| From | To | Via |
|------|------|------|
| `CompanyAnalytics.vue` `onMounted` | `get_company_view_stats(uuid)` RPC | `supabase.rpc(..., { p_startup_id })` returning `data[0]` |
| `CompanyEditView.vue` template | `CompanyAnalytics.vue` | `<CompanyAnalytics :startup-id="id" />` (already wired) |
| `send-digest` ecosystem branch | `company_views` table | `adminClient.from('company_views').select('startup_id, viewed_at').gte('viewed_at', sevenDaysAgo)` |
| `send-digest` ecosystem branch | `map_startups` rows for the top-5 ids | `adminClient.from('map_startups').select('id, name, sector, stage').in('id', topIds)` |
| Ecosystem prompt builder | LLM | `buildEcosystemPrompt(subscriber, { hiringCount, newestCompany, totalCompanies, mostViewed })` |

---

## Dependency Graph

```
Task 3.1 (CompanyAnalytics.vue) ──┐
                                  ├── Task 3.2 (CompanyEditView.vue intro line) — depends on 3.1's component shape
Task 3.3 (send-digest) ───────────┘  (independent of 3.1 / 3.2 — separate stack, separate file)
```

- **Task 3.1** creates the corrected component (no upstream deps; reads only `supabase.js` + the live RPC).
- **Task 3.3** updates the Edge Function (no upstream deps; reads only `_shared/supabaseAdmin.js` and the `company_views` table).
- **Task 3.2** depends on 3.1 because it imports the component and the Sign Out button must coexist with the analytics block — only proceed once 3.1's exports and props are settled.

## Execution Sequences

| Sequence | Tasks | Parallel | Why |
|----------|-------|----------|-----|
| 1 | 3.1, 3.3 | Yes | Different stacks (Vue vs Deno Edge), different files, no shared symbols |
| 2 | 3.2 | No (single task) | Depends on 3.1's prop shape `{ startupId: String }` being final |

---

## Tasks

### Task 3.1: Fix `CompanyAnalytics.vue` — correct RPC unwrap, add skeleton + error UI

**Type:** auto
**Sequence:** 1
**Estimated time:** 15–20 min
**Completed:** 2026-05-09

<files>
goed/src/components/map/CompanyAnalytics.vue
</files>

<action>
Rewrite the existing `CompanyAnalytics.vue` so the RPC unwrap is correct and the three UI states (loading, error, ready) are explicit. Keep block order `<script setup>` → `<template>` → `<style scoped>`. Match the existing JS conventions (single quotes, no semicolons, 2-space indent, trailing commas in multiline objects, snake_case from DB preserved in the `stats` ref).

Concrete shape required:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const props = defineProps({
  startupId: { type: String, required: true },
})

const isLoading = ref(true)
const error = ref(null)
const stats = ref({ views_this_week: 0, views_total: 0 })

onMounted(async () => {
  try {
    const { data, error: rpcError } = await supabase.rpc('get_company_view_stats', {
      p_startup_id: props.startupId,
    })
    if (rpcError) {
      error.value = rpcError
      return
    }
    // RPC returns an array of rows; a `returns table (...)` function yields exactly one row
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      stats.value = {
        views_this_week: Number(row.views_this_week ?? 0),
        views_total: Number(row.views_total ?? 0),
      }
    }
  } catch (err) {
    error.value = err
  } finally {
    isLoading.value = false
  }
})
</script>
```

Template requirements:
- Three branches: skeleton (`v-if="isLoading"`), error (`v-else-if="error"`), data (`v-else`).
- Skeleton: two side-by-side blocks matching the data layout — `flex gap-4` outer, `flex-1 h-24 bg-gray-200 animate-pulse rounded-lg` for each card. Keeps layout from jumping.
- Error: muted single line — `<p class="text-sm text-gray-500">Couldn't load view stats.</p>`. Do not surface the raw error object.
- Data: two cards in a `flex gap-4` row. Each card: `flex-1 bg-utah-blue text-white rounded-lg p-4 text-center`. Inner: `<p class="text-3xl font-bold">{{ stats.views_this_week }}</p>` and `<p class="text-sm mt-1 opacity-90">Views this week</p>`. Same shape for the total card.
- Remove the existing stale caption `Live stats coming soon`.
- No raw hex strings — `bg-utah-blue` is the only color token allowed here. The `bg-gray-200` skeleton is a Tailwind built-in (acceptable per existing usage in the repo, e.g. neutral skeletons elsewhere).

Do not introduce new files. Do not add JSDoc inside SFCs (JSDoc is required only on `lib/` and `composables/` exports per CONVENTIONS.md). Do not add a `<style scoped>` rule body — leave the empty block in place to keep block-order compliance.
</action>

<verify>
1. File compiles: `cd goed && npm run dev` boots without Vue compilation errors mentioning `CompanyAnalytics.vue`.
2. Component renders in isolation: temporarily mount it in any view with a valid `startupId` (e.g., browser-navigate to `/edit/<known-claimed-id>`), confirm two `bg-utah-blue` cards appear with non-zero or zero numbers (zero is acceptable if no views yet).
3. RPC unwrap correct: in Vue Devtools, inspect the component's `stats` ref — both fields must be **numbers**, not `undefined`, not an array. With at least one row in `company_views` for that `startup_id`, `views_total` must be `>= 1`.
4. Loading state visible: throttle network to "Slow 3G" in browser devtools and reload `/edit/<id>` — the two skeleton blocks must visibly appear before the cards.
5. Error state visible: temporarily change `p_startup_id` to a malformed string (e.g., `'not-a-uuid'`) in dev, reload — the muted "Couldn't load view stats." line must render and the surrounding edit view must still load. Revert the change before committing.
6. Live (non-memoized): open a drawer for the company in another tab (which fires `track-view`), then refresh `/edit/<id>` — `views_total` must increment by 1.
</verify>

<done>
- `CompanyAnalytics.vue` correctly unwraps the RPC array.
- Three render states (skeleton, error, data) all reachable from realistic dev inputs.
- Numbers in cards match `select count(*) ...` against `company_views` for the same `startup_id`.
- No stale caption text remaining; brand tokens only; SFC block order intact.
</done>

---

### Task 3.2: Add intro line to `CompanyEditView.vue` above the analytics cards

**Type:** auto
**Sequence:** 2
**Estimated time:** ~10 min

<files>
goed/src/views/CompanyEditView.vue
</files>

<action>
The view already imports `CompanyAnalytics` and renders `<CompanyAnalytics :startup-id="id" />`. Add a one-line intro paragraph immediately above the `<CompanyAnalytics />` tag so the founder has context for the numbers, then verify the Sign Out button is unchanged.

Concrete edit (around current line 141):

```vue
<!-- Analytics intro + cards -->
<div class="space-y-2">
  <p class="text-sm text-gray-600">
    How many people have viewed your listing.
  </p>
  <CompanyAnalytics :startup-id="id" />
</div>
```

Constraints:
- Do not modify the existing `onMounted`, `save()`, `geocodeAddress()`, or `handleSignOut()` logic.
- Do not change the `defineProps`, `route.params.id`, or claim auth wiring.
- Do not add a header above the analytics block — the existing `<h1>Edit your listing</h1>` is the page title; a second large heading above the cards would be redundant. Keep this surface tight.
- Preserve all other existing markup verbatim (PhotoGallery, form fields, save banners). The diff for this task should touch only the analytics block.
</action>

<verify>
1. Manual route load: `cd goed && npm run dev`, then navigate to `/edit/<id>` for a claimed company. The page must render in this top-to-bottom order: header row (title + Sign Out) → intro line → two stat cards → loading state / form → photo gallery.
2. Sign Out still works: clicking Sign Out routes to `/` (the Map view) per the existing `handleSignOut` logic — no regression.
3. Layout: the intro line is visually between the header and the cards; no console warnings about unknown elements; Vue Devtools shows `CompanyAnalytics` mounted with `startupId` equal to the URL `id`.
4. No diff outside the analytics block: `git diff goed/src/views/CompanyEditView.vue` shows only the inserted `<div class="space-y-2">…</div>` wrapper.
</verify>

<done>
- Intro line renders between the header and the analytics cards.
- Existing Sign Out, form, and photo gallery surfaces unchanged.
- No new imports, no router changes, no auth changes.
</done>

---

### Task 3.3: Add "most-viewed this week" data path to `send-digest`

**Type:** auto
**Sequence:** 1
**Estimated time:** 20–25 min

<files>
supabase/functions/send-digest/index.js
supabase/functions/send-digest/prompts.js
</files>

<action>
The roadmap says "replace the existing fallback" for most-viewed-this-week, but the executor must verify by reading the current `index.js` first: there is **no** existing most-viewed code path today. Treat this task as **additive** — add the most-viewed query to the ecosystem branch (which is the existing fallback when a subscriber has zero personalized matches) and thread the result through `buildEcosystemPrompt`.

**Step A — `supabase/functions/send-digest/index.js`:** Inside the `mode === 'ecosystem'` else-branch (currently around lines 137–155), after the existing `hiringCount` / `totalCompanies` / `newestCompany` queries, add:

```js
// Most-viewed companies in the past 7 days, top 5
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

let mostViewed = [];
try {
  const { data: viewRows, error: viewsError } = await adminClient
    .from('company_views')
    .select('startup_id')
    .gte('viewed_at', sevenDaysAgo);

  if (viewsError) throw viewsError;

  if (viewRows && viewRows.length > 0) {
    // Aggregate counts in JS (PostgREST cannot GROUP BY without a view/RPC)
    const counts = new Map();
    for (const row of viewRows) {
      counts.set(row.startup_id, (counts.get(row.startup_id) ?? 0) + 1);
    }
    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    if (topIds.length > 0) {
      const { data: topCompanies } = await adminClient
        .from('map_startups')
        .select('id, name, sector, stage')
        .in('id', topIds);

      // Reattach counts in the original sort order
      mostViewed = topIds
        .map((id) => {
          const co = (topCompanies ?? []).find((c) => c.id === id);
          if (!co) return null;
          return { name: co.name, sector: co.sector, stage: co.stage, view_count: counts.get(id) };
        })
        .filter(Boolean);
    }
  }
} catch (mvErr) {
  // Never let most-viewed enrichment break the digest — log and continue with empty array
  console.error('most-viewed query failed', mvErr);
  mostViewed = [];
}

userPrompt = buildEcosystemPrompt(subscriber, { hiringCount, newestCompany, totalCompanies, mostViewed });
```

Replace the existing `userPrompt = buildEcosystemPrompt(...)` line so `mostViewed` is now part of the highlights bag. The personalized branch (line ~134) is **not** modified in this phase.

**Step B — `supabase/functions/send-digest/prompts.js`:** Update `buildEcosystemPrompt` to consume the new `mostViewed` highlight without breaking existing callers:

```js
export function buildEcosystemPrompt(subscriber, highlights) {
  const {
    hiringCount = 0,
    newestCompany = null,
    totalCompanies = 0,
    mostViewed = [],
  } = highlights ?? {};

  // ... existing fc / preferenceSummary / newestCompanyNote logic stays as-is ...

  const mostViewedNote = Array.isArray(mostViewed) && mostViewed.length > 0
    ? `Most-viewed companies on the map this past week (top ${mostViewed.length}):\n${
        mostViewed.map((c, i) =>
          `${i + 1}. ${c.name} — ${c.sector ?? 'N/A'} sector, ${c.stage ?? 'N/A'} stage (${c.view_count} views)`
        ).join('\n')
      }`
    : '';

  return `... existing prompt body ...

- Total companies tracked on Utah Startup Map: ${totalCompanies}
- Companies currently hiring across all of Utah: ${hiringCount}
- ${newestCompanyNote}
${mostViewedNote ? `\n${mostViewedNote}\n` : ''}

Instructions:
- ... existing instructions ...
${mostViewedNote ? '- Reference the most-viewed companies above as a signal of what is catching the ecosystem\'s attention this week.' : ''}

Respond with valid JSON only, shaped exactly as:
{ "subject": "<subject line>", "htmlBody": "<html body content>" }`;
}
```

Constraints:
- Preserve every existing prompt instruction; only insert the new "Most-viewed" line and the conditional reference instruction.
- Empty `mostViewed` must produce a prompt that is **byte-identical or near-identical** to the current ecosystem prompt — guarantees zero regression on the empty-table path.
- Keep all existing semicolons and JSDoc style intact in `prompts.js` (note: `supabase/functions/` uses semicolons, unlike `goed/src/` — do not strip them in the edge function code).
- Use the existing `createAdminClient()` instance (`adminClient`) for the new queries — do not re-instantiate.
- Do not add a Postgres view or RPC for aggregation in this phase — JS aggregation over a 7-day window is sufficient.
- Update the JSDoc on `buildEcosystemPrompt` to document the new `mostViewed` field on the `highlights` parameter.
</action>

<verify>
1. Static check: `node --check supabase/functions/send-digest/index.js && node --check supabase/functions/send-digest/prompts.js` — both pass (the files use Deno-only syntax sparingly; `node --check` validates JS parse).
2. Empty-table path: with `delete from company_views where viewed_at >= now() - interval '7 days'` (or simply on a fresh DB), invoke the deployed function via Supabase MCP `invoke_edge_function` with `{}`. Response must be `{ sent: <n>, errors: 0 }` with HTTP 200 — no 500. The ecosystem prompt sent to the LLM does not contain the "Most-viewed" line (verifiable via `console.log` in dev, or by inspecting `map_digest_runs` if it logs the prompt — otherwise rely on the 200 status as proof).
3. Populated path: after at least 3 distinct `company_views` rows exist in the past 7 days for ≥2 different `startup_id` values, invoke the function again. Response is HTTP 200; the resulting subject/htmlBody (visible in Resend logs or the test recipient's inbox) references at least one company name from the top-viewed set.
4. Adjacency: the personalized branch (when a subscriber has matching updates) still works unchanged — invoke against a subscriber who has matching `map_startups` updates and confirm the prompt path is unaffected (no `mostViewed` references because Step A only modified the ecosystem branch).
5. Failure isolation: temporarily break the `company_views` query (e.g., point at a non-existent table name) — the function must still return 200 with the digest sent (the try/catch swallows the error, logs to `console.error`, and `mostViewed` falls back to empty). Revert before deploying.
</verify>

<done>
- `index.js` ecosystem branch queries `company_views` for top-5 most-viewed in the past 7 days and passes `mostViewed` to `buildEcosystemPrompt`.
- `prompts.js` `buildEcosystemPrompt` accepts the new `mostViewed` field and renders an extra paragraph only when non-empty.
- Empty `company_views` (past 7 days) does not produce a 500 — the function gracefully degrades.
- Errors inside the most-viewed query are caught and logged; they never prevent the digest from sending.
- Personalized branch remains untouched.
- Function deploys cleanly via Supabase MCP `deploy_edge_function` (or CLI fallback) — version increments, no Deno parse errors in the deploy log.
</done>

---

## Verification Checklist

Mapping each Phase 3 success criterion (from `ROADMAP.md` lines 144–149) to the verifying task:

- [ ] **`/edit/<claimed-company-id>` renders `CompanyAnalytics` with two visible stat cards.** → Task 3.1 verify steps 1–3 + Task 3.2 verify step 1.
- [ ] **Stat counts update on a fresh page load after a new drawer open (RPC live, not memoized).** → Task 3.1 verify step 6.
- [ ] **`send-digest` produces a digest payload whose "most-viewed this week" lists top companies from the past 7 days; with empty table, payload still renders successfully (no 500).** → Task 3.3 verify steps 2 and 3.
- [ ] **`CompanyAnalytics.vue` renders in isolation with a valid `startupId`, degrades to error state on RPC failure (no crash).** → Task 3.1 verify steps 2, 4, 5.
- [ ] **Sign Out button preserved in `CompanyEditView`.** → Task 3.2 verify step 2.
- [ ] **No barrel imports introduced; SFC block order intact; brand tokens only; snake_case from DB preserved in component state.** → Task 3.1 + Task 3.2 code review (all three covered by the explicit constraints in `<action>` blocks).
- [ ] **Edge Function failure isolation: most-viewed query failure does not break digest.** → Task 3.3 verify step 5.

## Success Criteria

Phase 3 is complete when:

1. `CompanyAnalytics.vue` correctly unwraps the RPC array, renders accurate numbers, and exposes skeleton + error states.
2. `CompanyEditView.vue` shows an intro line above the analytics cards and the Sign Out button still works.
3. `send-digest` deployed and invokable; ecosystem-mode prompts include a top-5 most-viewed paragraph when `company_views` has rows in the past 7 days, and produce no 500 when the table is empty for that window.
4. All three changes are committed in separate commits (one per task), referenced in `STATE.md` task progress rows.
5. `STATE.md` Phase 3 row flips from `⏳ Pending` to `✅ Complete` after the executor's own end-to-end smoke (Task 3.1 verify step 6 + Task 3.3 verify step 3).
