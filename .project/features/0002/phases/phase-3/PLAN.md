# Feature Plan: Map Foundation — Filter Sidebar & URL Sync

## Objective

Build all 7 filter sub-components and the `FilterSidebar.vue` shell that composes them, wire URL query-param sync (repeated-key format) for shareable filter state, and implement the actual `filteredCompanies` predicate logic in `useStartupsStore` so toggling any filter immediately narrows the visible pins and stats.

**Purpose:** Make the map explorable. Without filters, the map is a static dump of pins; with filters wired and URL-synced, users can drill into the ecosystem (e.g., "FinTech B2B startups hiring in Salt Lake County") and share that view with one URL paste.

**Output:** 8 new Vue components under `goed/src/components/filters/`, modified `goed/src/stores/startups.js` (real filter logic), and modified `goed/src/views/MapView.vue` (sidebar slot).

## Must-Haves (Goal-Backward)

### Observable Truths

- Toggling any filter (sector, stage, employee range, hiring, region, investor, founded year) immediately updates the visible pins on the map AND the numbers in the ecosystem stats bar.
- The URL reflects current filter state in repeated-key format: `?sectors=B2B+Software&sectors=FinTech&isHiring=true`.
- Pasting that URL into a fresh tab restores the same filter state on load.
- "Clear all" button resets every filter to empty/false and removes all query params from the URL.
- Founded year slider min/max bounds match the actual `Math.min` / `Math.max` of `founded_year` in the seeded dataset (NOT hardcoded values like 1990–2025).
- Investor filter options are derived dynamically from `companies.flatMap(c => c.investors ?? [])`, deduped, and sorted alphabetically.
- The pin layer reactively shrinks/grows as filters narrow/widen the result set (because `filteredCompanies` flows through to `UtahMap`).

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `goed/src/components/filters/SectorFilter.vue` | Multi-select checkboxes for sectors | default component |
| `goed/src/components/filters/StageFilter.vue` | Multi-select checkboxes for stages | default component |
| `goed/src/components/filters/EmployeeRangeFilter.vue` | Multi-select checkboxes for employee ranges | default component |
| `goed/src/components/filters/HiringFilter.vue` | Single boolean "Hiring now only" toggle | default component |
| `goed/src/components/filters/RegionFilter.vue` | Multi-select checkboxes for regions | default component |
| `goed/src/components/filters/InvestorFilter.vue` | Multi-select checkboxes for investors (sorted alpha) | default component |
| `goed/src/components/filters/FoundedYearFilter.vue` | Range slider with dynamic min/max bounds | default component |
| `goed/src/components/filters/FilterSidebar.vue` | Collapsible left sidebar shell + URL sync logic + "Clear all" | default component |
| `goed/src/stores/startups.js` (modified) | Real `filteredCompanies` computed applying all 9 filter criteria | `useStartupsStore` |
| `goed/src/views/MapView.vue` (modified) | Renders `<FilterSidebar />` on the left | default component |

### Key Links

| From | To | Via |
|------|----|----|
| Each `*Filter.vue` | `useFiltersStore()` ref | `storeToRefs` two-way bind on checkbox / slider models |
| `FilterSidebar.vue` mount | `useFiltersStore()` refs | parse `route.query` (repeated-key) → hydrate refs |
| `FilterSidebar.vue` watchers | URL | `watch` all 9 refs → `router.push({ query })` with repeated-key serialization |
| `useStartupsStore.filteredCompanies` | `useFiltersStore` | imports + reads all 9 filter refs in computed predicate |
| `UtahMap.vue` (Phase 2) | `filteredCompanies` | already wired — Phase 3 just makes it filter for real |
| `EcosystemStatsBar.vue` (Phase 2) | `filteredCompanies` | already wired — count updates reactively |

## Dependency Graph

```
Task 1 (filter sub-components — 7 files) ─┐
                                          │
Task 2 (filteredCompanies predicate logic in startups.js) ─┐
                                          │                │
                                          ▼                ▼
                       Task 3 (FilterSidebar.vue + URL sync + MapView wire-up)
```

- Task 1 and Task 2 are independent — can be implemented in either order or parallel.
- Task 3 depends on BOTH: it imports the 7 sub-components from Task 1, and its filter changes are observable only because Task 2 made `filteredCompanies` reactive to the filter store.

## Execution Sequences

| Sequence | Tasks | Parallel |
|----------|-------|----------|
| 1 | Task 1, Task 2 | Yes (independent files) |
| 2 | Task 3 | No (depends on 1 and 2) |

## Tasks

### Task 1: Build the 7 filter sub-components

**Type:** auto
**Sequence:** 1
**Status:** Complete
Completed: 2026-05-09

<files>
goed/src/components/filters/SectorFilter.vue
goed/src/components/filters/StageFilter.vue
goed/src/components/filters/EmployeeRangeFilter.vue
goed/src/components/filters/HiringFilter.vue
goed/src/components/filters/RegionFilter.vue
goed/src/components/filters/InvestorFilter.vue
goed/src/components/filters/FoundedYearFilter.vue
</files>

<action>
Create 7 self-contained filter components. Every component follows the same SFC block order: `<script setup>` → `<template>` → `<style scoped>`. Every option list, label, and `disabled` flag is a named `computed()` — no logic in templates.

Shared pattern for all 7:
- Import `storeToRefs` from `pinia`, `computed` from `vue`, `useFiltersStore` from `@/stores/filters`, `useStartupsStore` from `@/stores/startups`.
- Use `storeToRefs` to grab the relevant filter ref(s) so v-model two-way binding stays reactive.
- Use `storeToRefs` to grab `companies` from the startups store for deriving option lists.
- Each component renders a small section header (e.g., "Sector") and its inputs.
- Use Tailwind utility classes only (e.g., `text-sm font-medium text-gray-700`, `space-y-2`, `rounded`, `border-gray-300`, `text-utah-blue focus:ring-utah-blue`). No raw hex.

Per-component specifics:

1. **SectorFilter.vue** — Multi-select checkboxes.
   - `sectorOptions` computed: `[...new Set(companies.value.map(c => c.sector).filter(Boolean))].sort()`.
   - Each checkbox: `v-model="sectors"` with `:value="option"` (Vue native checkbox-array binding).
   - Bound store ref: `sectors`.

2. **StageFilter.vue** — Same shape as SectorFilter but `stageOptions` from `c.stage`, bound to `stages`.

3. **EmployeeRangeFilter.vue** — Same shape; `employeeRangeOptions` from `c.employee_range`, bound to `employeeRanges`. Sort options by their numeric lower bound where possible (e.g., parse leading integer of "1-10", "11-50"); if parsing fails for any option, fall back to lexical sort.

4. **HiringFilter.vue** — Single checkbox bound to `isHiring` (boolean ref). Label: "Hiring now only".

5. **RegionFilter.vue** — Same shape as SectorFilter; `regionOptions` from `c.region`, bound to `regions`.

6. **InvestorFilter.vue** — Multi-select checkboxes.
   - `investorOptions` computed: `[...new Set(companies.value.flatMap(c => c.investors ?? []))].sort()`.
   - Bound to `investors`.
   - If list is long (>15), wrap the checkbox list in a `max-h-64 overflow-y-auto` scroll container.

7. **FoundedYearFilter.vue** — Range slider.
   - `yearBounds` computed: `{ min: Math.min(...years), max: Math.max(...years) }` where `years = companies.value.map(c => c.founded_year).filter(Number.isFinite)`. If the array is empty (companies not loaded yet), default to `{ min: 2000, max: 2025 }` so the slider still renders.
   - Bound to `foundedYearRange` (a 2-element array `[min, max]`).
   - Render two native `<input type="range">` inputs (one for low end, one for high end) with `:min="yearBounds.min"` and `:max="yearBounds.max"`. Wire `@input` handlers (or v-model with computed get/set) to update `foundedYearRange[0]` and `[1]` respectively. Display the current selected range as text below the sliders (e.g., "2014 — 2024").
   - Computed `lowValue` / `highValue` getter+setter pattern is fine if you prefer that to direct event handlers — pick one.

All components: 2-space indent, single quotes, no semicolons, trailing commas. No `console.log`. No barrel index file.
</action>

<verify>
1. All 7 files exist at the listed paths and each has the SFC block order `<script setup>` → `<template>` → `<style scoped>`.
2. From `goed/`, run `npm run build` — Vite compiles cleanly with no errors or warnings about the 7 new files.
3. Grep check: `grep -rn "console.log" goed/src/components/filters/` returns nothing.
4. Grep check: `grep -rnE "#[0-9a-fA-F]{3,6}" goed/src/components/filters/` returns nothing (no raw hex colors).
5. Manual eyeball: open each file, confirm options are derived via `computed()` from the startups store (not hardcoded), and `FoundedYearFilter.vue` uses `Math.min`/`Math.max` over real data (not literal years).
</verify>

<done>
- 7 filter component files exist and compile.
- Each binds the correct filter-store ref via `storeToRefs`.
- Sector / Stage / EmployeeRange / Region / Investor option lists are computed from `useStartupsStore().companies`.
- Investor options are sorted alphabetically.
- Founded-year slider min/max are derived from actual data, not hardcoded.
- No `console.log`, no raw hex, no barrel files.
</done>

---

### Task 2: Implement `filteredCompanies` predicate in `startups.js`

**Type:** auto
**Sequence:** 1
Completed: 2026-05-09

<files>
goed/src/stores/startups.js
</files>

<action>
Replace the placeholder `filteredCompanies` computed (currently returns all companies) with a real predicate that applies all 9 filter criteria from `useFiltersStore`.

In `goed/src/stores/startups.js`:
1. Import `useFiltersStore` from `@/stores/filters` at the top of the file.
2. Inside the store setup function, instantiate the filters store: `const filters = useFiltersStore()`.
3. Rewrite `filteredCompanies` as a single `computed` that returns `companies.value.filter(c => /* 9 predicates */)`. Each criterion follows the "empty array means no filter" pattern:

   1. `sectors`: `filters.sectors.length === 0 || filters.sectors.includes(c.sector)`
   2. `stages`: `filters.stages.length === 0 || filters.stages.includes(c.stage)`
   3. `employeeRanges`: `filters.employeeRanges.length === 0 || filters.employeeRanges.includes(c.employee_range)`
   4. `isHiring`: `!filters.isHiring || c.is_hiring === true`
   5. `foundedYearRange`: `c.founded_year >= filters.foundedYearRange[0] && c.founded_year <= filters.foundedYearRange[1]` — but only if `c.founded_year` is a finite number; if the company is missing `founded_year`, treat it as passing the year filter (don't drop it on missing data).
   6. `fundingStages`: `filters.fundingStages.length === 0 || filters.fundingStages.includes(c.funding_stage)`
   7. `businessTypes`: `filters.businessTypes.length === 0 || filters.businessTypes.includes(c.business_type)`
   8. `regions`: `filters.regions.length === 0 || filters.regions.includes(c.region)`
   9. `investors`: `filters.investors.length === 0 || filters.investors.some(i => (c.investors ?? []).includes(i))` — OR semantics (company matches if it has at least one selected investor).

Combine all 9 with `&&`. Keep each predicate readable — extract to a small helper inside the computed if it improves clarity, but don't over-engineer.

Note on store-to-store dependency: calling `useFiltersStore()` inside `useStartupsStore()`'s setup function is a normal Pinia pattern. Pinia handles the dependency graph; this is not a circular import as long as `filters.js` does not import from `startups.js`.

Preserve all existing exports from the store (`companies`, `isLoading`, `error`, `fetchAll`, `selectedCompany`, `selectCompany`, `clearSelection`, `filteredCompanies`).

2-space indent, single quotes, no semicolons, trailing commas. No `console.log`.
</action>

<verify>
1. File `goed/src/stores/startups.js` imports `useFiltersStore` from `@/stores/filters`.
2. `filteredCompanies` computed contains all 9 named criteria (grep for `sectors`, `stages`, `employeeRanges`, `isHiring`, `foundedYearRange`, `fundingStages`, `businessTypes`, `regions`, `investors` inside the file).
3. `npm run build` from `goed/` succeeds with no errors.
4. From `goed/`, run `npm run dev`, open the browser, and in DevTools console temporarily evaluate `useStartupsStore().filteredCompanies.length` then mutate `useFiltersStore().isHiring = true` — count drops to companies where `is_hiring === true`. Setting it back to `false` restores full count.
5. No `console.log` left in the file.
</verify>

<done>
- All 9 filter criteria applied in `filteredCompanies`.
- "Empty array = no filter" pattern is consistent across the array-typed filters.
- `isHiring=false` does NOT filter; only `isHiring=true` narrows.
- Companies with missing `founded_year` are not dropped by the year filter.
- Existing store API (other exports) is unchanged.
</done>

---

### Task 3: Build `FilterSidebar.vue` shell, wire URL sync, mount in `MapView`

**Type:** auto
**Sequence:** 2
**Status:** Complete
Completed: 2026-05-09

<files>
goed/src/components/filters/FilterSidebar.vue
goed/src/views/MapView.vue
</files>

<action>
**Part A — Create `FilterSidebar.vue`:**

Imports:
- `ref`, `computed`, `watch` from `vue`
- `onMounted` from `vue`
- `storeToRefs` from `pinia`
- `useRoute`, `useRouter` from `vue-router`
- `useFiltersStore` from `@/stores/filters`
- All 7 filter components from `@/components/filters/*` (direct imports, no barrel)

State:
- `isCollapsed` ref (boolean, default `false`) for the collapse toggle.

Composable calls:
- `const route = useRoute()`, `const router = useRouter()`
- `const filtersStore = useFiltersStore()`
- `const { sectors, stages, employeeRanges, isHiring, foundedYearRange, fundingStages, businessTypes, regions, investors } = storeToRefs(filtersStore)`

Template structure:
- Outer `<aside>` with Tailwind: width transition based on `isCollapsed`. Use a `sidebarClass` computed to choose between e.g. `'w-80'` (open) and `'w-12'` (collapsed). White background, right border, vertical scroll if content overflows.
- Header row: title "Filters", a collapse/expand button (`@click="isCollapsed = !isCollapsed"`) and a "Clear all" button.
- Body: when not collapsed, render all 7 filter components in a vertical stack with separators (`divide-y` or explicit border classes).
- All conditional class strings, button labels, and visibility flags are named `computed()`.

"Clear all" handler:
- `function handleClearAll() { filtersStore.clearAll() }` — the store action already exists from Feature 0001.

URL sync — repeated-key format. Two helpers inside `<script setup>`:

```js
// Build a query object from current filter refs.
// Repeated keys: arrays serialize as multiple ?key=v1&key=v2 by passing an array as the value.
function buildQueryFromFilters() {
  const q = {}
  if (sectors.value.length) q.sectors = [...sectors.value]
  if (stages.value.length) q.stages = [...stages.value]
  if (employeeRanges.value.length) q.employeeRanges = [...employeeRanges.value]
  if (isHiring.value) q.isHiring = 'true'
  if (fundingStages.value.length) q.fundingStages = [...fundingStages.value]
  if (businessTypes.value.length) q.businessTypes = [...businessTypes.value]
  if (regions.value.length) q.regions = [...regions.value]
  if (investors.value.length) q.investors = [...investors.value]
  // Only include foundedYearRange if it differs from the current dataset bounds — otherwise omit so URLs stay short.
  // For Phase 3 simplicity: always include if the user has touched it. We track this via a 'touched' ref OR
  // include unconditionally as [min, max]. Use the simpler unconditional approach:
  q.foundedYearMin = String(foundedYearRange.value[0])
  q.foundedYearMax = String(foundedYearRange.value[1])
  return q
}

// Hydrate filter refs from route.query on mount.
// vue-router exposes repeated keys as arrays: ?sectors=A&sectors=B → route.query.sectors === ['A', 'B'].
// A single key (?sectors=A) comes through as a string. Normalize to array.
function toArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function hydrateFromQuery() {
  const q = route.query
  sectors.value = toArray(q.sectors)
  stages.value = toArray(q.stages)
  employeeRanges.value = toArray(q.employeeRanges)
  isHiring.value = q.isHiring === 'true'
  fundingStages.value = toArray(q.fundingStages)
  businessTypes.value = toArray(q.businessTypes)
  regions.value = toArray(q.regions)
  investors.value = toArray(q.investors)
  const min = Number(q.foundedYearMin)
  const max = Number(q.foundedYearMax)
  if (Number.isFinite(min) && Number.isFinite(max)) {
    foundedYearRange.value = [min, max]
  }
}
```

Lifecycle:
- `onMounted(() => { hydrateFromQuery() })`

Watcher (after `onMounted` runs to avoid pushing on the initial hydration):
- Use a single `watch` over an array of all 9 sources, with `{ deep: true }`, that calls `router.push({ query: buildQueryFromFilters() }).catch(() => {})`. Guard against pushing when the new query equals the current one (compare via `JSON.stringify` of the two query objects) to avoid `NavigationDuplicated` warnings.

Per the conventions: no logic in template. `sidebarClass`, `toggleLabel` (e.g., "Collapse" / "Expand"), and `bodyVisible` (`!isCollapsed`) are computed.

Tailwind tokens only — use `bg-white`, `border-gray-200`, `text-utah-blue`, `hover:bg-gray-50`. No raw hex.

**Part B — Update `goed/src/views/MapView.vue`:**

- Import `FilterSidebar` from `@/components/filters/FilterSidebar.vue`.
- Restructure the layout to a horizontal flex row: `<FilterSidebar />` on the left, then the existing map area (`<UtahMap />`, `<EcosystemStatsBar />`, `<CompanyDrawer />`) filling the remaining space (`flex-1`).
- Do not change existing component imports or props beyond adding the sidebar.
- Keep the SFC block order and convention rules.

2-space indent, single quotes, no semicolons, trailing commas. No `console.log`.
</action>

<verify>
1. Files exist: `goed/src/components/filters/FilterSidebar.vue` and updated `goed/src/views/MapView.vue`.
2. `npm run build` from `goed/` compiles with zero errors.
3. `npm run dev`, open `http://localhost:5173/` (or whichever port Vite reports). The left sidebar renders with all 7 filter sections visible.
4. **Pin reactivity:** Toggle "Hiring now only". Visible pins drop to only hiring companies AND the count in `EcosystemStatsBar` updates simultaneously. Untoggle restores all pins.
5. **Sector filter:** Check one or two sectors. Pins narrow to those sectors. Stats bar updates.
6. **URL sync:** After applying filters (e.g., one sector + hiring), the browser address bar shows `?sectors=<value>&isHiring=true&foundedYearMin=...&foundedYearMax=...`. Multiple sectors produce `?sectors=A&sectors=B` (repeated keys, NOT comma-joined or JSON-encoded).
7. **Restore from URL:** Copy the URL with active filters, paste into a new tab. The sidebar checkboxes load already-checked, and the map shows the correct filtered subset on first paint.
8. **Clear all:** Click "Clear all". Every checkbox unchecks, hiring toggle goes off, founded-year resets to dataset bounds, and the URL drops back to a clean path (or the founded-year params alone, if you went with the unconditional-include approach — that's acceptable).
9. **Founded-year bounds:** With no filters, the slider's min and max equal the actual `Math.min`/`Math.max` of `founded_year` across loaded companies. Verify in DevTools by comparing the slider's `min`/`max` attributes against the dataset.
10. **Investor sort:** The investor checkbox list is alphabetically sorted (visual scan).
11. No `console.log` anywhere in the new code.
</verify>

<done>
- `FilterSidebar.vue` renders all 7 filters in a collapsible left shell with a "Clear all" button.
- URL sync round-trip works: filter → URL → fresh tab reproduces filter state.
- Repeated-key serialization confirmed (`?sectors=A&sectors=B`, not comma-joined).
- "Clear all" empties every filter and clears related query params.
- `MapView.vue` shows the sidebar on the left, map fills remaining width.
- Pins and stats reactively update on every filter change because `filteredCompanies` (Task 2) responds to the filter store.
</done>

---

## Verification Checklist

- [x] All 7 filter component files exist under `goed/src/components/filters/` and compile.
- [x] `FilterSidebar.vue` exists, composes all 7 components, has collapse and Clear-all buttons.
- [ ] `useStartupsStore().filteredCompanies` applies all 9 filter criteria.
- [ ] Toggling any filter narrows pins on the map AND updates ecosystem stats numbers.
- [ ] URL reflects filter state in repeated-key format (`?sectors=A&sectors=B&isHiring=true&...`).
- [ ] Pasting a filtered URL into a new tab restores the same filter state on load (sidebar + map).
- [ ] "Clear all" resets every filter and removes filter query params from the URL.
- [ ] Founded-year slider min/max are computed from `Math.min`/`Math.max` of `founded_year` (not hardcoded).
- [ ] Investor options are deduped via `Set` and sorted alphabetically.
- [ ] No `console.log` in any modified file (`grep -rn "console.log" goed/src/components/filters/ goed/src/stores/startups.js goed/src/views/MapView.vue` returns empty).
- [ ] No raw hex colors in any new file (`grep -rnE "#[0-9a-fA-F]{3,6}" goed/src/components/filters/` returns empty).
- [ ] No barrel/index.js created in `goed/src/components/filters/`.
- [ ] All new files use 2-space indent, single quotes, no semicolons, trailing commas.
- [ ] SFC block order in every new component: `<script setup>` → `<template>` → `<style scoped>`.
- [ ] `npm run build` from `goed/` completes with zero errors.

## Success Criteria

Phase 3 is complete when:
1. The map at `/` (or `/map`) renders with a left filter sidebar.
2. Every filter type (7 UI controls covering 9 store fields — note `fundingStages` and `businessTypes` are in the store but not yet exposed as dedicated UI controls per the roadmap; their predicates still run, harmlessly idle when their refs are empty) reactively narrows pins and stats.
3. The URL is a shareable, restorable representation of filter state in repeated-key form.
4. "Clear all" empties everything in one click.
5. The build is clean and no convention violations remain.
