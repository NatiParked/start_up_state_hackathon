# Feature Plan: Pinia Stores, Router & Deploy Config (Phase 4 of Feature 0001)

## Phase Goal

Wire the application's data layer (`useStartupsStore`, `useFiltersStore`), register all 6 routes against placeholder views, and add the Netlify SPA configuration so the app is fully navigable end-to-end and deployable to Netlify.

**Purpose:** This is the final phase of Feature 0001 (Map Foundation). After this phase, every route resolves to a view, the store can pull seed data from Supabase, and a `git push` would deploy successfully. Feature 0002 (Map Rendering) can then plug into the store with no plumbing work.

**Output:** Two Pinia stores, three view components, a fully-wired router, and `netlify.toml` at repo root.

---

## Must-Haves (Goal-Backward)

### Observable Truths

When this phase is complete, the following must all be true:

- Visiting `/` in the running dev server resolves to `MapView` (page shell with empty map mount point).
- Visiting `/navigator` resolves to `NavigatorView` (placeholder).
- Visiting `/submit` resolves to `PlaceholderView` rendering "Submit a Company".
- Visiting `/admin` resolves to `PlaceholderView` rendering "Admin".
- Visiting `/roadmap` resolves to `PlaceholderView` rendering "Roadmap".
- Visiting `/subscribe` resolves to `PlaceholderView` rendering "Subscribe".
- Calling `useStartupsStore().fetchAll()` from devtools queries `map_startups`, populates `companies.value`, toggles `isLoading` true → false, and sets `error` to null on success.
- Calling `useStartupsStore().fetchAll()` against an unreachable Supabase sets `error.value` and still clears `isLoading`.
- Calling `useFiltersStore().clearAll()` after mutating filters resets all 9 filter refs to their empty/null defaults.
- `netlify.toml` exists at repo root with `base = "goed/"`, `publish = "dist"`, `command = "npm run build"`, and the SPA fallback redirect `from = "/*"` → `to = "/index.html"` with `status = 200`.
- `npm run build` inside `goed/` still succeeds with the new files in place.

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `goed/src/stores/startups.js` | Pinia store managing the seed company list | `useStartupsStore` (named export) |
| `goed/src/stores/filters.js` | Pinia store managing 9 filter refs + `clearAll` | `useFiltersStore` (named export) |
| `goed/src/views/PlaceholderView.vue` | "Coming soon" view for unimplemented routes; takes `title` prop | default export (component) |
| `goed/src/views/MapView.vue` | Page shell for `/` with an empty mount point for the future map | default export (component) |
| `goed/src/views/NavigatorView.vue` | Placeholder for the Founder's Navigator product | default export (component) |
| `goed/src/router/index.js` (modify) | Six routes registered, lazy-loaded, PascalCase names | default export (router instance) |
| `netlify.toml` (repo root) | Netlify build config + SPA fallback | n/a (TOML config) |

### Key Links

| From | To | Via |
|------|-----|-----|
| `useStartupsStore.fetchAll()` | `map_startups` table | `supabase.from('map_startups').select('*')` (named import from `@/lib/supabase`) |
| `router/index.js` | `MapView`, `NavigatorView`, `PlaceholderView` | Lazy `() => import('@/views/...Vue')` |
| `/submit`, `/admin`, `/roadmap`, `/subscribe` route entries | Single `PlaceholderView` component | `props: { title: '...' }` on the route definition |
| Netlify deploy | `goed/dist/index.html` for any path | `[[redirects]]` SPA fallback in `netlify.toml` |

---

## Dependency Graph

```
Task 4.1 (startups store)         — needs: nothing (Phase 1 supabase.js exists)
Task 4.2 (filters store)          — needs: nothing
Task 4.3 (PlaceholderView)        — needs: nothing
Task 4.4 (MapView)                — needs: nothing
Task 4.5 (NavigatorView)          — needs: nothing
Task 4.6 (netlify.toml)           — needs: nothing

Task 4.7 (router/index.js)        — needs: 4.3, 4.4, 4.5 (lazy imports must resolve)
```

Tasks 4.1 - 4.6 are independent and can execute in parallel. Task 4.7 must run after the three view files exist (otherwise the dynamic imports will fail at build time).

---

## Sequence Summary

| Sequence | Tasks | Parallel? | Notes |
|----------|-------|-----------|-------|
| 1 | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 | Yes | All are file creations with no inter-task dependencies |
| 2 | 4.7 | n/a | Must wait for 4.3, 4.4, 4.5 (router lazy-imports them) |

---

## Tasks

### Task 4.1: Create `useStartupsStore` Pinia setup store

**Type:** auto
**Sequence:** 1
**Depends on:** none

<files>
goed/src/stores/startups.js
</files>

<action>
Create a Pinia setup-style store named `useStartupsStore` (id `'startups'`) that fetches the `map_startups` rows via the Supabase client and exposes them to consumers. Preserve `snake_case` DB column names in `companies.value` — never convert to camelCase. The `filteredCompanies` computed is a passthrough for now (filter logic lands in Feature 0002).

Use the exact pattern below. Note: setup stores require explicitly returning every state ref, action, and computed you want public.
</action>

**Exact structure:**

```js
// Manages the list of Utah seed startups fetched from Supabase.
// Used by: MapView, EcosystemStatsBar, FilterSidebar, CompanyDrawer (in Feature 0002)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useStartupsStore = defineStore('startups', () => {
  // state
  const companies = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  // getters
  const filteredCompanies = computed(() => companies.value)

  // actions
  async function fetchAll() {
    isLoading.value = true
    error.value = null
    try {
      const { data, error: dbError } = await supabase
        .from('map_startups')
        .select('*')
      if (dbError) {
        error.value = dbError
        return
      }
      companies.value = data ?? []
    } catch (e) {
      error.value = e
    } finally {
      isLoading.value = false
    }
  }

  return { companies, isLoading, error, filteredCompanies, fetchAll }
})
```

<verify>
1. File exists: `goed/src/stores/startups.js` with named export `useStartupsStore`.
2. File uses setup-style `defineStore('startups', () => { ... })` — not options style.
3. Exposes exactly: `companies`, `isLoading`, `error`, `filteredCompanies`, `fetchAll`.
4. `fetchAll` calls `supabase.from('map_startups').select('*')` (table name has the `map_` prefix).
5. `isLoading` is set to `true` before the call and cleared in `finally` (verify by reading the source).
6. No `console.log` in the file.
7. 2-space indent, single quotes, no semicolons, trailing commas.
</verify>

<done>
A consumer can `import { useStartupsStore } from '@/stores/startups'`, call `fetchAll()`, and observe `companies.value` populated with the 96 seed rows (assuming Phase 3 ran), with `isLoading` toggled and `error` left null.
</done>

---

### Task 4.2: Create `useFiltersStore` Pinia setup store

**Type:** auto
**Sequence:** 1
**Depends on:** none

<files>
goed/src/stores/filters.js
</files>

<action>
Create a Pinia setup-style store named `useFiltersStore` (id `'filters'`) holding the 9 filter refs the map sidebar will mutate. Include the convention-required `isLoading` and `error` refs even though the store is purely client-side. Implement `clearAll()` to reset every filter to its empty default (`[]` for arrays, `null` for `isHiring`, `[null, null]` for `foundedYearRange`). Stub a placeholder for URL-sync wiring as a comment block — do not implement URL sync; that lands in Feature 0002.
</action>

**Exact structure:**

```js
// Manages active filter state for the Utah Startup Map sidebar.
// 9 filter dimensions, all client-side (the 96-row dataset is small enough).
// URL-sync wiring is stubbed and intentionally deferred to Feature 0002.
// Used by: FilterSidebar and individual *Filter components (in Feature 0002)
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFiltersStore = defineStore('filters', () => {
  // state — 9 filter dimensions
  const sectors = ref([])
  const stages = ref([])
  const employeeRanges = ref([])
  const isHiring = ref(null)
  const foundedYearRange = ref([null, null])
  const fundingStages = ref([])
  const businessTypes = ref([])
  const regions = ref([])
  const investors = ref([])

  // convention-required
  const isLoading = ref(false)
  const error = ref(null)

  // actions
  function clearAll() {
    sectors.value = []
    stages.value = []
    employeeRanges.value = []
    isHiring.value = null
    foundedYearRange.value = [null, null]
    fundingStages.value = []
    businessTypes.value = []
    regions.value = []
    investors.value = []
  }

  // TODO: wire URL query-string sync (push/replace on change, read on mount) — Feature 0002.
  function syncFromUrl() { /* stub */ }
  function syncToUrl() { /* stub */ }

  return {
    sectors,
    stages,
    employeeRanges,
    isHiring,
    foundedYearRange,
    fundingStages,
    businessTypes,
    regions,
    investors,
    isLoading,
    error,
    clearAll,
    syncFromUrl,
    syncToUrl,
  }
})
```

<verify>
1. File exists: `goed/src/stores/filters.js` with named export `useFiltersStore`.
2. Setup-style `defineStore('filters', () => { ... })`.
3. All 9 filter refs are present with the exact names: `sectors`, `stages`, `employeeRanges`, `isHiring`, `foundedYearRange`, `fundingStages`, `businessTypes`, `regions`, `investors`.
4. Convention-required `isLoading: ref(false)` and `error: ref(null)` are present.
5. `clearAll()` resets each ref to its documented empty default (`[]`, `null`, or `[null, null]`).
6. `syncFromUrl` and `syncToUrl` are present as stubs (any body is acceptable, but they must be returned from the setup function).
7. No `console.log`.
8. 2-space indent, single quotes, no semicolons, trailing commas.
</verify>

<done>
A consumer can `import { useFiltersStore } from '@/stores/filters'`, mutate any of the 9 filter refs, call `clearAll()`, and observe every ref reset to its empty/null default.
</done>

---

### Task 4.3: Create `PlaceholderView.vue`

**Type:** auto
**Sequence:** 1
**Depends on:** none

<files>
goed/src/views/PlaceholderView.vue
</files>

<action>
Create a single Vue SFC that accepts a `title` string prop and renders a centered "Coming soon" panel. This component is shared by `/submit`, `/admin`, `/roadmap`, and `/subscribe`. Use Tailwind utility classes only — no raw hex strings. Use brand tokens (`utah-blue`, `utah-blue-dark`) for accents. Observe SFC block order: `<script setup>` → `<template>` → `<style scoped>`. No logic in the template; if any derived label is needed, use a `computed`.
</action>

**Skeleton:**

```vue
<script setup>
defineProps({
  title: { type: String, required: true },
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-white">
    <section class="max-w-md text-center p-8 border border-utah-blue rounded">
      <h1 class="text-2xl font-semibold text-utah-blue">{{ title }}</h1>
      <p class="mt-2 text-utah-blue-dark">Coming soon.</p>
    </section>
  </main>
</template>

<style scoped></style>
```

<verify>
1. File exists: `goed/src/views/PlaceholderView.vue`.
2. SFC block order is `<script setup>` first, then `<template>`, then `<style scoped>`.
3. Uses object-form `defineProps({ title: { type: String, required: true } })` — not array form.
4. Template renders `{{ title }}` and a "Coming soon" message.
5. Uses only Tailwind utility classes (or named brand tokens). No raw hex strings (`#...`) in the template or styles.
6. No logic in the template (no ternaries, no `&&`/`||` in expressions, no method calls for derived values).
7. No `console.log`.
</verify>

<done>
The component mounts with any `title` string, displays it as the heading, and shows a "Coming soon" message styled with brand-token Tailwind classes.
</done>

---

### Task 4.4: Create `MapView.vue` page shell

**Type:** auto
**Sequence:** 1
**Depends on:** none

<files>
goed/src/views/MapView.vue
</files>

<action>
Create the page shell that will eventually host the Utah Startup Map. For this phase, render only a minimal layout with an empty `<div>` placeholder where the OpenLayers map will mount in Feature 0002. Do not import the store, the map library, or any filter components — those are next-feature concerns. Observe SFC block order. Use Tailwind utility classes for the layout container.
</action>

**Skeleton:**

```vue
<script setup>
// Map mounts here in Feature 0002 (UtahMap.vue + filter sidebar + drawer).
</script>

<template>
  <main class="min-h-screen bg-white">
    <div class="w-full h-[calc(100vh-4rem)]" data-testid="map-mount" />
  </main>
</template>

<style scoped></style>
```

<verify>
1. File exists: `goed/src/views/MapView.vue`.
2. SFC block order observed.
3. `<script setup>` body is empty (or only a comment) — no imports of stores or libraries yet.
4. `<template>` contains a single `<main>` wrapping a placeholder `<div>` (the future map mount point).
5. Tailwind utility classes only — no raw hex strings.
6. No logic in template.
7. No `console.log`.
</verify>

<done>
Navigating to `/` in the running app renders the page shell with no errors and the map mount placeholder is present in the DOM.
</done>

---

### Task 4.5: Create `NavigatorView.vue` placeholder

**Type:** auto
**Sequence:** 1
**Depends on:** none

<files>
goed/src/views/NavigatorView.vue
</files>

<action>
Create a minimal placeholder for the Founder's Navigator product page. It should render a simple landing message — full intake wizard implementation is out of scope until a later feature. Observe SFC block order. Use Tailwind utility classes with brand tokens.
</action>

**Skeleton:**

```vue
<script setup>
// Founder's Navigator landing — intake wizard lands in a later feature.
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-white">
    <section class="max-w-xl text-center p-8">
      <h1 class="text-3xl font-semibold text-utah-blue">Founder's Navigator</h1>
      <p class="mt-3 text-utah-blue-dark">
        Personalized resource discovery for Utah founders. Coming soon.
      </p>
    </section>
  </main>
</template>

<style scoped></style>
```

<verify>
1. File exists: `goed/src/views/NavigatorView.vue`.
2. SFC block order observed.
3. Tailwind utility classes only — no raw hex strings.
4. No logic in template.
5. No `console.log`.
</verify>

<done>
Navigating to `/navigator` in the running app renders the placeholder landing message with brand-token styling.
</done>

---

### Task 4.6: Create `netlify.toml` at repo root

**Type:** auto
**Sequence:** 1
**Depends on:** none

<files>
netlify.toml
</files>

<action>
Create `netlify.toml` at the **repo root** (not inside `goed/`). It must declare `goed/` as the build base, `dist` as the publish directory, `npm run build` as the build command, and add the SPA fallback redirect so all 6 client routes resolve to `index.html` on direct hits / page refreshes.
</action>

**Exact file content:**

```toml
[build]
  base = "goed/"
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

<verify>
1. File exists at the repo root: `/home/cayden/code/start_up_state_hackathon/netlify.toml`.
2. Contains a `[build]` block with `base = "goed/"`, `publish = "dist"`, `command = "npm run build"`.
3. Contains a `[[redirects]]` block with `from = "/*"`, `to = "/index.html"`, `status = 200`.
4. File is valid TOML (no trailing junk, proper quoting on string values).
</verify>

<done>
`netlify.toml` is at the repo root with the build block (base, publish, command) and the SPA fallback redirect. A Netlify deploy from this repo would publish `goed/dist/` and serve `index.html` for any unmatched path.
</done>

---

### Task 4.7: Register all 6 routes in `router/index.js`

**Type:** auto
**Sequence:** 2
**Depends on:** Task 4.3 (`PlaceholderView.vue`), Task 4.4 (`MapView.vue`), Task 4.5 (`NavigatorView.vue`)

<files>
goed/src/router/index.js
</files>

<action>
Replace the empty `routes` array with all 6 route definitions per the ROADMAP. Lazy-load every component via dynamic `import()` (keeps the home-page bundle small and matches the project convention). Use `PascalCase` route `name` values. The four placeholder routes (`/submit`, `/admin`, `/roadmap`, `/subscribe`) all point at the same `PlaceholderView` component and pass a different `title` via static `props`. Use the `@/` alias for view paths.

Keep `createWebHistory(import.meta.env.BASE_URL)` (already in the file) and the default export.
</action>

**Exact structure:**

```js
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Map',
      component: () => import('@/views/MapView.vue'),
    },
    {
      path: '/navigator',
      name: 'Navigator',
      component: () => import('@/views/NavigatorView.vue'),
    },
    {
      path: '/submit',
      name: 'Submit',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Submit a Company' },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Admin' },
    },
    {
      path: '/roadmap',
      name: 'Roadmap',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Roadmap' },
    },
    {
      path: '/subscribe',
      name: 'Subscribe',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Subscribe' },
    },
  ],
})

export default router
```

<verify>
1. File `goed/src/router/index.js` exists and exports a router as default.
2. All 6 routes are registered with the exact paths: `/`, `/navigator`, `/submit`, `/admin`, `/roadmap`, `/subscribe`.
3. Route `name` values are PascalCase: `'Map'`, `'Navigator'`, `'Submit'`, `'Admin'`, `'Roadmap'`, `'Subscribe'`.
4. Every `component` is a lazy-loaded dynamic import using the `@/` alias.
5. `/submit`, `/admin`, `/roadmap`, `/subscribe` each pass a `props: { title: '...' }` object with the exact titles: `'Submit a Company'`, `'Admin'`, `'Roadmap'`, `'Subscribe'`.
6. `npm run build` inside `goed/` completes without errors (proves the lazy imports resolve to existing files).
7. Running `npm run dev` and visiting each of the 6 routes resolves to the correct view (manual check).
</verify>

<done>
All 6 routes are registered, lazy-loaded with PascalCase names. `npm run build` succeeds. Direct navigation to each path in dev mode renders the expected view (MapView, NavigatorView, or PlaceholderView with the route-specific title).
</done>

---

## Verification Checklist

Run all of these at the end of the phase to prove the goal is met:

- [ ] `goed/src/stores/startups.js` exports `useStartupsStore`; `fetchAll()` queries `map_startups`, populates `companies`, toggles `isLoading`, and surfaces errors via `error.value`.
- [ ] `goed/src/stores/filters.js` exports `useFiltersStore` with all 9 filter refs plus `isLoading` and `error`; `clearAll()` resets every filter to its empty default.
- [ ] `goed/src/views/PlaceholderView.vue` accepts a `title` prop and renders it inside a "Coming soon" panel.
- [ ] `goed/src/views/MapView.vue` renders a minimal page shell with a map mount placeholder.
- [ ] `goed/src/views/NavigatorView.vue` renders a placeholder landing message.
- [ ] `goed/src/router/index.js` registers all 6 routes lazy-loaded with PascalCase names; placeholder routes pass `props: { title: '...' }`.
- [ ] `netlify.toml` exists at the repo root with `[build]` (`base = "goed/"`, `publish = "dist"`, `command = "npm run build"`) and `[[redirects]]` (`from = "/*"`, `to = "/index.html"`, `status = 200`).
- [ ] `npm run build` inside `goed/` completes without errors.
- [ ] Running `npm run dev` and visiting each of `/`, `/navigator`, `/submit`, `/admin`, `/roadmap`, `/subscribe` resolves to the correct view with the correct content.
- [ ] Calling `useStartupsStore().fetchAll()` from the browser devtools after navigating to `/` populates `companies.value` with the 96 seed rows from Phase 3 (assuming Supabase env vars are set in `.env.local`).
- [ ] No `console.log` calls were committed in any of the new/modified files.
- [ ] All new `.vue` files use SFC block order `<script setup>` → `<template>` → `<style scoped>`.
- [ ] No raw hex color strings appear in any template or scoped style — only Tailwind utility classes / brand tokens.

## Success Criteria

Feature 0001 is complete when:

1. The user can `npm run dev` inside `goed/` and navigate to all 6 routes — each resolves to the correct view.
2. `useStartupsStore().fetchAll()` returns the 96 seed companies populated by Phase 3.
3. `useFiltersStore().clearAll()` resets all 9 filter refs to their empty defaults.
4. `netlify.toml` is in place at the repo root and a Netlify deploy of the repo would succeed.
5. Feature 0002 (Map Rendering) can begin with zero plumbing work: store, schema, seed data, routes, and deploy config are all wired.
