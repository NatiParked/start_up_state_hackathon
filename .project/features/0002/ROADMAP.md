# Feature 0002: Map Foundation — Rendering & Interactivity

> Created: 2026-05-08
> Status: Draft

## Overview

Transform the static MapView shell from Feature 0001 into a fully interactive Utah Startup Map. A visitor lands on the page, sees 96 company logos scattered across Utah on an OpenLayers map, can filter by sector / stage / hiring / investor / region / employee range / founded year, click a logo pin to slide in a rich GSAP-animated company drawer, and view live ecosystem stats that react to filter changes. Pins cluster intelligently when zoomed out.

This is the hackathon "wow" feature — a 5-second-impressive demo of Utah's startup ecosystem.

## Problem Statement

Feature 0001 delivered the plumbing (deps, Supabase client, stores, seed data, route shell) but the map page is empty. Without a rendered map, visible companies, working filters, and a company drawer, the product cannot be demoed and there is nothing for the judges (or visitors) to see. We need to turn data into a visceral, interactive map experience that immediately communicates the breadth and energy of Utah's startup ecosystem.

## User Stories

- As a visitor, I want to land on the map and immediately see Utah filled with company logos so that I instantly grasp the scale of the startup ecosystem.
- As a visitor, I want to click a logo to see that company's full profile (description, hiring status, jobs, investors, links) so that I can quickly evaluate any individual company.
- As a job-seeker, I want to filter to only "Hiring now" companies in a specific sector or region so that I can find places to work without scanning every pin.
- As an investor / founder, I want to filter by investor name or stage to see who is in a portfolio or peer group so that I can understand the funding landscape.
- As a power user, I want filter state encoded in the URL so that I can share a filtered map view with others.
- As a visitor zoomed out, I want nearby pins to cluster cleanly with a count and logo previews so that the map stays readable across zoom levels.
- As any user, I want a live stats bar that updates as I filter so that I can quantify the slice I'm currently viewing.

---

## Codebase Context

### Technology Stack

- Vue 3.5 SFCs with `<script setup>`, Pinia 3, Vue Router 5, Vite 8
- JavaScript only (no TypeScript)
- `vue3-openlayers` + `ol` for map rendering and clustering
- `gsap` for drawer slide animation
- Tailwind CSS v3 with Utah brand tokens (`utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`)
- `@supabase/supabase-js` for data access (already wired in Feature 0001)
- Logo.dev for company logos via `VITE_LOGO_DEV_TOKEN`

### Relevant Directories

- `goed/src/views/MapView.vue` — composes the full page (exists as empty shell)
- `goed/src/components/map/` — UtahMap, CompanyPin, PinCluster, EcosystemStatsBar
- `goed/src/components/filters/` — FilterSidebar + 7 filter sub-components
- `goed/src/components/drawer/` — CompanyDrawer
- `goed/src/composables/` — useLogoDev.js
- `goed/src/stores/startups.js` — extend with `selectedCompany`, `selectCompany`, `clearSelection`; wire `filteredCompanies` to filters store
- `goed/src/stores/filters.js` — wire URL sync; expose all 9 filter refs (already scaffolded)
- `goed/src/lib/supabase.js` — used as-is from Feature 0001

### Conventions to Follow

- SFC block order: `<script setup>` → `<template>` → `<style scoped>`
- Script internal order: imports → defineProps/defineEmits → composables → ref() → computed() → methods → watch → lifecycle
- No logic in templates — every class decision, visibility flag, derived string, filtered array is a named `computed()`
- Individual `ref()` per state value — no `reactive()` grouping
- `vue3-openlayers` components exclusively — no direct `ol` class imports inside Vue components
- snake_case DB column names preserved in Vue state (`company.is_hiring`, `company.logo_url`, etc.)
- Tailwind tokens only — no raw hex colors
- Named exports for composables / utils; default exports for Vue components
- JSDoc on all exported functions in `composables/` and `lib/`
- 2-space indent, single quotes, no semicolons, trailing commas
- No `console.log` in committed code
- No barrel / index.js files
- GSAP: inline in `onMounted` for simple one-offs; extract to composable only if reused
- Service functions return `{ data, error }`
- URL filter format: repeated keys (`?sectors=AI&sectors=SaaS`)

---

## Implementation Plan

### Phase 1: Map Shell & Logo-Pin Rendering

Render the Utah map with all 96 companies as logo pins, fitted to the state on first load, and wire pin clicks to set `selectedCompany` in the store. Add the live ecosystem stats bar.

**Tasks:**

- Create `goed/src/composables/useLogoDev.js` with `getLogoUrl(websiteUrl)` — extracts domain, returns `https://img.logo.dev/{domain}?token=${VITE_LOGO_DEV_TOKEN}`, memoizes via module-level `Map()` cache. JSDoc required. Returns `null` for missing/invalid URLs.
- Create `goed/src/components/map/CompanyPin.vue`:
  - Props: `company` (object)
  - Computed: `logoUrl` (from `useLogoDev`), `monogram` (first letter of `company.name`), `showMonogram` (true when no `logo_url` or img errored), `pinClasses` (active vs idle ring/scale)
  - `<img>` with `@error` to flip a `hasError` ref → falls back to monogram on `utah-blue` background
  - Circular crop, white border ring, drop shadow, scale-up on active state
- Extend `goed/src/stores/startups.js`:
  - Add `selectedCompany` ref (default `null`)
  - Add `selectCompany(id)` action (sets `selectedCompany` to company found by id)
  - Add `clearSelection()` action (sets `selectedCompany` to `null`)
- Create `goed/src/components/map/UtahMap.vue`:
  - `<ol-map>` centered on Utah bounding box (lat 39.3–42.0, lng -114.05 to -109.0), fit-to-state on mount
  - `<ol-tile-layer>` with `<ol-source-osm>`
  - `<ol-vector-layer>` with `<ol-source-vector>` driven by `filteredCompanies`
  - One `<ol-feature>` per company, each rendering a `<CompanyPin>` overlay at `[company.lng, company.lat]`
  - `<ol-interaction-select>` on pin click → calls `selectCompany(feature.id)`
  - No direct `ol` class imports — `vue3-openlayers` components only
- Create `goed/src/components/map/EcosystemStatsBar.vue`:
  - Computed from `filteredCompanies` (which currently returns all): `totalCount`, `hiringCount`, `topSectors` (top 3 by count, derived via `Map` reducer in computed), `withInvestorsCount`
  - Horizontal bar layout, Utah-blue accent on numbers
  - All values from computed — no logic in template
- Update `goed/src/views/MapView.vue`:
  - On mount: `useStartupsStore().fetchAll()`
  - Render `<UtahMap />` (full-bleed) and `<EcosystemStatsBar />` above or below
  - Layout placeholder for sidebar/drawer (added in later phases)

**Success Criteria:**

- A visitor loads the app, navigates to `/map`, and sees an OpenLayers map fitted to Utah with all 96 company logos visible as circular pins.
- Companies missing a `logo_url` render as a monogram (first letter on `utah-blue` background) instead of a broken image.
- Clicking any pin updates `selectedCompany` in the store (verifiable via Vue devtools — drawer comes in Phase 2).
- The ecosystem stats bar shows correct totals (96 companies, accurate hiring count, top 3 sectors, investor-backed count) and updates reactively if `filteredCompanies` changes.
- No `ol` class imports anywhere in the components — only `vue3-openlayers` JSX/components.

---

### Phase 2: Company Drawer

Build the GSAP-animated right-side drawer that slides in when a pin is clicked, displaying the company's full profile.

**Tasks:**

- Create `goed/src/components/drawer/CompanyDrawer.vue`:
  - Reads `selectedCompany` from `useStartupsStore`
  - Template root: fixed-position right-side panel, `translate-x-full` initial state, full height
  - Computed values for display (no logic in template):
    - `isOpen` (boolean — `selectedCompany !== null`)
    - `company` (alias of `selectedCompany`)
    - `logoUrl` (via `useLogoDev`)
    - `showMonogram` / `monogram`
    - `showHiringBadge` (`is_hiring === true`)
    - `jobTitlesPreview` (first 3 from `job_titles`)
    - `extraJobsCount` (`job_titles.length - 3`, only when > 0)
    - `showJobsSection` (`is_hiring && job_titles?.length > 0`)
    - `showInvestorsSection` (`investors?.length > 0`)
    - `formattedTotalRaised` (currency-formatted `total_raised`, hidden if null)
    - `websiteHref`, `linkedinHref` (with `null` guards via computed)
    - `showWebsite`, `showLinkedin`
  - Sections: large logo + name + sector pill + stage pill, hiring badge, description, jobs preview (`+N more` overflow), website + linkedin icon links, investors pill list + total_raised badge, region label, close (X) top-right
  - Watch `isOpen`: GSAP `gsap.to(el, { x: 0, duration: 0.35, ease: 'power2.out' })` on open, reverse on close
  - Close button calls `clearSelection()`
  - Click-outside (on map area) also calls `clearSelection()` — wire via watcher or handler in `MapView.vue`
- Update `goed/src/views/MapView.vue` to render `<CompanyDrawer />` above the map (z-stacked)

**Success Criteria:**

- Clicking a pin slides the drawer in from the right (visible smooth GSAP animation, ~350ms, `power2.out` ease).
- Drawer displays all company fields correctly: logo (or monogram), name, sector pill, stage pill, hiring badge (only when `is_hiring`), description, job titles preview with `+N more` overflow, website + LinkedIn icons (only if URL exists), investor pills + total raised (only when investors present), region.
- Clicking the X button or clicking outside the drawer (on the map background) slides it out and clears `selectedCompany`.
- Selecting a different pin while drawer is open swaps content seamlessly (still animated/visible).
- No conditionals or string interpolation in template — every visibility flag and display value comes from a `computed()`.

---

### Phase 3: Filter Sidebar & URL Sync

Build all filter sub-components, wire the sidebar shell, sync filter state to/from URL query params using repeated-key format, and make `filteredCompanies` actually apply all 9 filter criteria.

**Tasks:**

- Create `goed/src/components/filters/SectorFilter.vue` — multi-select checkboxes; options derived from `[...new Set(companies.map(c => c.sector))]` via computed; binds `useFiltersStore().sectors`.
- Create `goed/src/components/filters/StageFilter.vue` — multi-select checkboxes against `useFiltersStore().stages`.
- Create `goed/src/components/filters/EmployeeRangeFilter.vue` — multi-select checkboxes against `useFiltersStore().employeeRanges`.
- Create `goed/src/components/filters/HiringFilter.vue` — single boolean toggle ("Hiring now only") bound to `useFiltersStore().isHiring`.
- Create `goed/src/components/filters/RegionFilter.vue` — multi-select checkboxes; options derived from companies; binds `useFiltersStore().regions`.
- Create `goed/src/components/filters/InvestorFilter.vue` — multi-select checkboxes; options computed via `[...new Set(companies.flatMap(c => c.investors ?? []))].sort()`; binds `useFiltersStore().investors`.
- Create `goed/src/components/filters/FoundedYearFilter.vue` — range slider; bounds computed from `Math.min` / `Math.max` of `founded_year` across companies (not hardcoded); binds `useFiltersStore().foundedYearRange`.
- Note: `FundingStageFilter` and `BusinessTypeFilter` are not in user spec component list — `useFiltersStore` exposes `fundingStages` and `businessTypes` refs but no UI for them this phase. Filter logic in `filteredCompanies` should still respect them (so they pass-through if any other layer sets them, e.g., URL params).
- Create `goed/src/components/filters/FilterSidebar.vue`:
  - Collapsible left sidebar shell
  - Composes all 7 filter components in vertical stack
  - "Clear all" button calls `useFiltersStore().clearAll()`
  - URL sync logic:
    - On mount: parse `route.query` (handles repeated keys — `?sectors=AI&sectors=SaaS` → `['AI','SaaS']`) and hydrate filter store
    - Watch all 9 filter refs: on change, call `router.push({ query })` with repeated-key serialization
- Wire `filteredCompanies` computed in `goed/src/stores/startups.js`:
  - Apply all 9 filters from `useFiltersStore`:
    1. `sectors` — `sectors.length === 0 || sectors.includes(c.sector)`
    2. `stages` — same pattern on `c.stage`
    3. `employeeRanges` — same on `c.employee_range`
    4. `isHiring` — `!isHiring || c.is_hiring === true`
    5. `foundedYearRange` — `c.founded_year >= min && c.founded_year <= max`
    6. `fundingStages` — same pattern on `c.funding_stage`
    7. `businessTypes` — same on `c.business_type`
    8. `regions` — same on `c.region`
    9. `investors` — `investors.length === 0 || investors.some(i => c.investors?.includes(i))`
- Update `goed/src/views/MapView.vue` to render `<FilterSidebar />` on the left.

**Success Criteria:**

- Toggling any filter (sector / stage / employee range / hiring / region / investor / founded year) immediately updates the visible pins on the map and the numbers in the ecosystem stats bar.
- The URL reflects current filter state in repeated-key format (`?sectors=B2B+Software&sectors=FinTech&isHiring=true`); copying that URL and pasting it into a new tab restores the same filter state on load.
- "Clear all" resets every filter and removes all query params from the URL.
- Founded year slider min/max bounds match the actual min/max of `founded_year` in the seeded dataset (not hardcoded values).
- Investor filter options are derived dynamically from `companies` and sorted alphabetically.
- The map pin layer reactively shrinks/grows as filters narrow or widen the result set.

---

### Phase 4: Cluster Rendering & Polish

Add zoom-out clustering with hover-preview logos, wire `<ol-source-cluster>` into `UtahMap.vue`, and apply final visual polish so the page lands with hackathon-worthy "5-second wow."

**Tasks:**

- Create `goed/src/components/map/PinCluster.vue`:
  - Props: `companies` (array), `count` (number)
  - Computed: `displayCount`, `previewCompanies` (first 3), `previewLogoUrls` (via `useLogoDev`), `clusterClasses`
  - Template: circular marker on `utah-blue` background with white count badge
  - Hover state: shows up to 3 logo previews fanning out (CSS transitions OK, GSAP optional)
- Update `goed/src/components/map/UtahMap.vue`:
  - Wrap vector source in `<ol-source-cluster>` with appropriate `distance` prop (e.g., 40px)
  - Style function: render `<CompanyPin>` when feature has 1 child company, render `<PinCluster>` when feature has >1
  - Selecting a cluster zooms in (incremental) rather than firing `selectCompany`
  - Selecting a single pin still fires `selectCompany`
- Final layout pass on `goed/src/views/MapView.vue`:
  - Three-zone layout: filter sidebar left (collapsible), map fills remaining space, drawer slides over right side as overlay
  - Ecosystem stats bar pinned above map (or below — chosen for visual balance)
  - Header / branding row if applicable
  - Smooth transitions on sidebar collapse, drawer open/close, filter changes
  - Verify Tailwind tokens used everywhere (no raw hex)
  - Verify no `console.log` calls remain
- Polish pass on `CompanyPin.vue`: ensure ring, shadow, and hover/active scale feel premium.
- Polish pass on `EcosystemStatsBar.vue`: typography, number emphasis, sector breakdown spacing.

**Success Criteria:**

- Zooming out causes nearby pins to cluster into a single circular marker showing the count; zooming back in re-explodes them into individual logo pins.
- Hovering a cluster reveals up to 3 logo previews of the companies inside it.
- Clicking a cluster zooms the map in (does not open the drawer); clicking a single pin still opens the drawer.
- The page achieves "5-second wow": a fresh visitor lands, the Utah map fits the viewport with logos scattered across all regions, the stats bar communicates the ecosystem size, and the visual feels polished (consistent spacing, brand colors, smooth transitions).
- No raw hex strings anywhere; all colors are Tailwind tokens.
- No `console.log` calls remain in any committed file.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `goed/src/composables/useLogoDev.js` | Create | Logo URL helper with module-level memoization |
| `goed/src/components/map/UtahMap.vue` | Create | OpenLayers map with OSM tiles, vector pins, clustering, select interaction |
| `goed/src/components/map/CompanyPin.vue` | Create | Individual logo pin with monogram fallback and active state |
| `goed/src/components/map/PinCluster.vue` | Create | Cluster marker with count + hover logo previews |
| `goed/src/components/map/EcosystemStatsBar.vue` | Create | Live stats bar reactive to `filteredCompanies` |
| `goed/src/components/drawer/CompanyDrawer.vue` | Create | GSAP slide-in profile panel |
| `goed/src/components/filters/FilterSidebar.vue` | Create | Sidebar shell + URL sync |
| `goed/src/components/filters/SectorFilter.vue` | Create | Multi-select sector checkboxes |
| `goed/src/components/filters/StageFilter.vue` | Create | Multi-select stage checkboxes |
| `goed/src/components/filters/EmployeeRangeFilter.vue` | Create | Multi-select employee range checkboxes |
| `goed/src/components/filters/HiringFilter.vue` | Create | "Hiring now only" toggle |
| `goed/src/components/filters/RegionFilter.vue` | Create | Multi-select region checkboxes |
| `goed/src/components/filters/InvestorFilter.vue` | Create | Multi-select investor checkboxes (derived from dataset) |
| `goed/src/components/filters/FoundedYearFilter.vue` | Create | Range slider with computed min/max bounds |
| `goed/src/stores/startups.js` | Modify | Add `selectedCompany`, `selectCompany`, `clearSelection`; wire `filteredCompanies` to apply all 9 filters |
| `goed/src/stores/filters.js` | Modify | Wire URL sync (parse on mount, push on change) |
| `goed/src/views/MapView.vue` | Modify | Compose `<UtahMap />`, `<FilterSidebar />`, `<CompanyDrawer />`, `<EcosystemStatsBar />`; call `fetchAll()` on mount |

---

## Testing Strategy

**No automated tests this feature** — hackathon scope. Verification is observable behavior only. Each phase's Success Criteria above doubles as a manual verification checklist.

### Manual Verification Walkthrough

After all 4 phases:
1. `npm run dev` in `goed/`, navigate to `/map`.
2. Confirm map loads fitted to Utah with 96 logo pins (or monogram fallbacks) visible within ~2 seconds.
3. Click any pin → drawer slides in from right with full profile; close button or click-outside dismisses it.
4. Open the filter sidebar, toggle "Hiring now only" → pin count drops, stats bar updates, URL gains `?isHiring=true`.
5. Add sector and region filters → repeated-key URL params appear; map narrows.
6. Copy the URL into a new tab → identical filter state restored on load.
7. Zoom out → pins cluster into circular markers with count; hover one → preview logos appear.
8. Click a cluster → map zooms in; click a single pin → drawer opens.
9. "Clear all" filters → all pins return, URL is clean.
10. Eyeball test: does it land with "wow" within 5 seconds?

---

## Dependencies

### Prerequisites

- **Feature 0001 (Map Foundation — Infrastructure & Data Import) must be complete.** Specifically required from 0001:
  - npm deps installed (`tailwindcss`, `@supabase/supabase-js`, `gsap`, `vue3-openlayers`, `ol`)
  - Tailwind configured with Utah brand tokens (`utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`)
  - Supabase client singleton at `goed/src/lib/supabase.js`
  - `map_startups` table populated with 96 geocoded companies
  - `useStartupsStore` at `goed/src/stores/startups.js` exposing `companies`, `isLoading`, `error`, `fetchAll()`, `filteredCompanies`
  - `useFiltersStore` at `goed/src/stores/filters.js` exposing all 9 filter refs and `clearAll()`
  - `goed/src/views/MapView.vue` exists as empty shell
  - All 6 routes registered, app boots cleanly

### External Dependencies

- Logo.dev — `VITE_LOGO_DEV_TOKEN` must be set in `.env` for logo URLs to resolve. Monogram fallback covers the case where logos fail or token is missing in dev.
- OSM tile server — public endpoint, no auth required.

### Blocking / Blocked By

- **Blocked by:** Feature 0001 (must be complete first)
- **Blocks:** Milestone 3 (AI onboarding / submission), Milestone 4 (claim flow), Milestone 6 (admin UI), Milestones 7+ (Founder's Navigator, subscriptions, etc.) — all rely on a working map page.

---

## Open Questions

- Should the filter sidebar default to expanded or collapsed on initial load? (Lean expanded for "wow" but collapsed gives more map real estate.)
- Stats bar position — above or below the map? (Visual call during Phase 4 polish.)
- Cluster `distance` value tuning — start at 40px, adjust during Phase 4 based on visual density.
- Click-outside-drawer detection — overlay backdrop vs map-area handler? (Overlay is simpler; map-area feels more native. Decide in Phase 2.)
