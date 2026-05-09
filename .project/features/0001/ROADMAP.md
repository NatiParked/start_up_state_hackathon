# Feature 0001: Map Foundation — Infrastructure & Data Import

> Created: 2026-05-08
> Status: Draft

## Overview

This feature establishes the infrastructure foundation for the Utah Startup Map product (Milestone 1, infrastructure half). It installs all required npm dependencies, wires Tailwind with the Utah brand tokens, configures the Supabase client, defines the database schema for `map_startups` and `map_startup_submissions`, builds the one-time seed import script that geocodes 223 companies and fetches their logos, and registers all 6 application routes with placeholder views.

By the end of this feature, the Vue app boots cleanly with all routes navigable, the Supabase database holds all 223 companies (geocoded, with logos and regions), and the `useStartupsStore` can fetch them. Map rendering itself (UtahMap.vue, CompanyPin.vue, filter sidebar, drawer) is explicitly deferred to the next feature.

## Problem Statement

The repository currently contains a bare Vue 3.5 scaffold — `App.vue` shows the default "You did it!" message, the router is empty, and the stores directory is empty. Tailwind, Supabase, the map library, and any data are all absent. Without this foundation, no map UI work can proceed: there is no database to query, no styling system, no routes to navigate, and no seed data to render.

The hackathon timeline requires that infrastructure be solid before the map rendering feature begins, because every map component depends on the Pinia store returning real, geocoded data.

## User Stories

- As a developer, I want to run `npm run dev` inside `goed/` and see all 6 routes registered and navigable so that I can begin building map components against a live shell.
- As a developer, I want to run `node scripts/import-seed-companies.js` once and have 96 fully-enriched companies in Supabase so that the map has real data to render.
- As a developer, I want a Pinia `useStartupsStore` with `fetchAll()` already working so that the map rendering feature can plug straight in without rebuilding data plumbing.
- As a developer, I want Tailwind configured with Utah brand tokens (`utah-blue`, `hiring-green`, etc.) so that all subsequent UI work uses brand-correct colors by default.
- As a developer, I want `netlify.toml` in place with SPA fallback so that deploys work end-to-end the moment the first page is built.

---

## Codebase Context

### Technology Stack

Already installed:
- Vue 3.5, Vue Router 5, Pinia 3, Vite 8
- JavaScript only (no TypeScript)
- Node ^20.19.0 || >=22.12.0, npm, ESM modules

To be installed in this feature:
- `tailwindcss`, `postcss`, `autoprefixer` — styling
- `@supabase/supabase-js` — database client
- `gsap` — installed for later animation use (not consumed in this feature)
- `vue3-openlayers`, `ol` — map library (registered as plugin; map rendering deferred)

### Relevant Directories

- `goed/` — Vue app root
- `goed/src/views/` — page-level components (MapView, NavigatorView, PlaceholderView)
- `goed/src/lib/` — service-layer modules (supabase.js client singleton)
- `goed/src/stores/` — Pinia setup stores (startups.js, filters.js)
- `goed/src/router/` — route registration
- `goed/src/styles/` — `brand.css` with Tailwind directives + brand tokens
- `goed/scripts/` — one-off import scripts (Node ESM)
- `supabase/migrations/` — SQL migration files at repo root (not inside `goed/`)
- Repo root — `netlify.toml`

### Conventions to Follow

- SFC block order: `<script setup>` → `<template>` → `<style scoped>`
- Setup-style Pinia stores; every store exposes `isLoading: ref(false)` and `error: ref(null)`
- snake_case DB column names preserved in Vue state (never converted to camelCase)
- All Map tables MUST be prefixed with `map_`
- Named exports for composables/utils, default exports for Vue components
- No barrel/index.js files — always direct imports
- JSDoc required on all exported functions in `goed/src/lib/` and `goed/src/composables/`
- Service functions in `goed/src/lib/` return `{ data, error }` shape
- 2-space indent, single quotes, no semicolons, trailing commas
- No logic in templates — use `computed()` for everything derived
- Route names: PascalCase (`'Map'`, `'Navigator'`, `'Submit'`, `'Admin'`, `'Roadmap'`, `'Subscribe'`)
- Colors: Tailwind theme tokens only — no raw hex strings in templates
- No `console.log` in committed code

---

## Implementation Plan

### Phase 1: Dependencies & Configuration

**Goal:** Install all required npm packages, configure Tailwind with Utah brand tokens, wire the Supabase client singleton, and update the app entry point and shell so the foundation is in place for everything that follows.

**Tasks:**

- Run `npm install` inside `goed/` for: `tailwindcss`, `postcss`, `autoprefixer`, `@supabase/supabase-js`, `gsap`, `vue3-openlayers`, `ol`
- Create `goed/tailwind.config.js` — Tailwind config with content globs for `./index.html` and `./src/**/*.{vue,js}`, theme extension exposing brand color tokens (`utah-blue: '#0065A4'`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`)
- Create `goed/postcss.config.js` — standard PostCSS config registering `tailwindcss` and `autoprefixer` plugins
- Create `goed/src/styles/brand.css` — file containing `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;` directives plus any global brand layer rules
- Create `goed/src/lib/supabase.js` — Supabase client singleton reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`; exports `supabase` as named export with JSDoc
- Update `goed/src/main.js` — import `./styles/brand.css`, register `vue3-openlayers` plugin via `app.use()`, keep existing Pinia + Router registration
- Update `goed/src/App.vue` — replace "You did it!" content with a minimal nav header (links to all 6 routes) and `<RouterView />`; observe SFC block order; use Tailwind classes only (no raw hex)
- Create `goed/.env.example` at `goed/` root — placeholder keys: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `VITE_LOGO_DEV_TOKEN=`

**Success Criteria:**

- Running `npm run dev` inside `goed/` starts the dev server with no errors and the app mounts in the browser.
- Running `npm run build` inside `goed/` completes without errors and produces a `dist/` folder.
- Tailwind utility classes (e.g. `bg-utah-blue`, `text-hiring-green`) render with the correct Utah brand colors when used in `App.vue`.
- Importing `supabase` from `@/lib/supabase` (or relative path) returns a configured Supabase client instance when env vars are set.

---

### Phase 2: Database Schema & Migration

**Goal:** Define the Supabase database schema for the Map product so seed data has a destination and the store has a queryable shape. Establish RLS policies and indexes that match query patterns the upcoming map rendering feature will use.

**Tasks:**

- Create `supabase/migrations/0001_init.sql` at repo root containing:
  - `create table map_startups (...)` with the full column list per the spec: `id uuid primary key default gen_random_uuid()`, `name text not null`, `description`, `website`, `linkedin`, `address`, `city`, `lat float8`, `lng float8`, `region`, `sector`, `stage`, `funding_stage`, `business_type`, `employee_range`, `founded_year int`, `is_hiring boolean default false`, `job_titles text[]`, `careers_url`, `logo_url`, `google_place_id`, `google_rating numeric`, `phone`, `investors text[]`, `total_raised`, `verified boolean default true`, `last_refreshed_at timestamptz`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`
  - `create table map_startup_submissions (...)` — captures user-submitted companies pending review (mirrors core fields plus a `status` and `submitted_at` for moderation)
  - B-tree indexes on `map_startups(sector)`, `map_startups(stage)`, `map_startups(region)`
  - GIN index on `map_startups(investors)` for array containment (`@>`) queries
  - Enable RLS on both tables: `alter table map_startups enable row level security;` and same for submissions
  - RLS policy on `map_startups`: public `select` allowed (read-only for anon)
  - RLS policy on `map_startup_submissions`: public `insert` allowed (anon can submit), no public select
- Apply the migration to the Supabase project (via Supabase CLI `supabase db push` or by pasting into SQL editor — whichever the developer is using locally)

**Success Criteria:**

- The `map_startups` table exists in Supabase with all 28 columns matching the spec exactly.
- The `map_startup_submissions` table exists with submission-tracking columns.
- An anonymous client can `select * from map_startups` (returns empty rows initially) and is blocked from `insert/update/delete` on it.
- An anonymous client can `insert` into `map_startup_submissions` but cannot `select` from it.
- Indexes on `sector`, `stage`, `region`, and `investors` are visible in the Supabase table editor or via `\d map_startups` in psql.

---

### Phase 3: Seed Import Script

**Goal:** Build the one-time Node script that fetches the published Google Sheet, geocodes each company via Nominatim, derives its Utah region, fetches a logo URL from logo.dev, and inserts all 96 rows into `map_startups`. After running this script, the map has real data to render.

**Tasks:**

- Create `goed/scripts/import-seed-companies.js` — Node ESM script that:
  - Loads env vars from `goed/.env.local` (Supabase URL, anon/service key, `VITE_LOGO_DEV_TOKEN`)
  - Fetches the published Google Sheet CSV using the `gid=0` published-to-web URL pattern for sheet `1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk`
  - Parses the CSV (column headers: Display Type, LinkedIn Link, Startup Name, Full Address, Description, Website, Stage, # of Employees, Section/Sector)
  - For each row:
    - Geocodes `Full Address` via Nominatim (`https://nominatim.openstreetmap.org/search?q=<addr>&format=json`) with `User-Agent: goed-hackathon` header; rate-limited to 1 req/sec
    - On geocode failure, sets `lat`/`lng` to null and logs a warning to a local file (not console)
    - Derives `region` from lat/lng using the Utah bounding boxes (Salt Lake City metro, Utah Valley, Ogden/Weber, St. George, Cache Valley, Other Utah)
    - Extracts the bare domain from `Website` and constructs `logo_url = https://img.logo.dev/{domain}?token={LOGO_DEV_TOKEN}`
    - Maps Sheet columns to DB columns: `Startup Name → name`, `Full Address → address`, `Description → description`, `Website → website`, `LinkedIn Link → linkedin`, `Stage → stage`, `# of Employees → employee_range`, `Section/Sector → sector`
    - Sets `verified = true`, `is_hiring = false` by default
  - Inserts all rows into `map_startups` via the Supabase client (batch insert preferred)
  - Reports final summary to stdout: total rows imported, rows that failed geocoding, rows that failed insert
- Add a brief usage note at the top of the script as a JSDoc-style header block
- Ensure the script can be re-run safely (either truncates the table first or upserts on a stable key) — choose truncate-and-reload for simplicity in hackathon context

**Success Criteria:**

- Running `node scripts/import-seed-companies.js` from inside `goed/` completes end-to-end and prints a summary line indicating success.
- After the script completes, `select count(*) from map_startups` in Supabase returns 223.
- Spot-checking 3 random rows in the Supabase table editor shows non-null `lat`, `lng`, `region`, `sector`, and `logo_url` populated correctly (lat/lng inside Utah bounding box; logo URL resolves to an actual image when opened).
- Re-running the script does not produce duplicate rows (count remains 223).

---

### Phase 4: Pinia Stores, Router & Deploy Config

**Goal:** Wire the application's data layer (`useStartupsStore`, `useFiltersStore`), register all 6 routes with placeholder views, and add the Netlify SPA configuration so the app is fully navigable and deployable.

**Tasks:**

- Create `goed/src/stores/startups.js` — Pinia setup store `useStartupsStore`:
  - State refs: `companies = ref([])`, `isLoading = ref(false)`, `error = ref(null)`
  - Action: `fetchAll()` — sets `isLoading`, calls `supabase.from('map_startups').select('*')`, populates `companies` on success, sets `error` on failure, always clears `isLoading`
  - Computed: `filteredCompanies` — returns `companies.value` unchanged for now (filter logic deferred to map rendering feature)
  - Returns all state, action, and computed via the setup return
- Create `goed/src/stores/filters.js` — Pinia setup store `useFiltersStore`:
  - State refs (9): `sectors = ref([])`, `stages = ref([])`, `employeeRanges = ref([])`, `isHiring = ref(null)`, `foundedYearRange = ref([null, null])`, `fundingStages = ref([])`, `businessTypes = ref([])`, `regions = ref([])`, `investors = ref([])`
  - Required: `isLoading = ref(false)`, `error = ref(null)` (per convention)
  - Action: `clearAll()` — resets all 9 filter refs to empty/null defaults
  - Leave URL-sync structure stubbed (function names/comments) but not yet wired — wiring lives in the next feature
- Create `goed/src/views/PlaceholderView.vue` — accepts a `title` prop, renders a "Coming soon" panel using brand tokens; SFC block order observed
- Create `goed/src/views/MapView.vue` — page shell with an empty `<div>` placeholder where the map will mount in the next feature; minimal layout only
- Create `goed/src/views/NavigatorView.vue` — placeholder page for the Founder's Navigator product (will be expanded in a later feature)
- Update `goed/src/router/index.js` — register all 6 routes, lazy-loaded, PascalCase names:
  - `/` → name `'Map'` → `MapView`
  - `/navigator` → name `'Navigator'` → `NavigatorView`
  - `/submit` → name `'Submit'` → `PlaceholderView` (props: `{ title: 'Submit a Company' }`)
  - `/admin` → name `'Admin'` → `PlaceholderView` (props: `{ title: 'Admin' }`)
  - `/roadmap` → name `'Roadmap'` → `PlaceholderView` (props: `{ title: 'Roadmap' }`)
  - `/subscribe` → name `'Subscribe'` → `PlaceholderView` (props: `{ title: 'Subscribe' }`)
- Create `netlify.toml` at repo root:
  - `[build]` block: `base = "goed/"`, `publish = "dist"`, `command = "npm run build"`
  - `[[redirects]]` block: SPA fallback `from = "/*"`, `to = "/index.html"`, `status = 200`

**Success Criteria:**

- Navigating to each of `/`, `/navigator`, `/submit`, `/admin`, `/roadmap`, `/subscribe` in the running dev server resolves to the correct view (MapView, NavigatorView, or PlaceholderView with the right title).
- Calling `useStartupsStore().fetchAll()` from a test invocation (e.g. browser devtools) returns the 223 companies and populates `companies.value`; `isLoading` toggles correctly.
- `useFiltersStore().clearAll()` resets all 9 filter refs to their empty defaults when called after they've been mutated.
- `netlify.toml` exists at the repo root and contains both the build block (with `base = "goed/"`) and the SPA fallback redirect.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `goed/package.json` | Modify | Add Tailwind, Supabase, GSAP, vue3-openlayers, ol deps via npm install |
| `goed/tailwind.config.js` | Create | Tailwind config with Utah brand color tokens |
| `goed/postcss.config.js` | Create | PostCSS config registering Tailwind + Autoprefixer |
| `goed/src/styles/brand.css` | Create | Tailwind directives + global brand layer |
| `goed/src/lib/supabase.js` | Create | Supabase client singleton (named export) |
| `goed/src/main.js` | Modify | Import brand.css, register vue3-openlayers plugin |
| `goed/src/App.vue` | Modify | Minimal nav header + RouterView |
| `goed/.env.example` | Create | Placeholder env vars (Supabase URL/key, logo.dev token) |
| `supabase/migrations/0001_init.sql` | Create | map_startups + map_startup_submissions tables, RLS, indexes |
| `goed/scripts/import-seed-companies.js` | Create | One-time seed import (CSV → geocode → logo → DB) |
| `goed/src/stores/startups.js` | Create | useStartupsStore Pinia setup store |
| `goed/src/stores/filters.js` | Create | useFiltersStore with 9 filter refs + clearAll |
| `goed/src/router/index.js` | Modify | Register all 6 routes, lazy-loaded, PascalCase names |
| `goed/src/views/PlaceholderView.vue` | Create | "Coming soon" view with title prop |
| `goed/src/views/MapView.vue` | Create | Page shell (empty div, map deferred) |
| `goed/src/views/NavigatorView.vue` | Create | Placeholder for Founder's Navigator product |
| `netlify.toml` | Create | Repo-root SPA fallback + build config |

---

## Testing Strategy

No automated test framework is in scope during the hackathon. Verification is manual and observable, executed at the end of each phase per the success criteria above.

### Manual Verification Checklist (end of feature)

- `npm run dev` inside `goed/` starts cleanly and the app mounts.
- `npm run build` inside `goed/` completes without errors.
- All 6 routes navigate correctly in the running app; placeholder routes render the `PlaceholderView` with the correct title prop.
- `node scripts/import-seed-companies.js` from `goed/` populates `map_startups` with all 223 companies.
- Spot-check in Supabase: 3 random rows have non-null `lat`, `lng`, `region`, `sector`, `logo_url`.
- `useStartupsStore().fetchAll()` (called from devtools or a temporary debug button) returns the 96 companies.
- `netlify.toml` exists at repo root with both build config and SPA redirect.

---

## Dependencies

### Prerequisites

- Vue 3.5 scaffold with Vite already in place (`goed/`) — confirmed.
- Supabase project provisioned with URL and anon key available for `.env.local`.
- logo.dev API token available for `.env.local`.

### External Dependencies

- npm packages: `tailwindcss`, `postcss`, `autoprefixer`, `@supabase/supabase-js`, `gsap`, `vue3-openlayers`, `ol`
- External APIs (consumed only by import script): Nominatim (geocoding), logo.dev (logos), Google Sheets (published CSV)

### Blocking/Blocked By

- **Blocks:** Feature 0002 (Map Rendering — UtahMap, CompanyPin, PinCluster, filter sidebar, drawer) cannot proceed without the store, schema, and seed data this feature provides.
- **Blocked by:** None — this is the first implementation feature.

---

## Open Questions

- Should the import script truncate `map_startups` before insert, or upsert on `name` as a stable key? (Roadmap currently calls for truncate-and-reload; revisit if duplicate names exist in the sheet.)
- For Supabase service-role key usage in the import script, should the script require the service-role key (to bypass RLS for inserts) or should we add a temporary RLS insert policy and use the anon key? (Default assumption: service-role key from `.env.local`, never committed.)
- Does the `map_startup_submissions` table need a `reviewed_at` / `reviewed_by` field at this point, or can those be added in a later moderation feature?
