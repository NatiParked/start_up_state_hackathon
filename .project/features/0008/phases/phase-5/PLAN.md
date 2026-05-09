# Feature Plan: 0008 — Phase 5 — `useShareCard` Composable + Drawer Share Button

## Objective

Wire the share UX end-to-end: a `useShareCard` composable builds the deep-link URL and `<meta og:*>` / `<meta twitter:*>` tags from a company record, the drawer gets a Share button that copies the URL with a "Copied!" confirmation, and the Map view auto-opens the corresponding drawer when loaded with `?company=<id>`.

**Purpose:** Founders and visitors can share any company in one click; the link unfurls as a branded OG card on LinkedIn / Twitter (Phase 4) and re-opens the drawer when re-visited (categorical "share & deep-link" domain done end-to-end).

**Output:**
- New: `goed/src/composables/useShareCard.js`
- Modified: `goed/src/components/drawer/CompanyDrawer.vue`
- Modified: `goed/src/views/MapView.vue`

---

## Must-Haves (Goal-Backward)

### Observable Truths (User Perspective)

1. With a drawer open, clicking **Share** copies `<origin>/?company=<id>` to the clipboard and shows a "Copied!" pill for ~2 seconds, then dismisses.
2. Pasting that URL into a fresh browser tab loads the map and auto-opens the matching company drawer (anonymous user; no login required).
3. While a drawer is open, `document.head` contains the meta tags `og:image`, `og:title`, `og:description`, `twitter:card="summary_large_image"`, `twitter:image`, `twitter:title` — and `og:image` / `twitter:image` point at `${VITE_SUPABASE_URL}/functions/v1/generate-og-image/og/<id>.png`.
4. Closing the drawer (or switching to a different company) removes / replaces those tags.
5. Pasting the deep-link URL into LinkedIn Post Inspector + Twitter Card Validator renders the Phase 4 OG card (manual, post-deploy of Phase 4 — flagged in verification as ops-gated).
6. The flow works for both an authenticated founder and an anonymous visitor (no auth coupling in `useShareCard` or the Share button).

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `goed/src/composables/useShareCard.js` | URL builder + meta-tag upsert lifecycle + clipboard copy | `useShareCard(company)` (named export) |
| `goed/src/components/drawer/CompanyDrawer.vue` | Share button + "Copied!" pill + composable wiring | (default Vue SFC) |
| `goed/src/views/MapView.vue` | Reads `?company=<id>` on mount and selects the matching company in the Pinia store | (default Vue SFC) |

### Required Wiring

| From | To | Via |
|------|----|-----|
| `CompanyDrawer.vue` (header) | `useShareCard(company)` | `import { useShareCard } from '@/composables/useShareCard'`; instantiate with the `company` computed `Ref` |
| Share button click | `copyLink()` from composable | `@click` handler awaits `copyLink()` and toggles `copiedAt = Date.now()` for 2 s |
| `useShareCard` (mount / company change) | `document.head` | Upserts six meta tags by attribute selector (`property="og:image"`, `name="twitter:card"`, etc.) |
| `MapView.vue` (`onMounted`) | `useStartupsStore.selectCompany(id)` | After `store.fetchAll()` resolves, read `route.query.company` and call `selectCompany(id)` if present and matches a loaded company |
| `useShareCard.ogImageUrl` | Phase 4 Edge Function | Templates `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image/og/${id}.png` |

### Key Links (Most Likely Failure Points)

- **Composable lifecycle on company change:** if the user opens drawer A, then drawer B, the meta tags must be replaced (not appended). Implementation must look up existing tags by `property=` / `name=` selector before creating new ones.
- **Cleanup on unmount / close:** when the drawer closes (`selectedCompany = null`), the composable must remove the tags it added so subsequent un-shared pages don't carry stale OG data.
- **Map deep-link race:** `selectCompany(id)` only works after `companies` are loaded — `MapView.vue` already calls `store.fetchAll()` in `onMounted`; the query-param read must `await` that load before selecting.
- **`navigator.clipboard` failure path:** `copyLink()` must catch (e.g., insecure context, denied permission) and return `false` so the UI does not show "Copied!" on failure.

---

## Dependency Graph

```
Task 5.1: useShareCard.js (composable)         [needs nothing → creates the composable]
                │
                ├──> Task 5.2: CompanyDrawer.vue Share button   [needs 5.1]
                │
                └──> (independent) Task 5.3: MapView.vue ?company=<id> auto-open
                                            [needs nothing — only touches store + route]
```

## Execution Sequences

| Sequence | Tasks | Parallel? | Rationale |
|----------|-------|-----------|-----------|
| 1 | 5.1, **5.3** | Yes — different files, no shared state | 5.1 creates the composable; 5.3 wires the deep-link reader (touches `MapView.vue` only — does not need the composable) |
| 2 | 5.2 | — | Imports `useShareCard` from 5.1; must run after 5.1 |

The auto-mode runner can spawn 5.1 + 5.3 in parallel, then 5.2.

---

## Tasks

### Task 5.1: Create `useShareCard` composable

**Type:** auto
**Sequence:** 1

<files>
goed/src/composables/useShareCard.js
</files>

<action>
Create a new composable file with a single named export `useShareCard(company)` that returns `{ shareUrl, ogImageUrl, copyLink }`. Follow the style of `goed/src/composables/useLogoDev.js` and `goed/src/composables/useOnboarding.js`: JS only, JSDoc on the exported function and on `copyLink`, named export, no TypeScript, single quotes, no semicolons, 2-space indent, no `console.log`.

Behavior:

1. Accept `company` as either a plain object `{ id, name, sector, stage, description, ... }` or a `Ref<object>`. Normalize internally with Vue's `unref()` / `toValue()` so the composable works in both cases.
2. `shareUrl` is a `computed` `Ref<string>`. Value: `${window.location.origin}/?company=${id}` where `id` is the current company id. If `id` is falsy, return `window.location.origin + '/'`.
3. `ogImageUrl` is a `computed` `Ref<string>`. Value: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image/og/${id}.png` when `id` is present; empty string `''` otherwise. (`VITE_SUPABASE_URL` is the same env var used by `goed/src/lib/supabase.js` and the existing `track-view` fetch in `CompanyDrawer.vue` — no new env var.)
4. Meta-tag lifecycle:
   - Use `watch` on the company id with `{ immediate: true }`, plus `onUnmounted`, to manage tags.
   - Define a `META_KEYS` array of six entries: `{ kind: 'property', key: 'og:image' }`, `{ kind: 'property', key: 'og:title' }`, `{ kind: 'property', key: 'og:description' }`, `{ kind: 'name', key: 'twitter:card' }`, `{ kind: 'name', key: 'twitter:image' }`, `{ kind: 'name', key: 'twitter:title' }`.
   - For each entry, look up the tag in `document.head` by attribute selector (`document.head.querySelector('meta[property="og:image"]')` or `meta[name="twitter:card"]`). If it exists, update `content`. If it does not, create the element, set the attribute, set `content`, and append it to `document.head`. Mark created tags (e.g., `el.dataset.useShareCard = 'true'`) so cleanup only removes tags this composable added — never tags placed by `index.html` or another composable.
   - Content values: `og:title` / `twitter:title` = `${company.name} — Utah Startup Map` (or just `Utah Startup Map` if name is missing). `og:description` = `company.description` truncated to 200 chars or `'Discover Utah startups on the Utah Startup Map.'` fallback. `og:image` / `twitter:image` = `ogImageUrl.value`. `twitter:card` = `'summary_large_image'`.
   - When the company id becomes falsy, OR on `onUnmounted`, iterate `META_KEYS` and remove ONLY the tags whose `dataset.useShareCard === 'true'`.
5. `copyLink` is `async function copyLink()`. Call `await navigator.clipboard.writeText(shareUrl.value)`. Return `true` on success, `false` on any thrown error or when `navigator.clipboard` is undefined. Wrap in `try/catch`. Do not throw. Do not use `console.log` / `console.error`.

Imports: `import { computed, watch, onUnmounted, toValue } from 'vue'`. Do not import the supabase client — the composable does not need it.
</action>

<verify>
1. File exists: `goed/src/composables/useShareCard.js` with named export `useShareCard`.
2. Import shape valid: `node -e "import('./goed/src/composables/useShareCard.js').then(m => console.log(typeof m.useShareCard))"` from the repo root prints `function` (or, equivalently, `grep -E "^export function useShareCard" goed/src/composables/useShareCard.js` returns one match).
3. Static check — no banned tokens: `grep -nE "console\.log|: \w+\)" goed/src/composables/useShareCard.js` returns nothing (no `console.log`, no TS-style type annotations).
4. JSDoc present on `useShareCard` and `copyLink`: `grep -c "@returns" goed/src/composables/useShareCard.js` is at least `2`.
5. Domain spot-check: in a Vue component (or Vitest-less manual mount), calling `useShareCard({ id: 'abc-123', name: 'Acme' })` produces `shareUrl.value === window.location.origin + '/?company=abc-123'` and `ogImageUrl.value === import.meta.env.VITE_SUPABASE_URL + '/functions/v1/generate-og-image/og/abc-123.png'`. (Auto-runner: read the file and confirm the template literals match exactly.)
</verify>

<done>
- `goed/src/composables/useShareCard.js` exists with named export `useShareCard(company)` returning `{ shareUrl, ogImageUrl, copyLink }`.
- JSDoc on the exported function and on `copyLink`.
- The composable upserts six meta tags on company change and removes only its own tags on cleanup (uses `dataset.useShareCard`).
- `copyLink()` returns `Promise<boolean>` and never throws.
- File contains no `console.log` and no TypeScript syntax.
</done>

---

### Task 5.2: Add Share button + "Copied!" pill to `CompanyDrawer.vue`

**Type:** auto
**Sequence:** 2 (depends on 5.1)

<files>
goed/src/components/drawer/CompanyDrawer.vue
</files>

<action>
Modify `goed/src/components/drawer/CompanyDrawer.vue` to add a Share button in the drawer header that calls `copyLink()` from `useShareCard` and shows a temporary "Copied!" pill.

Edits to `<script setup>`:

1. Add import: `import { useShareCard } from '@/composables/useShareCard'`.
2. Instantiate the composable AFTER the existing `company` computed (line ~18). Pass the `company` ref directly so the composable's `watch` reacts to drawer opens / company changes:
   ```js
   const { copyLink } = useShareCard(company)
   ```
   (Destructure only `copyLink`; `shareUrl` / `ogImageUrl` are not needed in the SFC because the composable owns the meta tags and the URL itself is what `copyLink` writes to the clipboard.)
3. Add a local ref for copy feedback:
   ```js
   const copiedAt = ref(0)
   const showCopied = computed(() => copiedAt.value > 0)
   ```
4. Add a click handler:
   ```js
   async function handleShareClick() {
     const ok = await copyLink()
     if (!ok) return
     copiedAt.value = Date.now()
     setTimeout(() => { copiedAt.value = 0 }, 2000)
   }
   ```
   (No `console.log` on failure — silently no-op so the user is not lied to with a "Copied!" pill.)

Edits to `<template>`:

1. Locate the close button (currently `<button @click="handleClose" aria-label="Close" class="absolute top-4 right-4 ...">`).
2. Immediately BEFORE that close button, insert a Share button + pill positioned in the drawer header. Use these exact Tailwind classes (Utah brand tokens already configured in `tailwind.config.js`):
   ```html
   <div class="absolute top-4 right-12 flex items-center gap-2">
     <button
       @click="handleShareClick"
       type="button"
       aria-label="Copy share link"
       class="px-3 py-1 text-sm rounded bg-utah-blue text-white hover:bg-utah-blue-dark transition-colors"
     >Share</button>
     <span
       v-if="showCopied"
       role="status"
       class="px-2 py-1 text-xs rounded bg-utah-blue text-white"
     >Copied!</span>
   </div>
   ```
   (The close button at `top-4 right-4` stays where it is; the Share group sits to its left at `right-12`. If `tailwind.config.js` does not define `utah-blue-dark`, fall back to `hover:opacity-90` instead of `hover:bg-utah-blue-dark` — verify by `grep -n "utah-blue" goed/tailwind.config.js` before writing the class string.)
3. Wrap the new Share button + close button section so they are only rendered when `company` is truthy — i.e., move them inside the existing `<div v-if="company">` block, OR keep them outside but bind `v-if="company"` on the new Share `<div>`. (The close button is currently always-rendered and that's fine; keep that behavior. The Share button MUST require `v-if="company"` so it doesn't render on an empty drawer.)

Do not touch any other logic in the SFC (the existing `track-view` fetch, GSAP animation, claim/edit links, monogram fallback, etc.). Preserve current `<script setup>` → `<template>` → `<style scoped>` order.
</action>

<verify>
1. File modified: `goed/src/components/drawer/CompanyDrawer.vue` has `import { useShareCard } from '@/composables/useShareCard'`. Confirm with `grep -n "useShareCard" goed/src/components/drawer/CompanyDrawer.vue` (expect at least 2 matches: import + call).
2. Share button present: `grep -n "aria-label=\"Copy share link\"" goed/src/components/drawer/CompanyDrawer.vue` returns one match.
3. "Copied!" pill present: `grep -n "Copied!" goed/src/components/drawer/CompanyDrawer.vue` returns one match.
4. No raw hex in the new template region: `grep -nE "#[0-9a-fA-F]{6}" goed/src/components/drawer/CompanyDrawer.vue` returns no NEW matches in the inserted lines (existing inline styles for `var(--bg-2)` etc. are CSS vars, not hex — fine).
5. No `console.log` added: `grep -n "console\." goed/src/components/drawer/CompanyDrawer.vue` returns no matches.
6. Domain-functionality (manual / runner-staged): when the dev server is running, opening a drawer and clicking Share writes `<origin>/?company=<id>` to the clipboard and renders a pill that disappears after 2 s. Auto-runner can mark this DEFERRED (no live browser) and rely on the static checks above plus the Phase verifier.
</verify>

<done>
- The drawer header renders a Utah-blue Share button to the left of the close button when a company is open.
- Clicking Share copies the deep-link URL to the clipboard and shows a "Copied!" pill for ~2 seconds.
- Failure of `navigator.clipboard` does not show the pill.
- No `console.log`, no raw hex colors added.
- Existing drawer behavior (track-view fetch, GSAP, claim/edit) unchanged.
</done>

---

### Task 5.3: Wire `?company=<id>` deep-link auto-open in `MapView.vue`

**Type:** auto
**Sequence:** 1 (parallel with 5.1 — touches different files)

<files>
goed/src/views/MapView.vue
</files>

<action>
Modify `goed/src/views/MapView.vue` so that on mount, if the URL contains `?company=<id>` and `<id>` is a UUID, the matching company is selected in the Pinia store (which auto-opens the drawer via the existing `selectedCompany` watcher in `CompanyDrawer.vue`).

Edits to `<script setup>`:

1. Add imports (top of script, with the other vue/router imports):
   ```js
   import { useRoute } from 'vue-router'
   ```
2. After `const store = useStartupsStore()` and `const { companies } = storeToRefs(store)`, add:
   ```js
   const { selectCompany } = store
   const route = useRoute()
   ```
   (The existing destructure on line 13 already pulls `clearSelection`; add `selectCompany` to that same destructure if you prefer one statement: `const { clearSelection, selectCompany } = store`.)
3. Replace the existing `onMounted` body so it awaits the fetch when needed and then reads the query param:
   ```js
   onMounted(async () => {
     if (companies.value.length === 0) {
       await store.fetchAll()
     }
     const requestedId = route.query.company
     if (typeof requestedId === 'string' && requestedId.length > 0) {
       const match = companies.value.find(c => c.id === requestedId)
       if (match) {
         selectCompany(requestedId)
       }
     }
   })
   ```
   (`selectCompany(id)` is the existing action in `goed/src/stores/startups.js` line 53 that sets `selectedCompany.value`. The `CompanyDrawer.vue` watcher at line 84 picks that up and animates the drawer in — including firing the existing `track-view` insert, which is the desired analytics behavior for shared-link visits.)

Do not modify the `<template>` or `<style scoped>`. Do not change any other view or the router config — `vue-router` already exposes `route.query` natively for the existing `/` Map route, so no route definition changes are needed.

Edge case: if `route.query.company` exists but no matching company is loaded (e.g., bad/stale id), do nothing — the user lands on the map with no drawer open, which is the safest fallback. Do NOT show an error toast.
</action>

<verify>
1. File modified: `grep -n "useRoute" goed/src/views/MapView.vue` returns one match (import) and one usage.
2. `selectCompany` called: `grep -n "selectCompany" goed/src/views/MapView.vue` returns at least one match.
3. Query-param read: `grep -n "route.query.company" goed/src/views/MapView.vue` returns one match.
4. `onMounted` is now `async`: `grep -n "onMounted(async" goed/src/views/MapView.vue` returns one match.
5. Domain-functionality (runner-staged): with the dev server running and at least one seeded company, navigating to `http://localhost:5173/?company=<known-id>` opens the matching drawer within 1 frame after `companies` load. Auto-runner may mark this DEFERRED (no live browser) — the static checks above are sufficient to verify the wiring.
6. No regressions: the existing `store.fetchAll()` still runs when `companies` is empty; the `clearSelection` import / `handleMapBackgroundClick` handler are unchanged. Confirm: `grep -n "handleMapBackgroundClick" goed/src/views/MapView.vue` still returns the original definition and template usage.
</verify>

<done>
- `MapView.vue` imports `useRoute` and reads `route.query.company` on mount.
- After companies load, a matching id triggers `selectCompany(id)` which opens the drawer.
- Unknown / missing id is a silent no-op.
- No router config change required; existing `/` route handles the query param natively.
</done>

---

## Verification Checklist (Mirrors Success Criteria)

- [ ] `goed/src/composables/useShareCard.js` exists with named export `useShareCard(company)` returning `{ shareUrl, ogImageUrl, copyLink }` — JSDoc, JS only, no TS, no `console.log`.
- [ ] `shareUrl.value` resolves to `${window.location.origin}/?company=${id}` for a sample company.
- [ ] `ogImageUrl.value` resolves to `${VITE_SUPABASE_URL}/functions/v1/generate-og-image/og/${id}.png`.
- [ ] On drawer open, `document.head` contains all six meta tags (`og:image`, `og:title`, `og:description`, `twitter:card="summary_large_image"`, `twitter:image`, `twitter:title`); on close they are removed.
- [ ] `copyLink()` returns a Promise that resolves to `true` on success and `false` on failure (e.g., insecure context); never throws.
- [ ] `CompanyDrawer.vue` renders a Utah-blue Share button + ~2 s "Copied!" pill that does not appear on copy failure.
- [ ] `MapView.vue` auto-opens the drawer for `?company=<id>` once companies are loaded; unknown id is a silent no-op.
- [ ] No raw hex colors added; only Tailwind tokens (`bg-utah-blue`, `hover:bg-utah-blue-dark`, `text-white`).
- [ ] No `console.log` in any modified frontend file.
- [ ] Manual ops smoke (DEFERRED until Phase 4 deploy completes): pasting the deep-link URL into LinkedIn Post Inspector + Twitter Card Validator renders the branded OG card. Document this in `phases/phase-5/VERIFICATION.md` under "Operator Smoke" with the exact deep-link URL shape.
- [ ] Existing drawer view-tracking (Phase 2 `track-view` fetch) still fires on drawer open — both for direct pin clicks and for deep-link auto-opens.

## Success Criteria (from ROADMAP)

1. Share button copies `<origin>/?company=<id>` to clipboard and shows a 2-second "Copied!" pill. ✅ when Task 5.2 is done.
2. Pasting the URL into a fresh tab auto-opens the matching drawer. ✅ when Task 5.3 is done.
3. `document.head` carries the six OG/Twitter tags while a drawer is open and they are cleaned up on close. ✅ when Task 5.1 is done.
4. LinkedIn / Twitter validators render the Phase 4 OG card. ⏳ Ops-gated — only verifiable after Phase 4 ops deploy lands; documented in VERIFICATION.md as a manual smoke step.
5. Flow works for both authenticated founder and anonymous visitor. ✅ — `useShareCard` and the Share button do not reference any auth state; verified by static read.
