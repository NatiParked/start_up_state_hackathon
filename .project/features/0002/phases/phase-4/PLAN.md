# Feature Plan: Map Foundation — Phase 4: Cluster Rendering & Polish

## Objective

Wire `<ol-source-cluster>` into `UtahMap.vue` with a hover-preview `PinCluster.vue` component, then apply final layout/visual polish to `MapView.vue`, `CompanyPin.vue`, and `EcosystemStatsBar.vue` so the page lands with hackathon-worthy "5-second wow."

**Purpose:** Convert the dense pin layer into a clean, zoom-aware presentation that scales gracefully and presents a polished, brand-consistent UI to a fresh visitor.

**Output:** New `PinCluster.vue` component, an updated clustered `UtahMap.vue`, a final-pass `MapView.vue` layout, and tightened polish on `CompanyPin.vue` + `EcosystemStatsBar.vue`.

## Must-Haves (Goal-Backward)

### Observable Truths

- A fresh visitor lands on `/` and the Utah map fits the viewport with logos visibly scattered across multiple regions.
- Zooming out causes nearby pins to collapse into a single circular cluster marker showing the count.
- Zooming back in re-explodes clusters into individual logo pins.
- Hovering a cluster reveals up to 3 logo previews of the contained companies.
- Clicking a cluster zooms the map in (incrementally) and does NOT open the drawer.
- Clicking a single pin still opens the `CompanyDrawer` for that company.
- The ecosystem stats bar communicates ecosystem size (total companies, hiring, sectors) above or below the map.
- The filter sidebar collapses smoothly; the drawer slides over the right side; transitions feel intentional.
- All colors are Tailwind tokens (`utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`); no raw hex strings remain in any committed file.
- No `console.log` calls remain in any committed file.

### Required Artifacts

| Path | Provides | Key Exports |
|---|---|---|
| `goed/src/components/map/PinCluster.vue` | Cluster marker with count badge + hover logo previews | default SFC |
| `goed/src/components/map/UtahMap.vue` (modified) | Clustered vector source, dual style function (single vs cluster), correct click routing | default SFC |
| `goed/src/views/MapView.vue` (modified) | Final three-zone layout (sidebar / map / drawer overlay) with smooth transitions | default SFC |
| `goed/src/components/map/CompanyPin.vue` (modified) | Premium ring/shadow/hover-active scale | default SFC |
| `goed/src/components/map/EcosystemStatsBar.vue` (modified) | Tightened typography, number emphasis, sector spacing | default SFC |

### Key Links

| From | To | Via |
|---|---|---|
| `UtahMap.vue` | `<ol-source-cluster>` | wraps existing `<ol-source-vector>`, `distance` prop ~40 |
| `UtahMap.vue` style fn | `CompanyPin.vue` / `PinCluster.vue` | branch on `feature.get('features').length` |
| Cluster click | OpenLayers view | `view.animate({ zoom: zoom + 2, center: coords })` |
| Single pin click | `startupsStore.selectCompany(id)` | `feature.get('features')[0].get('id')` |
| `PinCluster.vue` previews | `useLogoDev.getLogoUrl()` | computed `previewLogoUrls` over first 3 companies |

## Dependency Graph

```
Task 1 (PinCluster.vue) → creates: goed/src/components/map/PinCluster.vue
        ↓
Task 2 (UtahMap clustering) → modifies: goed/src/components/map/UtahMap.vue
                              consumes:  PinCluster.vue + existing CompanyPin.vue
        ↓
Task 3 (Layout + polish pass) → modifies: MapView.vue, CompanyPin.vue, EcosystemStatsBar.vue
                                hex/console.log sweep across all phase artifacts
```

## Execution Sequences

| Sequence | Tasks | Parallel |
|---|---|---|
| 1 | Task 1 | — |
| 2 | Task 2 | depends on Task 1 |
| 3 | Task 3 | depends on Task 2 |

## Tasks

### Task 1: Create `PinCluster.vue` with hover-preview logo fan

**Type:** auto
**Sequence:** 1
**Status:** COMPLETE
**Completed:** 2026-05-09

<files>
goed/src/components/map/PinCluster.vue
</files>

<action>
Create a new SFC for cluster markers. SFC block order: `<script setup>` → `<template>` → `<style scoped>`.

Props (object form, explicit types):
- `companies: { type: Array, required: true }` — array of company objects contained in the cluster
- `count: { type: Number, required: true }` — total companies in cluster

Imports:
- `computed` from `vue`
- `useLogoDev` from `@/composables/useLogoDev`

Computeds (no logic in template):
- `displayCount` — formatted count string (e.g., `99+` if `count > 99`, otherwise `String(count)`)
- `previewCompanies` — `companies.slice(0, 3)`
- `previewLogoUrls` — array of `{ id, url }` derived from `previewCompanies` via `getLogoUrl(company.website_url)`
- `clusterClasses` — base classes for the circular marker on `bg-utah-blue` with white text, ring, shadow
- `previewWrapperClasses` — classes that toggle visibility/opacity on hover (group-hover) for the fan-out

Template:
- Root element uses Tailwind `group relative` so child preview wrapper can react to hover
- Circular marker: ~44px diameter, `bg-utah-blue`, `ring-2 ring-white`, `shadow-lg`, white count badge centered, `hover:scale-105 transition-transform`
- Preview wrapper: absolutely positioned above the marker, contains up to 3 small logo circles arranged horizontally (fanned with negative margin or translate); hidden by default, shown on `group-hover` with CSS transition (opacity + translate-y)
- Each preview logo: 28-32px circle, `bg-white`, `ring-1 ring-utah-blue/20`, rounded-full, `<img>` with `loading="lazy"` and `alt=""` (decorative)
- Use only Tailwind tokens — no raw hex
- No inline `console.log`

`<style scoped>` block: only if Tailwind cannot express the fan transition cleanly; otherwise leave empty.
</action>

<verify>
1. File exists: `goed/src/components/map/PinCluster.vue`
2. SFC block order is `<script setup>` → `<template>` → `<style scoped>`; uses `<script setup>` (no `lang="ts"`)
3. `defineProps` uses object form with `type` + `required` for `companies` and `count`
4. Template has zero ternaries, boolean ops, arithmetic, or method calls — every class/value comes from a `computed`
5. `grep -nE "#[0-9a-fA-F]{3,8}" goed/src/components/map/PinCluster.vue` returns nothing (no raw hex)
6. `grep -n "console.log" goed/src/components/map/PinCluster.vue` returns nothing
7. Visual check via `npm run dev`: rendering `<PinCluster :companies="[...3 fakes]" :count="7" />` in any test harness shows a blue circle with `7`; hover reveals 3 logo previews fanning out with a smooth transition
</verify>

<done>
- `PinCluster.vue` is created and self-contained
- Renders count badge on `bg-utah-blue` with white text, ring, shadow
- Hover reveals up to 3 logo previews via CSS transition
- All colors are Tailwind tokens; no raw hex; no `console.log`
- Conventions hold: `<script setup>` first, no template logic, computeds for every derived value
</done>

---

### Task 2: Wire `<ol-source-cluster>` into `UtahMap.vue` with dual style + click routing

**Type:** auto
**Sequence:** 2
**Status:** COMPLETE
**Completed:** 2026-05-09

<files>
goed/src/components/map/UtahMap.vue
</files>

<action>
Modify `UtahMap.vue` to cluster nearby features and render either `<CompanyPin>` (single) or `<PinCluster>` (multi) based on the cluster's child count. Selecting a cluster zooms in; selecting a single pin still calls `selectCompany`.

1. Imports: add `PinCluster from '@/components/map/PinCluster.vue'` (keep existing `CompanyPin` import).
2. Wrap the existing vector source with `<ol-source-cluster :distance="40">` so the source becomes:
   ```
   <ol-vector-layer>
     <ol-source-cluster :distance="40">
       <ol-source-vector> ... existing <ol-feature> generation ... </ol-source-vector>
     </ol-source-cluster>
   </ol-vector-layer>
   ```
   Keep the per-feature `<ol-feature>` generation that emits one feature per company (each carrying `id`, `lat`, `lng`, full company object via `set()`).
3. Style function (or `<ol-style>` resolution) must branch on `feature.get('features').length`:
   - `length === 1` → render the underlying single company through `<CompanyPin>` (existing behavior — extract its company data via `feature.get('features')[0]`).
   - `length > 1` → render `<PinCluster>` with the array of contained companies and the count.
   If `vue3-openlayers` exposes per-feature templating via `<ol-style>` slots, prefer the slot-template approach so `CompanyPin` and `PinCluster` are rendered as components (not raw OpenLayers styles). If not, fall back to a `style-fn` that returns OpenLayers `Style`/`Icon` objects derived from those same components' visual rules — but the preferred path is component slots.
4. Add a single `selectFeature(feature)` handler bound to the existing `<ol-interaction-select>` (or `@click` on the cluster source if that is the existing pattern). Inside the handler:
   ```
   const children = feature.get('features') || []
   if (children.length > 1) {
     // cluster click → zoom in
     const view = mapRef.value.getView()
     view.animate({
       zoom: view.getZoom() + 2,
       center: feature.getGeometry().getCoordinates(),
       duration: 350,
     })
     return
   }
   // single pin → open drawer
   const id = children[0]?.get('id')
   if (id) startupsStore.selectCompany(id)
   ```
   Use the existing `mapRef`/`viewRef` pattern already in the file (do not introduce new direct `ol` imports — use `vue3-openlayers` refs).
5. Move every branch decision into a named `computed()` or method — no ternaries / `&&` / arithmetic in the template.
6. Remove any `console.log` statements that may have been left from prior phases.
7. Confirm only Tailwind tokens are used; convert any stray hex (e.g., on `<ol-style>` colors) to tokens by referencing the same color values defined in `tailwind.config.js` (read those values from the config import or a shared `@/lib/constants.js` if needed — no inline hex strings in the SFC).
</action>

<verify>
1. `grep -n "ol-source-cluster" goed/src/components/map/UtahMap.vue` returns at least one match with `:distance="40"` (or a named computed providing 40)
2. `grep -n "PinCluster" goed/src/components/map/UtahMap.vue` shows the import + usage
3. `grep -nE "#[0-9a-fA-F]{3,8}" goed/src/components/map/UtahMap.vue` returns nothing
4. `grep -n "console.log" goed/src/components/map/UtahMap.vue` returns nothing
5. `npm run dev` from `goed/`: load `/`, zoom out — pins collapse into circular cluster markers with counts; zoom in — clusters re-explode into individual logos
6. Click a cluster → map smoothly zooms in (no drawer opens); click a single pin → `CompanyDrawer` opens for that company
7. Hover a cluster → up to 3 logo previews fan out
8. Browser console shows no errors and no `console.log` output during pan/zoom/click
</verify>

<done>
- Vector source is wrapped in `<ol-source-cluster :distance="40">`
- Style/render branches on `feature.get('features').length`: 1 → `CompanyPin`, >1 → `PinCluster`
- Cluster click animates zoom in; single pin click calls `startupsStore.selectCompany(id)`
- No direct `ol` class imports in the SFC (vue3-openlayers components only)
- Tailwind tokens only; no `console.log`
</done>

---

### Task 3: Final layout pass on `MapView.vue` + polish on `CompanyPin.vue` and `EcosystemStatsBar.vue`

**Type:** auto
**Sequence:** 3

<files>
goed/src/views/MapView.vue
goed/src/components/map/CompanyPin.vue
goed/src/components/map/EcosystemStatsBar.vue
</files>

<action>
Three coordinated polish passes. Keep all decisions in `computed()`; only Tailwind tokens.

**A. `MapView.vue` — three-zone layout with smooth transitions:**
- Layout: filter sidebar (left, collapsible), map (fills remaining space), drawer (slides over right side as overlay — drawer is `position: absolute/fixed` over the map zone, not a third column that resizes the map).
- Sidebar: collapsed/expanded width controlled by a `ref` (e.g., `isSidebarOpen`), bound through a single `sidebarClasses` computed (e.g., `w-72` vs `w-12`). Use `transition-all duration-300 ease-out`. Include a small chevron toggle button.
- Stats bar: pin `<EcosystemStatsBar>` either directly above the map zone or directly below the header, whichever produces better vertical balance — choose ABOVE the map, full-width across the right zone (sidebar + stats above map + drawer overlay). All spacing via Tailwind utilities, no raw hex, no fixed pixel `style=""`.
- Header / branding row: ensure a top bar with site/product name in `text-utah-blue-dark` exists; if absent, add a slim `<header>` with the product title and a thin border-bottom.
- Smooth transitions on: sidebar collapse (already covered), filter change re-rendering of pins (rely on Vue's reactivity — no extra animation required), drawer open/close (already animated via GSAP from earlier phase — verify it still works when drawer is overlaid rather than columnar).
- Use semantic HTML: `<header>`, `<main>`, `<aside>` for sidebar.
- Wrap derived class strings in computeds: `layoutClasses`, `sidebarClasses`, `mapZoneClasses`, `statsBarClasses`.
- Remove any `console.log` introduced during scaffolding.

**B. `CompanyPin.vue` polish:**
- Premium feel: `ring-2 ring-white`, `shadow-md` baseline, `hover:shadow-lg hover:scale-110`, `active:scale-95`, `transition-all duration-150 ease-out`.
- Active state (when this company is `selectedId`): brighter ring (`ring-utah-blue` or `ring-utah-blue-dark`), slightly larger scale (`scale-110`), elevated shadow.
- Logo container: clean `bg-white` circle, `overflow-hidden`, `rounded-full`, monogram fallback uses `bg-utah-blue text-white font-semibold`.
- Move every class decision into a `pinClasses` (or split `containerClasses` / `logoClasses`) computed. No ternaries / `&&` in template.
- Remove any `console.log`.

**C. `EcosystemStatsBar.vue` polish:**
- Typography: number values in `text-3xl font-bold text-utah-blue-dark`, labels in `text-xs uppercase tracking-wide text-gray-600`.
- Number emphasis: each stat (Total companies, Hiring, Sectors, etc.) rendered as a vertical stack with the number on top.
- Sector breakdown: even spacing via `gap-4` or `gap-6`, ensure on small viewports it wraps gracefully (`flex flex-wrap gap-x-6 gap-y-2`).
- Background: `bg-white` with subtle `border-b border-gray-200`, `px-6 py-3`.
- All values come from `useStartupsStore` (already wired); only refine display.
- Move display strings (e.g., singular/plural label, formatted percentages) into computeds.
- Remove any `console.log`.

**D. Final hex + console.log sweep across phase artifacts** (the 3 files above plus `PinCluster.vue` and `UtahMap.vue` from Tasks 1–2):
- Run a grep sweep; any raw hex must be migrated to a Tailwind token defined in `goed/tailwind.config.js`. If a needed token does not yet exist, add it to `tailwind.config.js` under `theme.extend.colors` with a semantic name and reference it.
- Any `console.log` must be deleted (replace with proper UI feedback if it was conveying real info, otherwise just remove).
</action>

<verify>
1. `npm run dev` from `goed/`, navigate to `/`:
   - Header row visible with product/branding name in `text-utah-blue-dark`
   - Filter sidebar on the left collapses smoothly when toggled (transition is visible, not a snap)
   - Map fills the remaining space and resizes correctly when sidebar collapses
   - Stats bar visible above the map, full width, with bold numbers and small labels
   - Drawer (when a single pin is clicked) slides in as an overlay on top of the map's right side — does NOT resize the map
   - Pins feel premium: ring, shadow, hover scale, active state all visible
2. `grep -rnE "#[0-9a-fA-F]{3,8}" goed/src/components/map goed/src/views/MapView.vue` returns nothing (no raw hex in any phase-touched file)
3. `grep -rn "console.log" goed/src/components/map goed/src/views/MapView.vue goed/src/components/drawer goed/src/components/filters` returns nothing
4. `grep -nE "(\?\s*['\"a-zA-Z0-9]|&&|\|\|)" inside <template> of each touched file` (manual scan): no boolean/ternary in template attribute bindings
5. "5-second wow" gut check: a fresh load of `/` shows the Utah map fitted to viewport with logos scattered across the state, polished header + stats bar, and a clearly-interactive sidebar — clicking, hovering, zooming all feel smooth.
</verify>

<done>
- `MapView.vue` has a three-zone layout: collapsible left sidebar, map filling center, drawer as right-side overlay (not a column)
- Smooth transitions on sidebar collapse and drawer open/close
- Stats bar pinned above the map with strong number emphasis
- `CompanyPin.vue` ring, shadow, hover, and active states feel premium
- `EcosystemStatsBar.vue` typography and spacing tightened
- Across all phase-touched files: zero raw hex, zero `console.log`, every template class decision lives in a `computed`
</done>

## Verification Checklist

- [ ] Zoom out → pins cluster into a single circular marker showing the count
- [ ] Zoom in → clusters re-explode into individual logo pins
- [ ] Hover a cluster → up to 3 logo previews fan out with a smooth transition
- [ ] Click a cluster → map zooms in incrementally; drawer does NOT open
- [ ] Click a single pin → `CompanyDrawer` opens for that company
- [ ] Map fits the viewport on first load with logos visibly scattered across Utah regions
- [ ] Stats bar communicates ecosystem size (count, hiring, sectors) above the map
- [ ] Filter sidebar collapses/expands with a smooth Tailwind transition
- [ ] Drawer slides in as an overlay on the right; map underneath remains full-width
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}" goed/src` returns nothing in phase-touched files
- [ ] `grep -rn "console.log" goed/src` returns nothing
- [ ] All template class/value decisions resolve via named `computed()` (no template ternaries, `&&`, or arithmetic)
- [ ] Only `vue3-openlayers` components are used in Vue files (no direct `ol` class imports inside SFCs)

## Success Criteria

A fresh visitor lands on `/`, sees a polished Utah map with logos clustered intelligently across the state, a tight ecosystem stats bar, and a collapsible filter sidebar — clicking a cluster zooms in, clicking a single pin opens a smooth GSAP drawer overlay, and the entire experience feels brand-consistent (Utah blue tokens only) and free of dev artifacts (`console.log`, raw hex). The "5-second wow" lands.
