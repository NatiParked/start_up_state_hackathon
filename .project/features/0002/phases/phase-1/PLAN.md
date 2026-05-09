# Feature Plan: Map Shell & Logo-Pin Rendering (Feature 0002, Phase 1)

## Objective

Render the interactive Utah map with all 96 companies as circular logo pins fit to the state, expose a live ecosystem stats bar that reacts to `filteredCompanies`, and wire pin clicks to set `selectedCompany` in the startups store.

**Purpose:** Turn the empty `MapView.vue` shell into the visceral, demo-ready core of the Startup Map — the moment a visitor sees Utah covered in real company logos.
**Output:** `useLogoDev` composable, `CompanyPin.vue`, `UtahMap.vue`, `EcosystemStatsBar.vue`, extended `startups.js` store, populated `MapView.vue`.

---

## Must-Haves (Goal-Backward)

### Observable Truths

- A visitor opens `/map` and sees an OpenLayers map fit to Utah's bounding box on first load with OSM base tiles.
- All 96 companies appear simultaneously as circular logo pins at their `[lng, lat]` coordinates.
- Companies with a valid `logo_url` show their logo in a circular white-ringed pin with drop shadow.
- Companies missing `logo_url` (or whose image fails to load) render a monogram (first letter of `company.name`) on a `utah-blue` background, never a broken image.
- Clicking any pin sets `selectedCompany` in `useStartupsStore` to the matching company object (verifiable via Vue devtools — the drawer ships in Phase 2).
- The ecosystem stats bar shows `totalCount`, `hiringCount`, top 3 sectors, and `withInvestorsCount`, all derived from `filteredCompanies` and reactive to filter changes.
- Zero `import { ... } from 'ol'` (or any `ol/*` subpath) inside any `.vue` file under `goed/src/components/map/` — only `vue3-openlayers` components.
- Active-pin styling is a separate ring/scale state derived from `selectedCompany.id === company.id`.

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `goed/src/composables/useLogoDev.js` | Logo URL builder + memo cache | `useLogoDev()` (named) |
| `goed/src/components/map/CompanyPin.vue` | Single circular pin with logo or monogram fallback | default |
| `goed/src/components/map/UtahMap.vue` | OpenLayers map, vector layer of pin overlays, click → select | default |
| `goed/src/components/map/EcosystemStatsBar.vue` | Live counts from `filteredCompanies` | default |
| `goed/src/stores/startups.js` (modified) | Adds `selectedCompany`, `selectCompany(id)`, `clearSelection()` | `useStartupsStore` |
| `goed/src/views/MapView.vue` (modified) | Composes `UtahMap` + `EcosystemStatsBar`, calls `fetchAll()` on mount | default |

### Key Links

| From | To | Via |
|------|----|----|
| `MapView.vue onMounted` | `useStartupsStore().fetchAll()` | direct call |
| `UtahMap.vue` | `filteredCompanies` (store) | `storeToRefs(useStartupsStore())` |
| `UtahMap.vue` `<ol-feature>` per row | `CompanyPin.vue` overlay | `<ol-overlay>` at `[company.lng, company.lat]` |
| `<ol-interaction-select>` event | `useStartupsStore().selectCompany(id)` | feature id read from selected feature |
| `CompanyPin.vue` | `useLogoDev().getLogoUrl(company.website)` | composable call in `<script setup>` |
| `CompanyPin.vue` `<img>` | `hasError` ref | `@error="hasError = true"` flips computed `showMonogram` |
| `EcosystemStatsBar.vue` | `filteredCompanies` (store) | `storeToRefs` |
| Active pin scale/ring | `selectedCompany.id` (store) | `computed` `pinClasses` reads `selectedCompany?.id === props.company.id` |

---

## Dependency Graph

```
Task 1 (composable + store extension)  ── creates: useLogoDev.js, extended startups.js
        │
        ▼
Task 2 (CompanyPin + UtahMap + EcosystemStatsBar + MapView wiring)
        ── needs: Task 1 (uses getLogoUrl + selectedCompany + selectCompany)
        ── creates: CompanyPin.vue, UtahMap.vue, EcosystemStatsBar.vue, modified MapView.vue
```

## Execution Sequences

| Sequence | Task | Parallel? |
|----------|------|-----------|
| 1 | Task 1 | n/a (single task) |
| 2 | Task 2 | n/a (single task; depends on Task 1) |

---

## Tasks

### Task 1: Add `useLogoDev` composable and extend `startups` store with selection state

**Type:** auto
**Sequence:** 1

<files>
goed/src/composables/useLogoDev.js
goed/src/stores/startups.js
</files>

<action>
Create `goed/src/composables/useLogoDev.js` as a JS module exporting a single named function `useLogoDev()`. Inside the module (not inside the function) declare a module-level `Map()` named `logoCache` to memoize results across all callers. The composable returns `{ getLogoUrl }`.

`getLogoUrl(websiteUrl)` rules:
- Returns `null` immediately if `websiteUrl` is falsy, not a string, or not parseable as a URL.
- Normalizes by trying `new URL(websiteUrl)` first; if that throws, prepend `https://` and retry once. If still invalid, return `null`.
- Extracts hostname, strips a leading `www.`, lowercases it.
- If `logoCache` already has the domain, return the cached value.
- Reads token from `import.meta.env.VITE_LOGO_DEV_TOKEN`. If the token is missing/empty, return `null` and cache `null` for that domain.
- Builds `https://img.logo.dev/{domain}?token={token}`, caches and returns it.

JSDoc is required on `useLogoDev` and on `getLogoUrl` (param `websiteUrl: string|null|undefined`, returns `string|null`). Use named export only. 2-space indent, single quotes, no semicolons, trailing commas. No `console.log`.

Then modify `goed/src/stores/startups.js` to extend the existing store WITHOUT replacing what's already there from Feature 0001. Read the current file first. Inside the existing `defineStore('startups', () => { ... })` setup function:
- Add a new ref `const selectedCompany = ref(null)` alongside the existing `companies` / `isLoading` / `error` refs.
- Add an action `function selectCompany(id) { selectedCompany.value = companies.value.find(c => c.id === id) ?? null }`.
- Add an action `function clearSelection() { selectedCompany.value = null }`.
- Add `selectedCompany`, `selectCompany`, and `clearSelection` to the existing return object — preserve `companies`, `isLoading`, `error`, `fetchAll`, `filteredCompanies` exactly as they are.

Do not modify imports unless `ref` is not already imported (it should be). Do not touch `filteredCompanies`. Do not introduce `reactive()`. Keep the orientation comment at the top of the file intact.
</action>

<verify>
1. File exists: `goed/src/composables/useLogoDev.js` with named `useLogoDev` export and JSDoc on both `useLogoDev` and `getLogoUrl`.
2. Domain extraction works: in a Node REPL or quick scratch test, `getLogoUrl('https://www.acme.com/about')` → `https://img.logo.dev/acme.com?token=...`; `getLogoUrl('acme.com')` → same; `getLogoUrl(null)` → `null`; `getLogoUrl('not a url')` → `null` (after the `https://` prepend retry).
3. Memoization works: calling `getLogoUrl('https://acme.com')` twice produces the exact same string instance from `logoCache`.
4. `goed/src/stores/startups.js` exports `useStartupsStore` and the returned object now contains `selectedCompany`, `selectCompany`, `clearSelection` in addition to the pre-existing `companies`, `isLoading`, `error`, `fetchAll`, `filteredCompanies`.
5. `npm run dev` (from `goed/`) starts without errors.
6. Domain complete: `getLogoUrl` reliably returns either a logo.dev URL or `null` (never throws), and a Vue devtools inspection of the startups store shows the three new selection members.
</verify>

<done>
- `useLogoDev` composable exists with named export, module-level `Map()` cache, JSDoc, returns `null` on missing/invalid input, and reads `VITE_LOGO_DEV_TOKEN` via `import.meta.env`.
- `startups` store has `selectedCompany` (ref, default `null`), `selectCompany(id)` action that resolves a company by id, and `clearSelection()` action that nulls it — all returned from the setup function.
- All conventions honored: JS only, single quotes, no semicolons, 2-space indent, trailing commas, no `console.log`, no barrel files, no `reactive()`.
</done>

---

### Task 2: Build `CompanyPin`, `UtahMap`, `EcosystemStatsBar`, and wire them into `MapView`

**Type:** auto
**Sequence:** 2

<files>
goed/src/components/map/CompanyPin.vue
goed/src/components/map/UtahMap.vue
goed/src/components/map/EcosystemStatsBar.vue
goed/src/views/MapView.vue
</files>

<action>
Create the three map components and update `MapView.vue`. Honor the SFC block order `<script setup>` → `<template>` → `<style scoped>` and script internal order (imports → defineProps/defineEmits → composable calls → ref() → computed() → methods → watch → lifecycle). Default-export every `.vue`. No logic in templates — every class string, visibility flag, derived value lives in a named `computed()`. Individual `ref()` per state value, never `reactive()`. Import vue3-openlayers components directly from `'vue3-openlayers'` — never from `'ol'` or any `ol/*` subpath.

**`goed/src/components/map/CompanyPin.vue`:**
- `defineProps({ company: { type: Object, required: true } })`.
- Pull `getLogoUrl` from `useLogoDev()` and `selectedCompany` from `useStartupsStore` via `storeToRefs`.
- Refs: `const hasError = ref(false)`.
- Computed:
  - `logoUrl` → `getLogoUrl(props.company.website)` (returns string or `null`).
  - `monogram` → first character of `props.company.name` uppercased (empty string if name missing).
  - `showMonogram` → `true` when `logoUrl` is `null` OR `hasError.value` is `true`.
  - `isActive` → `selectedCompany.value?.id === props.company.id`.
  - `pinClasses` → returns the full Tailwind class string. Idle: circular, white ring, drop shadow, size ~36px. Active: utah-blue ring (thicker), `scale-110`, brighter shadow. Use `utah-blue` token (never raw hex). Resolve the active vs idle state inside this computed, not in the template.
  - `monogramClasses` → background `bg-utah-blue` + white text + center-aligned classes used when `showMonogram` is true.
- Template: a single `<div :class="pinClasses">` containing either an `<img v-if="!showMonogram" :src="logoUrl" :alt="company.name" @error="hasError = true" />` or a `<span v-else :class="monogramClasses">{{ monogram }}</span>`. No ternaries, no inline conditional class objects.
- `<style scoped>` may be empty or hold a small overflow-clip rule if Tailwind can't express it cleanly.

**`goed/src/components/map/UtahMap.vue`:**
- Imports from `'vue3-openlayers'`: `Map as OlMap, View as OlView, TileLayer as OlTileLayer, OsmSource as OlSourceOsm, VectorLayer as OlVectorLayer, VectorSource as OlSourceVector, Feature as OlFeature, Overlay as OlOverlay, SelectInteraction as OlInteractionSelect` (use the actual identifiers exported by the installed `vue3-openlayers` version — the executor must consult the package's exports rather than guessing). Register them by importing into `<script setup>`. Do NOT import anything from `'ol'` or `'ol/*'`.
- Pull `filteredCompanies`, `selectedCompany` (refs) from `useStartupsStore` via `storeToRefs`; pull `selectCompany`, `clearSelection` as actions.
- Constants at module top (above `defineProps`): `const UTAH_BOUNDING_BOX = { minLng: -114.05, minLat: 39.3, maxLng: -109.0, maxLat: 42.0 }` and `const UTAH_CENTER = [(-114.05 + -109.0) / 2, (39.3 + 42.0) / 2]`.
- Refs: `const mapRef = ref(null)` (template ref to the `<ol-map>` instance).
- Computed:
  - `pinnableCompanies` → `filteredCompanies.value.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng))`.
  - `initialCenter` → constant `UTAH_CENTER` (still expose as computed for template purity).
  - `initialZoom` → `7`.
- Methods:
  - `handleSelect(event)` — reads the selected feature from the event, gets its `id` property (set via `<ol-feature :properties="{ id: company.id }"`>` or by using the company id as the feature's id), calls `selectCompany(id)`. If no feature is selected (deselect), call `clearSelection()`.
  - `fitToUtah()` — uses the map ref to fit the view to `UTAH_BOUNDING_BOX` with `padding: [40, 40, 40, 40]`. Implementation note: vue3-openlayers exposes the underlying view through the component's exposed instance — call `mapRef.value?.map?.getView()?.fit(...)` using `fromLonLat` if needed; if the simplest path requires a single `ol/proj` helper import, prefer instead using vue3-openlayers' own coordinate helpers or pass the bounding box as `extent` on `<ol-view>`. The hard rule is no `ol` class imports inside `.vue` files.
- Lifecycle: `onMounted(() => { fitToUtah() })`.
- Template structure (no logic, only computed bindings):
  ```
  <div class="relative w-full h-full">
    <ol-map ref="mapRef" class="w-full h-full">
      <ol-view :center="initialCenter" :zoom="initialZoom" projection="EPSG:4326" />
      <ol-tile-layer><ol-source-osm /></ol-tile-layer>
      <ol-vector-layer>
        <ol-source-vector>
          <ol-feature
            v-for="company in pinnableCompanies"
            :key="company.id"
            :properties="{ id: company.id }"
          >
            <ol-overlay :position="[company.lng, company.lat]" positioning="center-center">
              <CompanyPin :company="company" />
            </ol-overlay>
          </ol-feature>
        </ol-source-vector>
      </ol-vector-layer>
      <ol-interaction-select @select="handleSelect" />
    </ol-map>
  </div>
  ```
  If `<ol-overlay>` cannot be a child of `<ol-feature>` in the installed vue3-openlayers version, hoist the overlays to siblings of `<ol-vector-layer>` keyed by `company.id` and bind their `position` to `[company.lng, company.lat]` — the visible result is identical and the click-select still operates on the vector features. Choose whichever the package supports; do not import from `'ol'` to work around it.

**`goed/src/components/map/EcosystemStatsBar.vue`:**
- Pull `filteredCompanies` via `storeToRefs(useStartupsStore())`.
- Computed:
  - `totalCount` → `filteredCompanies.value.length`.
  - `hiringCount` → count of companies with truthy `is_hiring`.
  - `topSectors` → derived via a `Map` reducer: iterate `filteredCompanies.value`, increment `sectorCounts.get(sector) ?? 0`, then `[...sectorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)`. Return as array of `{ name, count }` objects. Skip rows with falsy `sector`.
  - `withInvestorsCount` → count of companies whose `investors` array (or comma-separated `investors` string) is truthy and non-empty. If the column is unknown, fall back to checking truthy `investors` field as either array length > 0 or non-empty trimmed string.
  - `topSectorsLabel` → joined string `"AI · SaaS · FinTech"` for compact display, derived in computed (no template join).
- Template: a single horizontal flex bar. Each stat is a `<div>` with a large utah-blue accent number and a small label beneath. Use `bg-white`, `border-b border-gray-200`, padding `px-6 py-3`. Render `topSectorsLabel` as a single string, not a v-for. All values from computed — no logic in template.

**`goed/src/views/MapView.vue`:**
- Read the existing file first; replace contents.
- `<script setup>`: import `useStartupsStore`, `UtahMap`, `EcosystemStatsBar`. Pull store. `onMounted(() => useStartupsStore().fetchAll())` — guard against re-fetch by checking if `companies.value.length === 0` first.
- Template layout: a full-bleed flex column `<div class="flex flex-col h-screen w-screen">`. `<EcosystemStatsBar />` on top (`shrink-0`), `<UtahMap class="flex-1 min-h-0" />` below taking remaining height. Leave a placeholder comment `<!-- TODO: FilterSidebar (Phase 3) and CompanyDrawer (Phase 2) -->` but do not render those components.
- `<style scoped>` empty.

Use the `@/` alias for cross-directory imports (e.g., `import CompanyPin from '@/components/map/CompanyPin.vue'`). Single quotes, no semicolons, 2-space indent, trailing commas. No `console.log`. No barrel files. No `reactive()`. JSDoc not required on Vue components.
</action>

<verify>
1. Files exist:
   - `goed/src/components/map/CompanyPin.vue`
   - `goed/src/components/map/UtahMap.vue`
   - `goed/src/components/map/EcosystemStatsBar.vue`
   - `goed/src/views/MapView.vue` (modified)
2. Static check — no `ol` imports in components:
   - `grep -rn "from 'ol" goed/src/components/map/ goed/src/views/MapView.vue` returns NOTHING (zero matches).
   - `grep -rn "from \"ol" goed/src/components/map/ goed/src/views/MapView.vue` returns NOTHING.
3. Static check — no logic in templates:
   - `grep -nE "(\? .* :)|(&&)|(\\|\\|)" goed/src/components/map/*.vue goed/src/views/MapView.vue` shows zero hits inside `<template>` blocks (exclude `<script>` lines manually if grep crosses blocks).
4. Build check: `cd goed && npm run build` exits 0.
5. Functional check: `cd goed && npm run dev`, open the browser to `/map`. Observe:
   - OpenLayers map renders fit to Utah with OSM tiles.
   - All 96 (or however many seeded with valid lat/lng) company pins render at distinct positions.
   - Pins with `logo_url` show logos in white-ringed circles; pins without (or with broken logos) show a uppercased monogram on `utah-blue`.
   - Clicking a pin updates `useStartupsStore().selectedCompany` to that company (verify via Vue devtools panel).
   - The clicked pin visibly grows / changes ring (active vs idle classes apply).
   - The stats bar at the top shows total count (matches `filteredCompanies.value.length`), a hiring count, top 3 sectors as a single dot-separated string, and a with-investors count.
6. Domain complete: A first-time visitor opening `/map` sees Utah covered in real company logos, can click any pin to select it (devtools-confirmed), and sees the live ecosystem stats bar — without any broken images, console errors, or `ol` imports leaking into Vue components.
</verify>

<done>
- All four files compile and render without runtime errors in `npm run dev` and `npm run build`.
- Pin click sets `selectedCompany` in the store; deselect (clicking empty map) calls `clearSelection()`.
- Active pin styling differs visibly from idle (scale + ring color/thickness).
- Logo failures fall back to monogram via `@error` handler — never broken images.
- Stats bar values are reactive: applying any future filter (or mutating `companies` in devtools) updates `totalCount`, `hiringCount`, `topSectorsLabel`, `withInvestorsCount` instantly.
- Zero `from 'ol'` or `from "ol/...` imports anywhere under `goed/src/components/map/` or `goed/src/views/MapView.vue`.
- Conventions honored: JS only, SFC block order, no template logic, individual refs, Tailwind tokens (no raw hex), `@/` alias for cross-dir imports, no `console.log`, no barrel files, no `reactive()`.
</done>

---

## Verification Checklist

- [ ] A visitor loading `/map` sees an OpenLayers map fit to Utah with OSM tiles on first paint.
- [ ] All companies with valid `lat`/`lng` from the seed render as circular pins simultaneously.
- [ ] Companies with valid `logo_url` show their logo; companies without (or with image errors) show a monogram on `utah-blue`.
- [ ] Clicking a pin updates `useStartupsStore().selectedCompany` (verifiable in Vue devtools).
- [ ] Clicking the same pin again, or clicking empty map, does not crash; deselect clears `selectedCompany`.
- [ ] Active pin visibly differs from idle pins (ring color/thickness + scale).
- [ ] Stats bar shows correct `totalCount`, `hiringCount`, top 3 sectors as a dot-separated string, and `withInvestorsCount`, all derived from `filteredCompanies`.
- [ ] Stats bar updates reactively when `filteredCompanies` mutates (testable later via filters; for Phase 1, mutate via devtools or temporarily change a filter ref).
- [x] `grep -rn "from 'ol" goed/src/components/map/ goed/src/views/MapView.vue` returns zero matches.
- [x] `grep -rn "console.log" goed/src/components/map/ goed/src/views/MapView.vue goed/src/composables/useLogoDev.js goed/src/stores/startups.js` returns zero matches.
- [x] `cd goed && npm run build` exits 0.
Completed: 2026-05-09
- [ ] `useLogoDev`'s module-level cache is hit on the second call for the same domain (memoization works).

## Success Criteria

Phase 1 is complete when a visitor opens `/map`, immediately sees Utah covered in real company logos on a fitted OpenLayers map, can click any pin to mutate `selectedCompany` in the Pinia store, and sees a live ecosystem stats bar reflecting the current `filteredCompanies` — all delivered through `vue3-openlayers` components with zero direct `ol` imports inside Vue files.
