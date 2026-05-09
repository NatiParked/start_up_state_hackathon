# Feature 0001 — Phase 1: Dependencies & Configuration

> Feature: 0001 — Map Foundation — Infrastructure & Data Import
> Phase: 1 of 4

## Phase Goal

Install required npm packages, configure Tailwind with Utah brand tokens, wire the Supabase client singleton, and update the app entry point and shell so the foundation is ready for the database, seed, and routing phases that follow.

## Must-Haves (Goal-Backward)

When this phase is done, the following must be TRUE:

### Observable Truths

- `npm run dev` inside `goed/` starts the dev server with no errors and the app mounts in the browser.
- `npm run build` inside `goed/` completes without errors and produces a `goed/dist/` folder.
- Tailwind utility classes such as `bg-utah-blue`, `text-hiring-green`, `text-error-red`, `text-warning-yellow`, and `bg-utah-blue-dark` render with the correct Utah brand colors when used in `App.vue`.
- Importing `supabase` from `@/lib/supabase` returns a configured Supabase client instance when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `goed/.env.local`.
- The app shell renders a minimal nav header with links to all six future routes (`/`, `/navigator`, `/submit`, `/admin`, `/roadmap`, `/subscribe`) and a `<RouterView />` outlet — using Tailwind classes only (no raw hex strings).
- `vue3-openlayers` is registered globally on the app via `app.use()` so map components in later phases can mount without additional plugin wiring.

### Required Artifacts

| Path | Action | Provides |
|------|--------|----------|
| `goed/package.json` | Modify | Declares 7 new deps: tailwindcss, postcss, autoprefixer, @supabase/supabase-js, gsap, vue3-openlayers, ol |
| `goed/tailwind.config.js` | Create | Tailwind config: `content` globs + `theme.extend.colors` with Utah brand tokens |
| `goed/postcss.config.js` | Create | PostCSS config registering tailwindcss + autoprefixer |
| `goed/src/styles/brand.css` | Create | `@tailwind base/components/utilities` directives |
| `goed/src/lib/supabase.js` | Create | Named export `supabase` (Supabase client singleton, JSDoc'd) |
| `goed/src/main.js` | Modify | Imports `./styles/brand.css`, registers `vue3-openlayers` plugin |
| `goed/src/App.vue` | Modify | Nav header (6 links) + `<RouterView />`, Tailwind classes only |
| `goed/.env.example` | Create | Placeholder keys: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `VITE_LOGO_DEV_TOKEN=` |

### Key Links

| From | To | Via |
|------|----|-----|
| `goed/src/main.js` | Tailwind utility classes resolving in browser | `import './styles/brand.css'` (must execute before mount) |
| `goed/src/main.js` | `vue3-openlayers` global components | `app.use(OpenLayersMap)` before `app.mount('#app')` |
| `goed/src/lib/supabase.js` | Supabase project | `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| `goed/src/App.vue` | Brand colors | Tailwind classes resolving to tokens defined in `tailwind.config.js` |
| `goed/src/App.vue` | Routed views | `<RouterView />` (router routes registered in Phase 4 — links may not resolve yet, that is expected) |

---

## Tasks

### Task 1.1: Install required npm dependencies

**Sequence:** 1
**Depends on:** —
**Type:** auto
**Status:** complete
Completed: 2026-05-08

**Files:**
- `goed/package.json` (modified by npm)
- `goed/package-lock.json` (modified by npm)
- `goed/node_modules/` (regenerated)

**Steps:**

1. From inside `goed/`, install all seven dependencies in a single command. Place `tailwindcss`, `postcss`, and `autoprefixer` in `devDependencies` (the standard Tailwind setup); the rest go in `dependencies`.
2. Pin Tailwind to v3.x (e.g. `tailwindcss@^3.4.0`). The rest of this phase assumes Tailwind v3 — v4 changed config format and PostCSS plugin name and would break Tasks 1.2 and 1.3.
3. Verify the install completed without unmet peer-dependency errors.

**Done when:**
- `goed/package.json` lists all seven packages across `dependencies` / `devDependencies`.
- `npm ls tailwindcss @supabase/supabase-js gsap vue3-openlayers ol postcss autoprefixer` from inside `goed/` resolves all seven without `UNMET DEPENDENCY` errors.
- `goed/package-lock.json` has been updated.

---

### Task 1.2: Create config files, brand CSS, Supabase client, and .env.example

**Sequence:** 2
**Depends on:** Task 1.1
**Type:** auto

**Files (all created):**
- `goed/tailwind.config.js`
- `goed/postcss.config.js`
- `goed/src/styles/brand.css`
- `goed/src/lib/supabase.js`
- `goed/.env.example`

**Steps:**

1. **`goed/tailwind.config.js`** — Use ESM `export default` (the project has `"type": "module"`). Set:
   - `content`: `['./index.html', './src/**/*.{vue,js}']`
   - `theme.extend.colors` with these exact tokens (locked by `STARTUP_MAP.md` and CONVENTIONS.md):
     - `'utah-blue': '#0065A4'`
     - `'utah-blue-dark': '#004d7a'`
     - `'hiring-green': '#16A34A'`
     - `'error-red': '#DC2626'`
     - `'warning-yellow': '#CA8A04'`
   - `plugins: []`
   - 2-space indent, single quotes, no semicolons, trailing commas.

2. **`goed/postcss.config.js`** — ESM `export default` with `tailwindcss` and `autoprefixer` registered under `plugins` (object form: `{ tailwindcss: {}, autoprefixer: {} }`). 2-space indent, single quotes, no semicolons, trailing commas.

3. **`goed/src/styles/brand.css`** — Three Tailwind directives in order: `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`. No additional layer rules required for Phase 1 — keep the file minimal.

4. **`goed/src/lib/supabase.js`** — Supabase client singleton:
   - Import `createClient` from `@supabase/supabase-js`.
   - Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`.
   - Export a named `supabase` constant created via `createClient(url, anonKey)`.
   - Add a JSDoc block above the export describing the singleton's purpose, env vars consumed, and `@type` annotation. JSDoc on exports from `goed/src/lib/` is mandatory per CONVENTIONS.md.
   - 2-space indent, single quotes, no semicolons, trailing commas. No `console.log`.

5. **`goed/.env.example`** at `goed/` root (NOT repo root) with three lines, values empty:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_LOGO_DEV_TOKEN=
   ```

**Done when:**
- All five files exist at the exact paths above.
- `goed/tailwind.config.js` contains exactly the five color tokens with the exact hex values listed.
- `goed/src/lib/supabase.js` has a JSDoc block on the `supabase` named export and uses `import.meta.env` (not `process.env`).
- No file contains `console.log`.
- All files follow formatting conventions (2-space indent, single quotes, no semicolons, trailing commas).

---

### Task 1.3: Wire main.js + App.vue to use the new foundation

**Sequence:** 3
**Depends on:** Task 1.2
**Type:** auto
**Status:** complete
Completed: 2026-05-08

**Files (modified):**
- `goed/src/main.js`
- `goed/src/App.vue`

**Steps:**

1. **`goed/src/main.js`:**
   - Add `import OpenLayersMap from 'vue3-openlayers'` to the external-packages import group (alongside `vue`, `pinia`).
   - Add `import 'vue3-openlayers/styles.css'` (or whichever CSS path the installed version of `vue3-openlayers` documents — verify against the package's README in `node_modules/`) so OpenLayers default styles are loaded.
   - Add `import './styles/brand.css'` in the local-imports group, separated from external imports by a blank line per CONVENTIONS.md import order.
   - Register the plugin: `app.use(OpenLayersMap)` BEFORE `app.mount('#app')`. Keep the existing `app.use(createPinia())` and `app.use(router)` calls intact and in their existing relative order.
   - Do NOT remove or reorder the existing Pinia and Router registration.

2. **`goed/src/App.vue`:**
   - Replace the placeholder "You did it!" content entirely.
   - Maintain SFC block order: `<script setup>` first, then `<template>`, then `<style scoped>`.
   - `<script setup>` may be empty for now — no logic is needed for a static nav shell.
   - `<template>` must contain:
     - A semantic `<header>` with a `<nav>` element.
     - Six `<RouterLink>` elements pointing to `/`, `/navigator`, `/submit`, `/admin`, `/roadmap`, `/subscribe` with human-readable labels (Map, Navigator, Submit, Admin, Roadmap, Subscribe).
     - A `<main>` element wrapping `<RouterView />`.
   - Style with Tailwind utility classes only. Use brand tokens: `bg-utah-blue` for the header background, `text-white` for nav text, hover states may use `text-hiring-green` or `bg-utah-blue-dark`. NO raw hex strings (no `#0065A4`, no `bg-[#...]`, no `style="color: #..."`).
   - No logic in templates: no ternaries, no `&&`, no method calls inside the template. Static class strings only.
   - `<style scoped>` may be empty.
   - Note: the router's `routes` array is currently empty (Phase 4 registers all six). `<RouterLink>` elements must still render in the DOM as anchors without throwing — Vue Router tolerates unmatched links by rendering them and warning at navigation time.

**Done when:**
- `goed/src/main.js` imports `./styles/brand.css` and registers `vue3-openlayers` via `app.use(...)`, with Pinia and Router still registered.
- `goed/src/App.vue` no longer contains the string "You did it!".
- `goed/src/App.vue` contains six `<RouterLink>` elements, a `<RouterView />`, and uses only Tailwind classes (a grep for `#` in the file finds no raw hex color codes).
- `npm run dev` starts the Vite dev server with no errors; visiting the dev URL renders the nav header with brand-blue background.
- `npm run build` completes without errors and produces `goed/dist/`.
- A quick visual check (or DOM inspection) confirms `bg-utah-blue` on the header resolves to `#0065A4`.

---

## Sequence Summary

| Sequence | Task(s) | Parallel? | Rationale |
|----------|---------|-----------|-----------|
| 1 | Task 1.1 (npm install) | No — runs alone | Every other task requires installed packages. |
| 2 | Task 1.2 (config + brand.css + supabase client + .env.example) | Single task; the five files have no inter-dependencies | All five files share the dependency on Task 1.1 and are small enough to be one logical unit. |
| 3 | Task 1.3 (main.js + App.vue updates) | No | Both file edits are tightly coupled (App.vue needs Tailwind to be wired through main.js; main.js needs `brand.css` and `vue3-openlayers` from prior steps). |

The three tasks must run strictly in sequence: 1.1 → 1.2 → 1.3.

## Files Summary

| File | Action | Owner Task |
|------|--------|------------|
| `goed/package.json` | Modify (via npm) | 1.1 |
| `goed/package-lock.json` | Modify (via npm) | 1.1 |
| `goed/tailwind.config.js` | Create | 1.2 |
| `goed/postcss.config.js` | Create | 1.2 |
| `goed/src/styles/brand.css` | Create | 1.2 |
| `goed/src/lib/supabase.js` | Create | 1.2 |
| `goed/.env.example` | Create | 1.2 |
| `goed/src/main.js` | Modify | 1.3 |
| `goed/src/App.vue` | Modify | 1.3 |

## Verification Checklist

Run all of these from inside `goed/` after Task 1.3 completes:

- [ ] `npm ls tailwindcss @supabase/supabase-js gsap vue3-openlayers ol postcss autoprefixer` resolves all seven without errors.
- [ ] `goed/tailwind.config.js`, `goed/postcss.config.js`, `goed/src/styles/brand.css`, `goed/src/lib/supabase.js`, and `goed/.env.example` all exist.
- [ ] `goed/.env.example` contains exactly three lines: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `VITE_LOGO_DEV_TOKEN=`.
- [ ] `goed/tailwind.config.js` contains the five locked color tokens with exact hex values: `#0065A4`, `#004d7a`, `#16A34A`, `#DC2626`, `#CA8A04`.
- [ ] `goed/src/lib/supabase.js` has a JSDoc block on the `supabase` named export and reads from `import.meta.env`.
- [ ] `goed/src/main.js` contains `import './styles/brand.css'` and `app.use(OpenLayersMap)` and still registers Pinia and Router.
- [ ] `goed/src/App.vue` does not contain the string "You did it!", has six `<RouterLink>` elements, has a `<RouterView />`, uses no raw hex color strings (grep for `#` returns no color codes inside the SFC), and observes SFC block order (`<script setup>` → `<template>` → `<style scoped>`).
- [ ] `npm run dev` starts the dev server and the app mounts without console errors.
- [ ] `npm run build` completes without errors and produces `goed/dist/`.
- [ ] In the running dev app, the nav header background renders Utah blue (`#0065A4`) — confirms Tailwind tokens resolve correctly.
- [ ] No file authored or modified in this phase contains `console.log`.
