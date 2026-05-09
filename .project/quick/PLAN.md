# Quick Plan: Admin List Independent Scrolling

## Context

`AdminLayout.vue:82` already provides a bounded scroll container via `<main class="flex-1 min-h-0 overflow-hidden flex flex-col">`. `CompanyList.vue` (verified) already uses the strict pattern (`h-full flex flex-col p-6` root, `flex-1 min-h-0 overflow-y-auto` table wrapper) — only its `<thead>` needs sticky pinning. The remaining four admin views either lack the strict pattern (`SubmissionQueue.vue`, `RefreshControl.vue`) or lack a page-level scroll container (`SubscriberPanel.vue`, `AdminDashboard.vue`). `RefreshControl.vue` additionally needs a tab strip to host its two large tables (Companies + Refresh Log) under one scroll region. **Polling lifecycle (`setInterval(loadLogs, 5000)` in `RefreshControl.vue:78`) must remain unchanged and must not be tab-gated.**

## Tasks

### Task 1: Pin CompanyList table headers [x]

<files>
goed/src/views/admin/CompanyList.vue
</files>

<action>
On line 120, change `<thead class="bg-gray-50">` to `<thead class="bg-gray-50 sticky top-0">`. Make no other edits in this file. Do not touch the root `<div class="h-full flex flex-col p-6">`, the GSAP `panelRef` Teleport, or the existing `flex-1 min-h-0 overflow-y-auto overflow-x-auto` table wrapper at line 118 — they are already correct.
</action>

<verification>
On `/admin/companies`, scroll the table down — the column header row ("Name", "Sector", "Stage", "Created At", "Actions") stays pinned at the top of the scroll region. No body scrollbar appears.
</verification>

Completed: 2026-05-09

---

### Task 2: Apply strict scroll pattern to SubmissionQueue [x]

<files>
goed/src/views/admin/SubmissionQueue.vue
</files>

<action>
Edit the template only — do not touch `<script setup>` or the `<Teleport to="body">` block (lines 130–151). Five mechanical changes:

1. **Line 41 root:** change `<div class="relative">` to `<div class="h-full flex flex-col p-6">`.
2. **Line 43 header block:** change `<div class="flex items-center justify-between mb-6">` to `<div class="shrink-0 flex items-center justify-between mb-6">`.
3. **Line 53 loading state:** change `<div v-if="isLoading" class="py-12 text-center text-gray-500 text-sm">` to `<div v-if="isLoading" class="flex-1 py-12 text-center text-gray-500 text-sm">`.
4. **Lines 58–63 empty state:** change `class="py-12 text-center text-gray-400 text-sm"` to `class="flex-1 py-12 text-center text-gray-400 text-sm"`.
5. **Line 66 table wrapper:** change `<div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">` to `<div v-else class="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-white">`.
6. **Line 68 thead:** change `<thead class="bg-gray-50">` to `<thead class="bg-gray-50 sticky top-0">`.

The Teleport review panel is a fixed-position overlay rendered to `body` and is unaffected by parent flex layout — leave it alone.
</action>

<verification>
On `/admin/submissions`, the page does not produce a body scrollbar. With many rows, the table scrolls inside its own region with the header row pinned. Switching between loading/empty/populated states does not cause vertical jump. Clicking "Review" still slides in the right-side panel correctly.
</verification>

Completed: 2026-05-09

---

### Task 3: Restructure RefreshControl with tabs [x]

<files>
goed/src/views/admin/RefreshControl.vue
</files>

<action>
**Script changes (additive only — keep all existing logic, including `setInterval(loadLogs, 5000)` polling and `onUnmounted` cleanup):**

In `<script setup>`, add after line 14 (next to other refs):
```js
const activeTab = ref('companies')
```

**Template — full replacement of the `<template>` block.** Replace lines 89–200 with:

```vue
<template>
  <div class="h-full flex flex-col p-6 gap-6">
    <h1 class="shrink-0 text-xl font-semibold text-gray-900">Refresh Control</h1>

    <!-- Section 1: Bulk Refresh -->
    <section class="shrink-0 bg-white rounded-lg border border-gray-200 p-5">
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

    <!-- Tab strip -->
    <div class="shrink-0 flex gap-1 p-1 bg-gray-100 rounded-md w-fit">
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded transition-colors"
        :class="activeTab === 'companies' ? 'bg-utah-blue text-white' : 'text-gray-600 hover:bg-gray-200'"
        @click="activeTab = 'companies'"
      >
        Companies
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded transition-colors"
        :class="activeTab === 'log' ? 'bg-utah-blue text-white' : 'text-gray-600 hover:bg-gray-200'"
        @click="activeTab = 'log'"
      >
        Refresh Log
      </button>
    </div>

    <!-- Active tab panel -->
    <section class="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200">
      <!-- Companies tab -->
      <template v-if="activeTab === 'companies'">
        <div class="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Companies</h2>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name..."
            class="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-utah-blue"
          />
        </div>
        <div v-if="isLoading" class="flex-1 py-8 text-center text-gray-500 text-sm">Loading…</div>
        <div v-else class="flex-1 min-h-0 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 sticky top-0">
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
      </template>

      <!-- Log tab -->
      <template v-else>
        <div class="shrink-0 px-5 py-3 border-b border-gray-200">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Refresh Log (last 20, polled every 5s)</h2>
          <div v-if="logError" class="mt-2 text-error-red text-sm">Failed to load log: {{ logError.message ?? logError }}</div>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 text-xs">
            <thead class="bg-gray-50 sticky top-0">
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
      </template>
    </section>
  </div>
</template>
```

**Critical:** do not move, gate, or otherwise alter `setInterval(loadLogs, 5000)` (line 78), `onUnmounted` cleanup (lines 81–86), or any of `handleRefreshAll`, `handleRefreshOne`, `loadLogs`, `filteredCompanies`, `startupNameById`, or the existing refs. Polling continues regardless of `activeTab` value.
</action>

<verification>
On `/admin/refresh`: no body scrollbar. The "Refresh Control" header, "Bulk Refresh" card, and tab strip stay pinned while the active tab's table scrolls inside its region with sticky thead. Click "Refresh Log" tab — log table appears with sticky header. Click back to "Companies" — companies table reappears, search input still works. Open browser devtools network tab and confirm `map_refresh_log` SELECT query continues firing every ~5s while either tab is active.
</verification>

Completed: 2026-05-09

---

### Task 4: Wrap SubscriberPanel in page scroll container [x]

<files>
goed/src/views/admin/SubscriberPanel.vue
</files>

<action>
On line 71, change `<div class="p-6 space-y-6">` to `<div class="h-full overflow-y-auto p-6 space-y-6">`. No other changes anywhere in the file.
</action>

<verification>
On `/admin/subscribers` with a short viewport (e.g., resize window to ~500px tall), the entire page content scrolls within the main content region — no body scrollbar appears, the sidebar and admin header stay fixed.
</verification>

Completed: 2026-05-09

---

### Task 5: Wrap AdminDashboard in page scroll container [x]

<files>
goed/src/views/admin/AdminDashboard.vue
</files>

<action>
On line 51, change `<div>` to `<div class="h-full overflow-y-auto p-6">`. The `<h1 class="text-xl font-semibold text-gray-900 mb-6">` on line 52 stays exactly as written — its `mb-6` continues to give it bottom spacing inside the new padded container.
</action>

<verification>
On `/admin` (dashboard), with a short viewport, the metric grid scrolls within the main content region — no body scrollbar appears. With a tall viewport, layout matches previous appearance (h1 with bottom margin, then the metrics grid below).
</verification>

Completed: 2026-05-09

## Notes

- **Do NOT touch `goed/src/views/admin/AdminLayout.vue`.** Its `<main class="flex-1 min-h-0 overflow-hidden flex flex-col">` (line 82) is the bounded parent that makes child `h-full` + `flex-1 min-h-0 overflow-y-auto` work. Removing `overflow-hidden` there would break every page in this plan.
- **CompanyList GSAP / Teleport:** the `panelRef` slide-in animation and Teleport editor panel (`CompanyList.vue:209–221`) are fixed-positioned overlays — Task 1's `<thead>` change does not interact with them. Verify the editor still slides in after the change.
- **SubmissionQueue Teleport:** identical situation — the review panel teleports to `body` with `fixed inset-0`, so it lives outside the new flex layout. Do not nest it into the new scroll container.
- **RefreshControl polling lifecycle is the highest-risk item.** The `setInterval(loadLogs, 5000)` and matching `onUnmounted` cleanup must remain in `onMounted`/`onUnmounted` exactly as written. Do not wrap polling in a `watch(activeTab, …)` or otherwise condition it on the active tab — the spec mandates polling continues regardless of which tab is visible.
- All work is JS + template + Tailwind utility classes only. No new files, no new dependencies, no script imports added beyond the single `activeTab` ref in Task 3.
