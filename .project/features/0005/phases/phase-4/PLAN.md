# Feature Plan: Refresh Control, Subscriber Shell & Roadmap Page (Phase 4)

## Objective

Ship the final admin surfaces — manual refresh control with live log tail and subscriber-panel shell — and deliver a polished public `/roadmap` page that sells the product vision to judges.

**Purpose:** Close out Feature 0005 by giving staff a one-click way to invoke the M5 `refresh-jobs` Edge Function (bulk + per-company) with live log feedback, drop in the subscriber-panel UI shell so M9 can fill it without rework, and replace the `/roadmap` placeholder with a branded vision page that judges can reach in one click from the public top nav.
**Output:** Three new view files (`RefreshControl.vue`, `SubscriberPanel.vue`, `RoadmapView.vue`), one new component (`RoadmapCard.vue`), and updates to `router/index.js` (replace 3 placeholders) and `App.vue` (no functional change — the link already exists, but the route now resolves to the real page).

## Must-Haves (Goal-Backward)

### Observable Truths

- A signed-in admin can navigate to `/admin/refresh`, click **Refresh All**, see a spinner + disabled button while the call is in flight, and within ~5s see new rows appear in the live log tail.
- A signed-in admin can click **Refresh** next to any company on `/admin/refresh` and see that row's `last_refreshed_at` timestamp update after the call completes.
- A signed-in admin can navigate to `/admin/subscribers` and see the M9-shell layout: yellow "Populates in M9" badge, three metric tiles showing `0` / `Never` / `0`, and breakdown tables with `—` placeholders.
- An anonymous visitor (no auth) can click `Roadmap` in the top nav and land on a public `/roadmap` page showing nine roadmap cards in a responsive grid with a GSAP stagger fade-in on mount.
- Each roadmap card's status badge color matches the brand convention: `bg-hiring-green` for "In Development", `bg-utah-blue` for "Coming Soon", `bg-warning-yellow` for "Planned".

### Required Artifacts

| Path                                              | Provides                                                                              | Key Exports                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------- |
| `goed/src/views/admin/RefreshControl.vue`         | `/admin/refresh` page: bulk refresh button, per-company list, live log tail (5s poll) | default Vue SFC              |
| `goed/src/views/admin/SubscriberPanel.vue`        | `/admin/subscribers` UI shell with M9 placeholders                                    | default Vue SFC              |
| `goed/src/views/RoadmapView.vue`                  | Public `/roadmap` page: hero + grid of `RoadmapCard` components + GSAP stagger        | default Vue SFC              |
| `goed/src/components/roadmap/RoadmapCard.vue`     | Individual roadmap card: title, description, status badge, icon                       | default Vue SFC (4 props)    |
| `goed/src/router/index.js` (modified)             | Wire `/roadmap`, `/admin/refresh`, `/admin/subscribers` to real components            | default `router` instance    |

### Key Links

| From                              | To                                            | Via                                                    |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `RefreshControl.vue` "Refresh All"| `refresh-jobs` Edge Function                  | `supabase.functions.invoke('refresh-jobs', { body: {} })` |
| `RefreshControl.vue` per-row btn  | `refresh-jobs` Edge Function                  | `supabase.functions.invoke('refresh-jobs', { body: { startup_id } })` |
| `RefreshControl.vue` log tail     | `map_refresh_log` table                       | `supabase.from('map_refresh_log').select(...)` polled every 5s via `setInterval` |
| `RefreshControl.vue` company list | `map_startups` table                          | `useStartupsStore().fetchAll()` (re-uses Pinia store)  |
| `RoadmapView.vue` cards           | `RoadmapCard.vue`                             | `<RoadmapCard v-for="r in roadmapItems" v-bind="r" />` |
| `App.vue` footer/nav              | `RoadmapView.vue`                             | `<RouterLink to="/roadmap">` (already exists; route swap unblocks it) |
| `router/index.js` `/roadmap`      | `RoadmapView.vue`                             | `() => import('@/views/RoadmapView.vue')`              |
| `router/index.js` `/admin/refresh`| `RefreshControl.vue`                          | `() => import('@/views/admin/RefreshControl.vue')`     |
| `router/index.js` `/admin/subscribers` | `SubscriberPanel.vue`                    | `() => import('@/views/admin/SubscriberPanel.vue')`    |

## Dependency Graph

```
Task 1 (RefreshControl + router /admin/refresh) ─┐
Task 2 (SubscriberPanel + router /admin/subscribers) ─┼─► all independent (different files; router edits to disjoint blocks)
Task 3 (RoadmapView + RoadmapCard + router /roadmap + App.vue audit) ─┘
```

All three tasks edit `goed/src/router/index.js`, but they touch **different route entries** (`AdminRefresh`, `AdminSubscribers`, and `Roadmap` respectively). Tasks must be executed **sequentially** to avoid edit-conflict on `router/index.js`. Run order: Task 1 → Task 2 → Task 3.

## Execution Sequences

| Sequence | Tasks  | Parallel | Reason                                                                 |
| -------- | ------ | -------- | ---------------------------------------------------------------------- |
| 1        | Task 1 | No       | Router file edit; no other file collisions                             |
| 2        | Task 2 | No       | Router file edit (different child route)                               |
| 3        | Task 3 | No       | Router file edit (top-level route) + App.vue audit                     |

## Tasks

### Task 1: RefreshControl view + router wiring

**Type:** auto
**Sequence:** 1

<files>
goed/src/views/admin/RefreshControl.vue
goed/src/router/index.js
</files>

<action>
Create `goed/src/views/admin/RefreshControl.vue` — a single-file Vue 3 `<script setup>` component (no TypeScript, no semicolons, single quotes, 2-space indent) following the same shell patterns as `goed/src/views/admin/CompanyList.vue` and `AdminDashboard.vue`. The page has three sections rendered top-to-bottom inside a single `<div class="p-6 space-y-6">` wrapper.

Imports at the top of `<script setup>`:

```
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import { supabase } from '@/lib/supabase'
```

State refs:

- `isBulkRefreshing` (ref boolean, default false)
- `bulkResultMessage` (ref string|null, default null) — holds the human-readable response text after Refresh All
- `bulkResultIsError` (ref boolean, default false)
- `searchQuery` (ref string, default '')
- `perRowRefreshing` (ref Set<string>, default `new Set()`) — tracks which startup IDs are currently mid-refresh so per-row buttons can disable individually
- `logEntries` (ref array, default `[]`) — last 20 `map_refresh_log` rows joined with startup name
- `logError` (ref any, default null)
- `logIntervalId` (ref number|null, default null) — held so `onUnmounted` can `clearInterval`

Use `useStartupsStore()` and `storeToRefs` to pull `companies` and `isLoading`. Call `store.fetchAll()` in `onMounted` (only if `companies.value.length === 0`).

Filter helper:

```
const filteredCompanies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return companies.value
  return companies.value.filter(c => (c.name ?? '').toLowerCase().includes(q))
})
```

Bulk refresh handler `handleRefreshAll`:

- Set `isBulkRefreshing.value = true`, clear `bulkResultMessage` and `bulkResultIsError`.
- `const { data, error } = await supabase.functions.invoke('refresh-jobs', { body: {} })`
- On success: `bulkResultMessage.value = data?.message ?? 'Refresh queued.'`, `bulkResultIsError.value = false`.
- On error: `bulkResultMessage.value = error.message ?? 'Refresh failed.'`, `bulkResultIsError.value = true`.
- `finally`: `isBulkRefreshing.value = false`. Then call `loadLogs()` once to immediately reflect new rows.

Per-row handler `handleRefreshOne(startupId)`:

- Add `startupId` to `perRowRefreshing.value` (use a new Set so reactivity triggers: `perRowRefreshing.value = new Set([...perRowRefreshing.value, startupId])`).
- `const { error } = await supabase.functions.invoke('refresh-jobs', { body: { startup_id: startupId } })`.
- On success: re-fetch the single row via `store.fetchAll()` so the row's `last_refreshed_at` updates (acceptable to refetch all; the company list is small).
- `finally`: remove `startupId` from `perRowRefreshing.value` (recreate the Set without that id).
- Then call `loadLogs()` once.

Log loader `loadLogs`:

- Query: `supabase.from('map_refresh_log').select('id, created_at, status, message, startup_id').order('created_at', { ascending: false }).limit(20)`.
- Capture `{ data, error: dbError }`. On error: `logError.value = dbError`; on success: `logEntries.value = data ?? []` and `logError.value = null`.
- Resolve startup name client-side: define `const startupNameById = computed(() => Object.fromEntries(companies.value.map(c => [c.id, c.name])))` and render `startupNameById.value[entry.startup_id] ?? '—'` in the template.

Lifecycle:

```
onMounted(async () => {
  if (companies.value.length === 0) await store.fetchAll()
  await loadLogs()
  logIntervalId.value = window.setInterval(loadLogs, 5000)
})
onUnmounted(() => {
  if (logIntervalId.value !== null) {
    clearInterval(logIntervalId.value)
    logIntervalId.value = null
  }
})
```

Template structure (Tailwind only, mirror admin view spacing):

```
<div class="p-6 space-y-6">
  <h1 class="text-xl font-semibold text-gray-900">Refresh Control</h1>

  <!-- Section 1: Bulk Refresh -->
  <section class="bg-white rounded-lg border border-gray-200 p-5">
    <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Bulk Refresh</h2>
    <button
      class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-utah-blue text-white text-sm font-semibold hover:bg-utah-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      :disabled="isBulkRefreshing"
      @click="handleRefreshAll"
    >
      <span v-if="isBulkRefreshing" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      {{ isBulkRefreshing ? 'Refreshing…' : 'Refresh All' }}
    </button>
    <p
      v-if="bulkResultMessage"
      class="mt-3 text-sm"
      :class="bulkResultIsError ? 'text-error-red' : 'text-hiring-green'"
    >
      {{ bulkResultMessage }}
    </p>
  </section>

  <!-- Section 2: Per-company list -->
  <section class="bg-white rounded-lg border border-gray-200 p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Companies</h2>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name..."
        class="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-utah-blue"
      />
    </div>
    <div v-if="isLoading" class="py-8 text-center text-gray-500 text-sm">Loading…</div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
            <th class="px-4 py-2 text-left font-semibold text-gray-600">Last Refreshed</th>
            <th class="px-4 py-2 text-left font-semibold text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in filteredCompanies" :key="row.id">
            <td class="px-4 py-2 font-medium text-gray-900">{{ row.name }}</td>
            <td class="px-4 py-2 text-gray-500">
              {{ row.last_refreshed_at ? new Date(row.last_refreshed_at).toLocaleString() : '—' }}
            </td>
            <td class="px-4 py-2">
              <button
                class="px-3 py-1 text-xs font-medium rounded bg-utah-blue text-white hover:bg-utah-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="perRowRefreshing.has(row.id)"
                @click="handleRefreshOne(row.id)"
              >
                {{ perRowRefreshing.has(row.id) ? 'Refreshing…' : 'Refresh' }}
              </button>
            </td>
          </tr>
          <tr v-if="filteredCompanies.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-gray-400">No companies match.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- Section 3: Live log tail -->
  <section class="bg-white rounded-lg border border-gray-200 p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Refresh Log (last 20, polled every 5s)</h2>
    </div>
    <div v-if="logError" class="text-error-red text-sm mb-2">Failed to load log: {{ logError.message ?? logError }}</div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-xs">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Time</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Startup</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Message</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 font-mono">
          <tr v-for="entry in logEntries" :key="entry.id">
            <td class="px-3 py-2 text-gray-500 whitespace-nowrap">{{ new Date(entry.created_at).toLocaleTimeString() }}</td>
            <td class="px-3 py-2 text-gray-700">{{ startupNameById[entry.startup_id] ?? '—' }}</td>
            <td class="px-3 py-2">
              <span
                class="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                :class="{
                  'bg-hiring-green text-white': entry.status === 'success',
                  'bg-error-red text-white': entry.status === 'error',
                  'bg-warning-yellow text-utah-blue-dark': entry.status !== 'success' && entry.status !== 'error',
                }"
              >
                {{ entry.status ?? '—' }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-600 truncate max-w-md">{{ (entry.message ?? '').slice(0, 200) }}</td>
          </tr>
          <tr v-if="logEntries.length === 0 && !logError">
            <td colspan="4" class="px-3 py-6 text-center text-gray-400">No log entries yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</div>
```

Empty `<style scoped></style>` block at the bottom (per convention — keep the block even when no styles).

Then update `goed/src/router/index.js`: locate the `AdminRefresh` child route (currently mapping `path: 'refresh'` to `PlaceholderView.vue` with `props: { title: 'Refresh' }`) and replace with:

```
{
  path: 'refresh',
  name: 'AdminRefresh',
  component: () => import('@/views/admin/RefreshControl.vue'),
},
```

Drop the `props: { title: 'Refresh' }` line.
</action>

<verify>
1. File exists: `goed/src/views/admin/RefreshControl.vue` with default export, `<script setup>` block, `<template>`, and empty `<style scoped></style>`.
2. File exists: `goed/src/router/index.js` updated — `AdminRefresh` route now points at `() => import('@/views/admin/RefreshControl.vue')` (no `props.title`).
3. Build passes: `cd goed && npm run build` exits 0 with no Vue compile errors.
4. Manual smoke (Playwright MCP): sign in as admin, navigate to `/admin/refresh`. Verify the three sections render (Bulk Refresh card, Companies table, Refresh Log table). Verify the **Refresh All** button is enabled and clicking it shows the spinner + "Refreshing…" text. Within ~5s the log tail should pick up at least one new row (or show "No log entries yet." if the function returned empty). Verify the per-row Refresh button toggles to "Refreshing…" and the corresponding `last_refreshed_at` cell updates within ~10s of the click resolving.
5. Domain complete: no console errors; `setInterval` cleared on route change (confirm by adding/removing a `console.log` temporarily — but DO NOT commit `console.log`).
</verify>

<done>
- [ ] `RefreshControl.vue` created with all three sections and proper lifecycle hooks (`onMounted` starts polling, `onUnmounted` clears it).
- [ ] Router maps `/admin/refresh` → `RefreshControl.vue` (placeholder removed).
- [ ] `npm run build` succeeds.
- [ ] Manual: Refresh All shows spinner, completion message, and new log rows appear in the tail without page reload.
- [ ] Manual: per-company Refresh updates that row's `last_refreshed_at` after the call.
</done>

---

### Task 2: SubscriberPanel UI shell + router wiring

**Type:** auto
**Sequence:** 2

<files>
goed/src/views/admin/SubscriberPanel.vue
goed/src/router/index.js
</files>

<action>
Create `goed/src/views/admin/SubscriberPanel.vue` — pure UI shell with no data fetching, no Pinia, no Supabase. JS-only `<script setup>`, single quotes, no semicolons, 2-space indent.

`<script setup>` body — the file is mostly markup, but define a small static array for the breakdown rows so the M9 implementer can swap real data in by editing one place:

```
const sectorBreakdown = [
  { label: 'AI / ML', count: '—' },
  { label: 'Climate', count: '—' },
  { label: 'FinTech', count: '—' },
]
const stageBreakdown = [
  { label: 'Pre-Seed', count: '—' },
  { label: 'Seed', count: '—' },
  { label: 'Series A+', count: '—' },
]
```

Template — match the visual rhythm of `AdminDashboard.vue` (rounded white cards, gray-200 borders, p-5/p-6 spacing). Inline note at the bottom uses muted gray, not a colored alert.

```
<div class="p-6 space-y-6">
  <!-- Header card with M9 badge -->
  <div class="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between">
    <h1 class="text-xl font-semibold text-gray-900">Subscriber Stats</h1>
    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-yellow text-utah-blue-dark">
      Populates in M9
    </span>
  </div>

  <!-- Three metric tiles -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total confirmed subscribers</p>
      <p class="text-2xl font-bold text-gray-900">0</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last digest sent</p>
      <p class="text-2xl font-bold text-gray-900">Never</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active filter saved searches</p>
      <p class="text-2xl font-bold text-gray-900">0</p>
    </div>
  </div>

  <!-- Breakdown table -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">By Sector</h2>
      </div>
      <table class="min-w-full divide-y divide-gray-100 text-sm">
        <tbody>
          <tr v-for="row in sectorBreakdown" :key="row.label">
            <td class="px-5 py-2 text-gray-700">{{ row.label }}</td>
            <td class="px-5 py-2 text-right text-gray-400 font-mono">{{ row.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">By Stage</h2>
      </div>
      <table class="min-w-full divide-y divide-gray-100 text-sm">
        <tbody>
          <tr v-for="row in stageBreakdown" :key="row.label">
            <td class="px-5 py-2 text-gray-700">{{ row.label }}</td>
            <td class="px-5 py-2 text-right text-gray-400 font-mono">{{ row.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Inline note -->
  <p class="text-xs text-gray-400 italic">
    This panel is a UI shell. M9 (Notifications) populates the live data.
  </p>
</div>
```

Empty `<style scoped></style>`.

Then update `goed/src/router/index.js`: locate the `AdminSubscribers` child route (currently `path: 'subscribers'` → `PlaceholderView.vue` with `props: { title: 'Subscribers' }`) and replace with:

```
{
  path: 'subscribers',
  name: 'AdminSubscribers',
  component: () => import('@/views/admin/SubscriberPanel.vue'),
},
```

Drop the `props` line.
</action>

<verify>
1. File exists: `goed/src/views/admin/SubscriberPanel.vue` with `<script setup>`, `<template>`, empty `<style scoped></style>`.
2. Router: `AdminSubscribers` child route now imports `@/views/admin/SubscriberPanel.vue`; `props.title` removed.
3. Build passes: `cd goed && npm run build` exits 0.
4. Manual smoke: sign in as admin, navigate to `/admin/subscribers`. Verify the yellow `bg-warning-yellow text-utah-blue-dark` "Populates in M9" badge is visible in the header card. Verify three metric tiles show "0", "Never", "0". Verify both breakdown tables render with `—` placeholder values. Verify the inline note "This panel is a UI shell. M9 (Notifications) populates the live data." renders at the bottom.
5. Domain complete: layout is responsive (3 tiles wrap on mobile; tables stack 1-col on `<lg`); no console errors; no network requests fired (this is a pure shell — confirm via DevTools Network panel that opening this page makes zero new XHR/fetch calls beyond auth heartbeat).
</verify>

<done>
- [ ] `SubscriberPanel.vue` created with header card, three metric tiles, two breakdown tables, and inline note.
- [ ] Router maps `/admin/subscribers` → `SubscriberPanel.vue` (placeholder removed).
- [ ] `npm run build` succeeds.
- [ ] Manual: page renders, M9 badge visible, no network requests fired by this view.
</done>

---

### Task 3: RoadmapView + RoadmapCard component + router + App.vue verification

**Type:** auto
**Sequence:** 3

<files>
goed/src/components/roadmap/RoadmapCard.vue
goed/src/views/RoadmapView.vue
goed/src/router/index.js
goed/src/App.vue
</files>

<action>
**Step A — Create `goed/src/components/roadmap/RoadmapCard.vue`** (new directory `roadmap/` under components, per project structure: feature-grouped components).

Props (verbose object form, per convention):

```
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true }, // 'Coming Soon' | 'In Development' | 'Planned'
  icon: { type: String, required: true },   // single emoji or short string
})

const statusBadgeClass = computed(() => {
  if (props.status === 'In Development') return 'bg-hiring-green text-white'
  if (props.status === 'Coming Soon') return 'bg-utah-blue text-white'
  return 'bg-warning-yellow text-utah-blue-dark' // Planned
})
```

(Remember to import `computed` from `vue`.)

Template — rounded border card with brand-blue header bar and corner badge:

```
<article class="relative rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
  <!-- brand-blue header bar -->
  <div class="bg-utah-blue h-2 w-full" />
  <!-- status badge in corner -->
  <span
    class="absolute top-3 right-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
    :class="statusBadgeClass"
  >
    {{ status }}
  </span>
  <div class="p-5 pt-6">
    <div class="text-3xl mb-3" aria-hidden="true">{{ icon }}</div>
    <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ title }}</h3>
    <p class="text-sm text-gray-600 leading-relaxed">{{ description }}</p>
  </div>
</article>
```

Empty `<style scoped></style>`.

**Step B — Create `goed/src/views/RoadmapView.vue`**:

`<script setup>`:

```
import { ref, onMounted } from 'vue'
import gsap from 'gsap'
import RoadmapCard from '@/components/roadmap/RoadmapCard.vue'

const cardsContainer = ref(null)

const roadmapItems = [
  {
    title: 'Stripe Verified MRR/ARR Leaderboard',
    description: 'Opt-in revenue verification via Stripe Connect powers a public leaderboard that surfaces real Utah revenue traction.',
    status: 'Coming Soon',
    icon: '💵',
  },
  {
    title: 'LinkedIn Integration',
    description: 'Pull founder bios, headcount signals, and team-growth deltas straight from LinkedIn to enrich every company card.',
    status: 'Coming Soon',
    icon: '💼',
  },
  {
    title: 'Deeper Investor Analytics',
    description: 'Co-investment graphs, portfolio overlap, and stage-specific check-size benchmarks for every Utah-active fund.',
    status: 'Planned',
    icon: '📊',
  },
  {
    title: 'Investors as First-Class Map Entities',
    description: 'Funds appear as their own pins on the map, with portfolio companies, thesis, and recent activity at a glance.',
    status: 'Planned',
    icon: '🏦',
  },
  {
    title: 'Global Talent Identification & Recruitment Campaigns',
    description: 'Match Utah startups with vetted international talent and run targeted relocation campaigns through the platform.',
    status: 'Planned',
    icon: '🌐',
  },
  {
    title: 'Founder ↔ Investor Matching & Messaging',
    description: 'Two-sided matching with double-opt-in intros, in-app messaging, and AI-suggested fits based on stage and sector.',
    status: 'Planned',
    icon: '🤝',
  },
  {
    title: 'Mobile App',
    description: 'Native iOS/Android map app for founders and investors on the move — same data, same filters, optimized for touch.',
    status: 'Planned',
    icon: '📱',
  },
  {
    title: 'API Access',
    description: 'A documented public API and webhook firehose so builders, journalists, and ecosystems can integrate Utah data.',
    status: 'Planned',
    icon: '🔌',
  },
  {
    title: 'International Expansion Beyond Utah',
    description: 'Take the same playbook to other innovation hubs — Idaho, Arizona, Wyoming first, then international markets.',
    status: 'Planned',
    icon: '🌎',
  },
]

onMounted(() => {
  if (!cardsContainer.value) return
  const cards = cardsContainer.value.querySelectorAll('[data-roadmap-card]')
  gsap.from(cards, {
    opacity: 0,
    y: 24,
    duration: 0.5,
    stagger: 0.08,
    ease: 'power2.out',
  })
})
```

Template — public layout (use the same outer pattern as `MapView.vue` / `NavigatorView.vue` if they wrap in a paper background; otherwise use a plain white-on-light-bg layout consistent with the rest of the public site):

```
<section class="max-w-6xl mx-auto px-6 py-12">
  <header class="mb-10 text-center">
    <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">Where we're going</h1>
    <p class="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
      Utah&Startups is the live map of Utah's startup economy today — and the foundation for a deeper, more connected ecosystem tomorrow. Here's what's next on the roadmap.
    </p>
  </header>

  <div ref="cardsContainer" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    <div v-for="item in roadmapItems" :key="item.title" data-roadmap-card>
      <RoadmapCard
        :title="item.title"
        :description="item.description"
        :status="item.status"
        :icon="item.icon"
      />
    </div>
  </div>
</section>
```

Empty `<style scoped></style>`.

**Step C — Update `goed/src/router/index.js`**:

Locate the top-level `Roadmap` route (currently maps `/roadmap` to `PlaceholderView.vue` with `props: { title: 'Roadmap' }`). Replace with:

```
{
  path: '/roadmap',
  name: 'Roadmap',
  component: () => import('@/views/RoadmapView.vue'),
},
```

Drop `props.title`. Leave the `Subscribe` route untouched (it keeps the placeholder — it's M9 territory).

**Step D — Verify `goed/src/App.vue`**: the `<RouterLink to="/roadmap">Roadmap</RouterLink>` link already exists in the top-nav `<nav>`. Confirm it is still present and points at `/roadmap`. **No edits required** unless the link is missing or points elsewhere — in which case, ensure exactly one `<RouterLink to="/roadmap">Roadmap</RouterLink>` is in the nav block. The roadmap requirement says "footer nav"; the actual `App.vue` puts nav links in the top nav — keep them there (the link is what matters; placement is unchanged from prior phases). Do not move existing links.
</action>

<verify>
1. Files exist: `goed/src/components/roadmap/RoadmapCard.vue` and `goed/src/views/RoadmapView.vue` with default exports and `<script setup>` blocks.
2. Router: top-level `Roadmap` route now imports `@/views/RoadmapView.vue`; `props.title` removed. `PlaceholderView.vue` is no longer referenced for `/roadmap`.
3. `App.vue` still contains `<RouterLink to="/roadmap">Roadmap</RouterLink>` (untouched).
4. Build passes: `cd goed && npm run build` exits 0 with no errors.
5. Manual smoke (no auth — open in private/incognito tab): navigate directly to `/roadmap`. Verify the page loads without redirecting to a login. Verify the hero "Where we're going" headline + paragraph render. Verify exactly nine `RoadmapCard` instances render in a grid (1 col mobile, 2 cols sm, 3 cols lg). Verify on initial load the cards visibly fade-in and slide up with a stagger (GSAP from `opacity:0, y:24, stagger:0.08, duration:0.5, ease:'power2.out'`).
6. Status badges: verify "Stripe Verified MRR/ARR Leaderboard" shows `bg-utah-blue` (Coming Soon, blue background, white text), "Deeper Investor Analytics" shows `bg-warning-yellow` (Planned, yellow background, dark-blue text). At least one card with status "In Development" would show `bg-hiring-green` — none of the seed nine items use that status, so test by temporarily changing one item's status to "In Development" in DevTools / Vue Devtools and confirm the badge turns green; revert.
7. Top-nav link: from `/` (Map page), click the "Roadmap" nav link — should land on `/roadmap` in one click without auth gates.
8. Domain complete: judges can reach the roadmap from anywhere on the public site via the nav link, the page is responsive, and the GSAP stagger plays once on mount.
</verify>

<done>
- [ ] `RoadmapCard.vue` created with 4 props and status-based badge color computed.
- [ ] `RoadmapView.vue` created with hero, 9-item static array, GSAP stagger fade-in.
- [ ] Router maps `/roadmap` → `RoadmapView.vue` (placeholder removed); `Subscribe` placeholder retained.
- [ ] `App.vue` Roadmap link verified present and unchanged.
- [ ] `npm run build` succeeds.
- [ ] Manual: page reachable without auth, 9 cards render in responsive grid, GSAP stagger plays on mount, status badge colors map correctly per status value.
</done>

---

## Verification Checklist

Maps 1:1 to the Phase 4 success criteria.

- [ ] Clicking **Refresh All** on `/admin/refresh` invokes `refresh-jobs` Edge Function; button shows loading state; new `map_refresh_log` rows appear in the tail within ~5 seconds without a page reload. *(Task 1)*
- [ ] Clicking a per-company **Refresh** button invokes `refresh-jobs` with `{ startup_id }`; that row's `last_refreshed_at` updates after the call resolves. *(Task 1)*
- [ ] `/admin/subscribers` renders the subscriber shell with the `bg-warning-yellow text-utah-blue-dark` "Populates in M9" badge visible, all metric tiles showing zero/placeholder values (`0`, `Never`, `0`), and breakdown tables laid out with `—` rows in both Sector and Stage sections. *(Task 2)*
- [ ] `/roadmap` renders publicly with no auth required, shows all nine roadmap cards in a responsive grid with GSAP stagger fade-in on mount. *(Task 3)*
- [ ] Status badges render in the correct brand color per status: `bg-hiring-green` for In Development, `bg-utah-blue` for Coming Soon, `bg-warning-yellow` for Planned. *(Task 3)*
- [ ] Top-nav `Roadmap` link in `App.vue` navigates to the new page in one click from anywhere on the public site (no broken-route flash, no placeholder). *(Task 3)*
- [ ] `cd goed && npm run build` succeeds end-to-end with no compile errors after all three tasks land. *(Tasks 1–3)*
- [ ] No `console.log` statements committed in any of the new files. *(Tasks 1–3)*

## Success Criteria

Phase 4 is complete when an admin can manually trigger M5 refreshes (bulk and per-company) on `/admin/refresh` and see live log updates without reloading; `/admin/subscribers` renders the M9-ready shell with all placeholders in place; and an unauthenticated visitor reaches `/roadmap` from the top-nav link in one click and sees nine animated roadmap cards with correctly colored status badges. All three previously-placeholder routes (`/admin/refresh`, `/admin/subscribers`, `/roadmap`) now resolve to real, branded views; `PlaceholderView.vue` retains only the `/subscribe` route as its remaining consumer.
