# Feature Plan: Map Foundation — Phase 2: Company Drawer

## Objective

Build a GSAP-animated right-side drawer (`CompanyDrawer.vue`) that slides in/out when a startup pin is selected, displaying the full company profile (logo, name, sector, stage, hiring badge, jobs preview, links, investors, total raised, region), and wire it into `MapView.vue` with click-outside dismissal.

**Purpose:** Give users a focused, animated view of a single company without leaving the map context.
**Output:** `goed/src/components/drawer/CompanyDrawer.vue` (new) and modifications to `goed/src/views/MapView.vue`.

## Must-Haves (Goal-Backward)

### Observable Truths

- Clicking a pin slides the drawer in from the right with a visible smooth GSAP animation (~350ms, `power2.out`).
- The drawer renders the full company profile: logo (or monogram fallback), name, sector pill, stage pill, conditional hiring badge, description, jobs preview with `+N more` overflow when >3 titles, website + LinkedIn icon links (only when URL exists), investor pills + `total_raised` badge (only when investors present), region label.
- The X button slides the drawer out and clears `selectedCompany`.
- Clicking the map background (outside the drawer) slides the drawer out and clears `selectedCompany`.
- Selecting a different pin while the drawer is open swaps content seamlessly (the open animation re-runs or the drawer remains open with new content visible).
- Every visibility flag, derived string, formatted value, and filtered array in the template is sourced from a named `computed()` — no inline ternaries, `&&`, arithmetic, or method calls in the template.

### Required Artifacts

| Path                                                | Provides                                                  | Key Exports        |
| --------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| `goed/src/components/drawer/CompanyDrawer.vue`      | Right-side animated drawer SFC                            | default (Vue SFC)  |
| `goed/src/views/MapView.vue` (modified)             | Renders `<CompanyDrawer />` above map; wires outside-click | default (Vue SFC)  |

### Key Links

| From                  | To                                  | Via                                                           |
| --------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `CompanyDrawer.vue`   | `useStartupsStore`                  | `storeToRefs(store).selectedCompany` + `store.clearSelection` |
| `CompanyDrawer.vue`   | `useLogoDev` composable             | `getLogoUrl(company.website)`                                 |
| `CompanyDrawer.vue`   | GSAP                                | `gsap.to(rootEl, { x: 0|'100%', duration: 0.35 })` in watcher |
| `MapView.vue`         | `useStartupsStore.clearSelection()` | Map background click handler                                  |
| `MapView.vue`         | `<CompanyDrawer />`                 | Z-stacked above `<UtahMap />`                                 |

## Dependency Graph

```
Task 1 (CompanyDrawer.vue) needs: nothing new (Phase 1 store + composable already exist)
                                  creates: goed/src/components/drawer/CompanyDrawer.vue

Task 2 (MapView wiring)     needs: Task 1
                                  creates: modified goed/src/views/MapView.vue
```

## Execution Sequences

| Sequence | Tasks  | Parallel |
| -------- | ------ | -------- |
| 1        | Task 1 | —        |
| 2        | Task 2 | —        |

## Tasks

### Task 1: Create `CompanyDrawer.vue` with all computed-driven sections and GSAP animation

**Type:** auto
**Sequence:** 1

<files>
goed/src/components/drawer/CompanyDrawer.vue
</files>

<action>
Create the SFC at `goed/src/components/drawer/CompanyDrawer.vue` following the locked SFC block order: `<script setup>` → `<template>` → `<style scoped>`.

**Script section** (in this internal order: imports → composables → ref → computed → methods → watch → lifecycle):

1. Imports: `ref`, `computed`, `watch`, `onMounted` from `vue`; `storeToRefs` from `pinia`; `gsap` from `gsap`; `useStartupsStore` from `@/stores/startups`; `getLogoUrl` from `@/composables/useLogoDev`.
2. Composable calls: instantiate the store, destructure `selectedCompany` via `storeToRefs`, grab `clearSelection` action from the store directly.
3. `ref()`: a single template ref `drawerEl` for the root element (used by GSAP).
4. `computed()` declarations — every display value goes here (no logic in template):
   - `isOpen` → `selectedCompany.value !== null`
   - `company` → `selectedCompany.value` (alias; safe-access all fields with optional chaining + nullish coalescing)
   - `logoUrl` → `company.value?.website ? getLogoUrl(company.value.website) : null`
   - `monogram` → first letter of `company.value?.name` uppercased, or empty string
   - `showMonogram` → `!logoUrl.value && Boolean(company.value?.name)`
   - `showLogo` → `Boolean(logoUrl.value)`
   - `sectorLabel` → `company.value?.sector ?? ''`
   - `stageLabel` → `company.value?.stage ?? ''`
   - `regionLabel` → `company.value?.region ?? 'Utah'`
   - `descriptionText` → `company.value?.description ?? ''`
   - `showHiringBadge` → `company.value?.is_hiring === true`
   - `jobTitlesPreview` → `(company.value?.job_titles ?? []).slice(0, 3)`
   - `extraJobsCount` → `Math.max(0, (company.value?.job_titles?.length ?? 0) - 3)`
   - `showExtraJobs` → `extraJobsCount.value > 0`
   - `showJobsSection` → `showHiringBadge.value && (company.value?.job_titles?.length ?? 0) > 0`
   - `investorsList` → `company.value?.investors ?? []`
   - `showInvestorsSection` → `investorsList.value.length > 0`
   - `formattedTotalRaised` → if `company.value?.total_raised` is a number, format via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(...)`, else empty string
   - `showTotalRaised` → `Boolean(company.value?.total_raised)`
   - `websiteHref` → `company.value?.website ?? null`
   - `linkedinHref` → `company.value?.linkedin ?? null`
   - `showWebsite` → `Boolean(websiteHref.value)`
   - `showLinkedin` → `Boolean(linkedinHref.value)`
5. Method: `handleClose()` calls `clearSelection()`.
6. `watch(isOpen, (open) => { ... })`:
   - On `open === true`: `gsap.to(drawerEl.value, { x: 0, duration: 0.35, ease: 'power2.out' })`
   - On `open === false`: `gsap.to(drawerEl.value, { x: '100%', duration: 0.35, ease: 'power2.out' })`
   - Guard against `drawerEl.value` being null.
7. `onMounted`: ensure initial position is offscreen — `gsap.set(drawerEl.value, { x: '100%' })`.

**Template section:**

- Root element: `<aside ref="drawerEl">` with classes for fixed right-side panel: `fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 overflow-y-auto`. Use `translate-x-full` initial Tailwind class as a fallback for pre-GSAP paint (GSAP `set` in onMounted overrides). Inside content padding `p-6`.
- Close button (top-right): semantic `<button @click="handleClose" aria-label="Close">` rendering an X glyph (use `&times;` or an inline SVG); positioned `absolute top-4 right-4`.
- Header section:
  - Logo block: `<img v-if="showLogo" :src="logoUrl" :alt="company.name" class="w-16 h-16 rounded" />`
  - Monogram fallback: `<div v-if="showMonogram" class="w-16 h-16 rounded bg-utah-blue text-white flex items-center justify-center text-2xl font-bold">{{ monogram }}</div>`
  - `<h2>{{ company?.name }}</h2>` (use `v-if="company"` on a wrapping container so the entire body short-circuits when no selection)
  - Sector pill: `<span class="...bg-utah-blue/10 text-utah-blue rounded-full px-2 py-1 text-xs">{{ sectorLabel }}</span>`
  - Stage pill: same pill style with neutral palette
  - Hiring badge: `<span v-if="showHiringBadge" class="bg-hiring-green text-white rounded-full px-2 py-1 text-xs">Hiring now</span>`
- Description: `<p>{{ descriptionText }}</p>`
- Jobs section (`v-if="showJobsSection"`): heading "Open roles", `<ul>` over `jobTitlesPreview` with `:key="title"`, then `<span v-if="showExtraJobs">+{{ extraJobsCount }} more</span>`.
- Links row:
  - `<a v-if="showWebsite" :href="websiteHref" target="_blank" rel="noopener noreferrer">` with website icon (inline SVG or text "Website")
  - `<a v-if="showLinkedin" :href="linkedinHref" target="_blank" rel="noopener noreferrer">` with LinkedIn icon (inline SVG or text "LinkedIn")
- Investors section (`v-if="showInvestorsSection"`): heading "Investors", pill list `<span v-for="inv in investorsList" :key="inv">{{ inv }}</span>`, then `<span v-if="showTotalRaised">{{ formattedTotalRaised }} total raised</span>`.
- Region label at bottom: `<p>{{ regionLabel }}</p>`.

**Style section:** `<style scoped></style>` — keep empty; rely on Tailwind utility classes only. No raw hex; only the locked tokens (`utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`).

**Conventions enforced:**
- JS only (no `lang="ts"`).
- Single quotes, no semicolons, 2-space indent, trailing commas.
- No `console.log`.
- Named computed for every visibility/display decision.
- `target="_blank"` always paired with `rel="noopener noreferrer"`.
</action>

<verify>
1. File exists: `goed/src/components/drawer/CompanyDrawer.vue` with `<script setup>` block followed by `<template>` then `<style scoped>`.
2. Grep check: `grep -nE "v-if=\"[^\"]*(\?|\&\&|\|\|)" goed/src/components/drawer/CompanyDrawer.vue` returns no matches (no logic in template).
3. Grep check: `grep -nE "(console\.log|lang=\"ts\")" goed/src/components/drawer/CompanyDrawer.vue` returns no matches.
4. Grep check: `grep -nE "#[0-9A-Fa-f]{3,6}" goed/src/components/drawer/CompanyDrawer.vue` returns no raw hex colors.
5. Required imports present: `gsap`, `useStartupsStore`, `getLogoUrl`, `storeToRefs`, `watch`, `computed`, `ref`, `onMounted`.
6. All required computed names present: `isOpen`, `company`, `logoUrl`, `showMonogram`, `monogram`, `showHiringBadge`, `jobTitlesPreview`, `extraJobsCount`, `showJobsSection`, `showInvestorsSection`, `formattedTotalRaised`, `websiteHref`, `linkedinHref`, `showWebsite`, `showLinkedin`. Verify with `grep -nE "const (isOpen|company|logoUrl|showMonogram|monogram|showHiringBadge|jobTitlesPreview|extraJobsCount|showJobsSection|showInvestorsSection|formattedTotalRaised|websiteHref|linkedinHref|showWebsite|showLinkedin) = computed" goed/src/components/drawer/CompanyDrawer.vue` — should print 15 lines.
7. Watcher present: `grep -n "watch(isOpen" goed/src/components/drawer/CompanyDrawer.vue` returns a match; the watcher body contains both `x: 0` and `x: '100%'` calls to `gsap.to`.
8. `gsap.set(drawerEl.value, { x: '100%' })` (or equivalent offscreen initialization) appears inside `onMounted`.
</verify>

<done>
- `CompanyDrawer.vue` exists at the correct path with the locked block order.
- Every section (logo/monogram, name, pills, hiring badge, description, jobs preview with overflow, website/linkedin links, investors + total raised, region, close button) renders from a named `computed`.
- GSAP watcher animates the drawer's `x` between `0` and `100%` over 350ms with `power2.out`.
- Close button calls `clearSelection()`.
- No raw hex, no `console.log`, no logic in template, no TypeScript.
</done>

---

### Task 2: Wire `CompanyDrawer` into `MapView.vue` with click-outside dismissal

**Type:** auto
**Sequence:** 2

<files>
goed/src/views/MapView.vue
</files>

<action>
Modify `goed/src/views/MapView.vue` to render the new drawer above the map and wire click-outside-to-close.

1. Import `CompanyDrawer` from `@/components/drawer/CompanyDrawer.vue` and `useStartupsStore` from `@/stores/startups` if not already present. The store is needed to call `clearSelection()` on map background click.
2. Composables: instantiate the store and destructure `clearSelection` (action — destructure directly off the store, do not wrap with `storeToRefs`).
3. Add a single computed-driven handler `handleMapBackgroundClick` that calls `clearSelection()`. (It is just one statement, so a plain method is acceptable per conventions — methods are the only callables permitted in templates.)
4. Template structure: a root container (existing or add a `<div class="relative w-full h-full">`) that contains, in z-order from back to front:
   - `<EcosystemStatsBar />` (existing)
   - A wrapper around `<UtahMap />` with `@click="handleMapBackgroundClick"` so any click on the map area triggers dismissal. Apply `class="relative z-10"` (or equivalent) to keep it below the drawer.
   - `<CompanyDrawer />` rendered last with z-index above the map (the component itself sets `z-40`); no props required since it reads the store.
5. Do not introduce a global document listener — clicking the drawer itself must not propagate to the map handler. Because `CompanyDrawer.vue` is `position: fixed` and rendered as a sibling outside the map wrapper, its clicks won't bubble through the map's `@click`. (If the existing `MapView.vue` already wraps the map in a way that covers the drawer, switch to a sibling layout so they don't nest.)
6. Preserve all existing behavior in `MapView.vue` (the `<UtahMap />` and `<EcosystemStatsBar />` placement). Only add the drawer and the background-click handler.

**Conventions enforced:**
- SFC block order: `<script setup>` → `<template>` → `<style scoped>`.
- Internal script order: imports → composables → ref → computed → methods → watch → lifecycle.
- JS only, single quotes, no semicolons, 2-space indent, trailing commas.
- No `console.log`.
- Default-export Vue component (implicit via SFC).
</action>

<verify>
1. File modified: `goed/src/views/MapView.vue` contains `import CompanyDrawer from '@/components/drawer/CompanyDrawer.vue'`.
2. Template renders `<CompanyDrawer />` exactly once: `grep -c "<CompanyDrawer" goed/src/views/MapView.vue` returns `1`.
3. Map area has a click handler that calls the close action: `grep -nE "@click=\"handleMapBackgroundClick\"" goed/src/views/MapView.vue` returns a match.
4. The handler calls `clearSelection()`: `grep -n "clearSelection" goed/src/views/MapView.vue` returns at least one match.
5. Drawer is a sibling of the map wrapper (not nested inside it). Visually inspect the template — `<CompanyDrawer />` should appear after the closing tag of the map wrapper, not inside it.
6. Manual functional check (run `npm run dev` from `goed/`, open `/map`):
   - Click any startup pin → drawer slides in from right (visible smooth animation, ~350ms).
   - Drawer shows logo (or monogram), name, sector pill, stage pill, hiring badge (only for hiring companies), description, jobs preview with `+N more` when applicable, website/LinkedIn icons (only when URLs exist), investor pills + currency-formatted total raised (only when investors present), region.
   - Click the X button → drawer slides out, no company selected.
   - Click a pin, then click the map background → drawer slides out.
   - Click pin A, then click pin B while drawer is open → content swaps to pin B (drawer remains visible).
7. No `console.log` calls in the file: `grep -n "console.log" goed/src/views/MapView.vue` returns nothing.
</verify>

<done>
- `MapView.vue` renders `<CompanyDrawer />` z-stacked above `<UtahMap />`.
- Clicking the map background fires `clearSelection()` and triggers the drawer's close animation via the watcher.
- All Phase 2 success criteria pass in manual testing.
- No regressions to Phase 1 behavior (map still renders, stats bar still shows, pin-click still selects a company).
</done>

## Verification Checklist

- [x] `goed/src/components/drawer/CompanyDrawer.vue` exists with `<script setup>` → `<template>` → `<style scoped>` order.
- [x] Clicking a pin slides the drawer in from the right with a visible smooth animation (~350ms, `power2.out`).
- [x] Drawer displays logo (with monogram fallback), name, sector pill, stage pill, hiring badge (only when `is_hiring`), description, jobs preview with `+N more` overflow, website + LinkedIn icons (only when URLs exist), investor pills + currency-formatted `total_raised` (only when investors present), region.
- [x] Clicking the X button slides the drawer out and clears `selectedCompany`.
- [x] Clicking the map background (outside the drawer) slides the drawer out and clears `selectedCompany`.
- [x] Selecting a different pin while the drawer is open swaps content seamlessly.
- [x] No conditionals, ternaries, boolean operators, arithmetic, or method calls in the templates of either file — every visibility flag and display value is a named `computed()`.
- [x] No raw hex colors; only Tailwind tokens (`utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`).
- [x] No `console.log` in committed code.
- [x] All `target="_blank"` links include `rel="noopener noreferrer"`.
- [x] JavaScript only — no `lang="ts"` attributes anywhere.

Completed: 2026-05-09

## Success Criteria

Phase 2 is complete when all six observable truths in Must-Haves hold true in a manual run of `npm run dev` against `/map`, and the entire verification checklist above is checked off.
