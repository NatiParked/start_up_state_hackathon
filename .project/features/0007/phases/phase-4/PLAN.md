# Phase 4 Plan: Map CTA & Admin Panel Population

## Objective

Wire `SubscribeCTA.vue` into `MapView.vue` as a dismissable sticky footer, and replace the zero-filled `SubscriberPanel.vue` shell with live data from `map_subscriptions` and `map_digest_runs`. To support the admin panel reading subscription data without a service-role key in the browser, add an additive RLS migration (`0011_admin_map_subscriptions_rls.sql`) that grants `authenticated` users whose email is in `map_admin_users` SELECT access — mirroring the established admin pattern from `0007_admin_map_startups_rls.sql`.

**Purpose:** Phases 1–3 produced a working subscription pipeline (DB, edge functions, public form). Phase 4 closes the loop by surfacing the CTA on the map (acquisition) and exposing live subscriber metrics in the admin panel (operational visibility for the demo).

**Output:**
- `supabase/migrations/0011_admin_map_subscriptions_rls.sql` — additive admin SELECT RLS on the two new tables.
- `goed/src/components/map/SubscribeCTA.vue` — new sticky footer component with localStorage dismissal and 3s entrance delay.
- `goed/src/views/MapView.vue` — modified to mount `<SubscribeCTA />`.
- `goed/src/views/admin/SubscriberPanel.vue` — modified to query live data and render real metrics.

---

## RLS Architecture Decision (must read before implementing)

`AdminDashboard.vue`, `CompanyList.vue`, and every other admin panel use the browser `supabase` anon-key client (`goed/src/lib/supabase.js`). They successfully read/write `map_startups`, `map_startup_submissions`, etc. because:

1. The user is authenticated via `supabase.auth.signInWithOtp` (magic link) — `auth.role()` becomes `authenticated` (not `anon`).
2. Migrations `0006_admin_users.sql` and `0007_admin_map_startups_rls.sql` add policies of the shape:
   ```sql
   TO authenticated
   USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users))
   ```
3. The `adminGuard` (`goed/src/router/guards.js:13`) checks the same allow-list before letting the route render.

The Phase 1 migration (`0009_subscriptions.sql`) intentionally only granted `service_role` SELECT/UPDATE on `map_subscriptions` and `map_digest_runs` (the digest Edge Function needs that). It did **not** grant any `authenticated` SELECT, so the anon client used by `SubscriberPanel.vue` would currently be blocked by RLS even when a logged-in admin opens the page.

**Chosen approach:** add an **additive** migration `0011_admin_map_subscriptions_rls.sql` mirroring `0007_admin_map_startups_rls.sql`. This is the established pattern, requires no new code path, no service-role key in the browser, no RPC, and keeps `SubscriberPanel.vue` consistent with every other admin panel. Anon visitors still cannot SELECT (no anon policy is added).

**Rejected alternatives:**
- *RPC / SECURITY DEFINER function* — extra surface, extra deploy step; no precedent in this codebase.
- *Service-role client in browser* — leaks the service-role key to all visitors; unacceptable.
- *Permissive `TO authenticated` without allow-list* — would let any signed-in user read every subscriber email, defeating the privacy intent of Phase 1 RLS.

---

## Must-Haves (Goal-Backward)

### Observable Truths

- A first-time map visitor (no `subscribe_cta_dismissed` in `localStorage`) sees a sticky bottom CTA strip on `/` ~3 seconds after the map mounts.
- Clicking the "✕" dismiss button hides the CTA, sets `localStorage['subscribe_cta_dismissed'] = '1'`, and the CTA does **not** reappear after a hard reload.
- Clicking the "Subscribe" button on the CTA calls `router.push({ name: 'Subscribe' })` and lands on `/subscribe`.
- Visiting `/admin/dashboard/subscribers` (the route name `AdminSubscribers`) as a logged-in admin shows **non-zero** values for "Total confirmed subscribers" when at least one confirmed row exists in `map_subscriptions`.
- The same panel renders the most recent `map_digest_runs.run_at` formatted as a human-readable timestamp, or the literal string `"Never"` when the table is empty.
- The "By Sector" breakdown table lists the top 5 sectors across all confirmed subscribers' `filter_criteria.sectors` arrays with their respective counts, and a "By Stage" table does the same for `filter_criteria.stages`.
- The panel shows a loading state while queries are in-flight and an inline error banner (red) if any query fails.
- Anon (logged-out) supabase calls to `map_subscriptions` still return zero rows / RLS-blocked (privacy regression check).

### Required Artifacts

| Path                                                        | Provides                                                                                                  | Key Exports / Content                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `supabase/migrations/0011_admin_map_subscriptions_rls.sql`  | Admin SELECT policies on `map_subscriptions` and `map_digest_runs`                                        | 2 `CREATE POLICY ... TO authenticated USING (... map_admin_users)` blocks            |
| `goed/src/components/map/SubscribeCTA.vue`                  | Sticky footer CTA component with localStorage dismissal + 3s entrance delay                              | Default export Vue SFC; no props                                                    |
| `goed/src/views/MapView.vue` (modified)                     | Mounts `<SubscribeCTA />` as overlay                                                                      | New import + new `<SubscribeCTA />` inside template                                  |
| `goed/src/views/admin/SubscriberPanel.vue` (modified)       | Live subscriber metrics replacing the zero-filled shell                                                   | `fetchStats()`, refs `totalConfirmed`, `filterBreakdown`, `lastDigestRun`, `isLoading`, `error` |

### Required Wiring

| From                                          | To                                                          | Via                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Logged-in admin `supabase` (anon client + JWT)| `map_subscriptions` SELECT                                  | RLS policy `map_subscriptions_admin_select` from new migration                               |
| Logged-in admin `supabase` (anon client + JWT)| `map_digest_runs` SELECT                                    | RLS policy `map_digest_runs_admin_select` from new migration                                 |
| `SubscribeCTA.vue` "Subscribe" button         | `/subscribe` route                                          | `router.push({ name: 'Subscribe' })` (the route name registered in `router/index.js:71`)    |
| `SubscribeCTA.vue` dismiss button             | hide-permanent across reloads                               | `localStorage.setItem('subscribe_cta_dismissed', '1')`                                       |
| `SubscriberPanel.vue` count card              | `map_subscriptions where confirmed = true`                  | `supabase.from('map_subscriptions').select('*', { count: 'exact', head: true }).eq('confirmed', true)` |
| `SubscriberPanel.vue` last-digest tile        | `map_digest_runs` newest row                                | `supabase.from('map_digest_runs').select('run_at').order('run_at', { ascending: false }).limit(1).maybeSingle()` |
| `SubscriberPanel.vue` sector/stage breakdown  | client-side aggregation of `filter_criteria` JSONB          | Loop over rows, increment `Map<sector,count>` and `Map<stage,count>`, sort desc, slice top 5 |

### Key Links (most likely to break)

- **RLS policy not applied:** if `0011_admin_map_subscriptions_rls.sql` is authored but not pushed to Supabase, `SubscriberPanel.vue` will see 0 rows even with confirmed subscriptions. Verification step explicitly inserts a confirmed row and asserts non-zero count.
- **CTA z-index vs map controls:** the OpenLayers map and `EcosystemStatsBar` overlay live inside `mapZoneClasses`. The CTA uses `fixed` positioning with `z-50` and is mounted *outside* the `<main>` flex container so it always overlays.
- **`localStorage` SSR safety:** Vite/Vue 3 SPA — no SSR concern, but the `onMounted` guard ensures `localStorage` is only touched in the browser.
- **`filter_criteria` shape drift:** Phase 3 wrote `{ sectors: [], stages: [], regions: [], hiring_only, investor }`. The aggregation must defensively `?? []` each array because old rows or admin-injected rows may have nulls.

---

## Dependency Graph

```
Task 1 (RLS migration: write + apply)
   │
   ├─► Task 2 (SubscriberPanel.vue live queries)   ← needs RLS to read
   │
   └─► Task 3 (SubscribeCTA.vue + MapView mount)   ← independent of RLS, but
                                                      grouped here so the
                                                      whole phase ships together
```

Task 1 is a hard prerequisite for Task 2 (without the migration applied, the panel queries return empty arrays under RLS).
Task 3 is independent of Task 1 and could run in parallel, but a single executor will likely run them serially.

## Execution Sequences

| Sequence | Tasks      | Parallel? |
| -------- | ---------- | --------- |
| 1        | Task 1     | n/a       |
| 2        | Task 2, Task 3 | Yes (no shared files; both are leaves) |

---

## Tasks

### Task 1: Add admin RLS migration for `map_subscriptions` + `map_digest_runs`

**Type:** auto
**Sequence:** 1
**Estimated effort:** ~15 minutes

<files>
supabase/migrations/0011_admin_map_subscriptions_rls.sql
</files>

<action>
Create a new migration `supabase/migrations/0011_admin_map_subscriptions_rls.sql` modeled exactly on `supabase/migrations/0007_admin_map_startups_rls.sql` (reuse its header style and policy form). The migration must:

1. Header comment block (mirror `0007_admin_map_startups_rls.sql:1-9`):
   - Title line: `-- 0011_admin_map_subscriptions_rls.sql`
   - One-line purpose: `-- Additive RLS policies granting allow-listed admins SELECT access to map_subscriptions and map_digest_runs.`
   - Reference: `-- Feature 0007 Phase 4 — Admin Subscriber Panel population.`
   - Idempotency note: `-- This migration is idempotent: safe to re-run on a partially migrated database.`
   - Reference comments noting RLS was enabled and base policies created in `0009_subscriptions.sql`, and that `map_admin_users` was created in `0006_admin_users.sql`.

2. Two RLS policies, each preceded by `DROP POLICY IF EXISTS ... ON ...;` (idempotency):

   **Policy A — `map_subscriptions_admin_select`** on `map_subscriptions`:
   ```sql
   DROP POLICY IF EXISTS map_subscriptions_admin_select ON map_subscriptions;
   CREATE POLICY map_subscriptions_admin_select
     ON map_subscriptions
     FOR SELECT
     TO authenticated
     USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));
   ```

   **Policy B — `map_digest_runs_admin_select`** on `map_digest_runs`:
   ```sql
   DROP POLICY IF EXISTS map_digest_runs_admin_select ON map_digest_runs;
   CREATE POLICY map_digest_runs_admin_select
     ON map_digest_runs
     FOR SELECT
     TO authenticated
     USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));
   ```

3. Do NOT add UPDATE/INSERT/DELETE policies for `authenticated` — the panel is read-only. Keep `service_role` policies from `0009` untouched (they are additive; both will coexist).

4. Do NOT modify `0009_subscriptions.sql`. Do NOT touch any other migration.

After writing the file, apply it to the live Supabase project using the Supabase MCP `apply_migration` tool with name `0011_admin_map_subscriptions_rls` and the file body. If `apply_migration` is unavailable, use `execute_sql` with the same body. Verify the policies exist with:

```sql
SELECT polname FROM pg_policy
WHERE polrelid IN ('map_subscriptions'::regclass, 'map_digest_runs'::regclass)
  AND polname LIKE '%admin_select%'
ORDER BY polname;
```

Expected: 2 rows — `map_digest_runs_admin_select` and `map_subscriptions_admin_select`.

Then seed at least one confirmed subscriber via `execute_sql` (so Task 2 has something to render in dev):
```sql
INSERT INTO map_subscriptions (email, filter_criteria, confirmed)
VALUES (
  'phase4-demo@example.com',
  '{"sectors":["AI","SaaS"],"stages":["Seed"],"regions":["Salt Lake County"],"hiring_only":false,"investor":""}'::jsonb,
  true
)
ON CONFLICT (email) DO UPDATE SET confirmed = true, filter_criteria = EXCLUDED.filter_criteria;
```
</action>

<verify>
1. File exists: `/home/cayden/code/start_up_state_hackathon/supabase/migrations/0011_admin_map_subscriptions_rls.sql`.
2. `grep -c "CREATE POLICY map_subscriptions_admin_select" supabase/migrations/0011_admin_map_subscriptions_rls.sql` returns `1`.
3. `grep -c "CREATE POLICY map_digest_runs_admin_select" supabase/migrations/0011_admin_map_subscriptions_rls.sql` returns `1`.
4. `grep -c "DROP POLICY IF EXISTS" supabase/migrations/0011_admin_map_subscriptions_rls.sql` returns `2`.
5. `grep -c "TO authenticated" supabase/migrations/0011_admin_map_subscriptions_rls.sql` returns `2`.
6. `grep -c "map_admin_users" supabase/migrations/0011_admin_map_subscriptions_rls.sql` returns at least `2` (one per USING clause).
7. Migration applied successfully via `apply_migration` MCP call (no SQL errors in response).
8. Verification query returns the 2 expected `polname` rows.
9. Seed insert returns 1 row (or upserts existing) — `SELECT count(*) FROM map_subscriptions WHERE confirmed = true;` is `>= 1`.
10. Privacy regression: `SELECT * FROM map_subscriptions;` executed via the Supabase JS client with the **anon key alone (no JWT)** still returns 0 rows (proves the new admin policy did not accidentally widen anon access). Run this in the browser console on a fresh tab while signed out, OR via `curl` against `/rest/v1/map_subscriptions?select=*` with only the `apikey: <anon>` header.
</verify>

<done>
- [ ] `0011_admin_map_subscriptions_rls.sql` file written matching the spec.
- [ ] Migration applied to live Supabase project; both policies visible in `pg_policy`.
- [ ] At least one row in `map_subscriptions` has `confirmed = true` (seed for Task 2 visibility).
- [ ] Anon (logged-out) clients still cannot SELECT `map_subscriptions` rows.
</done>

---

### Task 2: Replace `SubscriberPanel.vue` shell with live queries

**Type:** auto
**Sequence:** 2
**Estimated effort:** ~25 minutes

<files>
goed/src/views/admin/SubscriberPanel.vue
</files>

<action>
Rewrite `goed/src/views/admin/SubscriberPanel.vue` (currently a shell with hard-coded em-dashes and zeros — see lines 1-77). Preserve the existing card visual structure (header card, three-tile grid, two breakdown tables, footer note) but power it with live Supabase queries. Match the visual style and class strings already used by `AdminDashboard.vue` (the existing M9 badge + `Populates in M9` italic note are removed because the panel is now populated).

Imports (frontend convention: no semicolons):
```js
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
```

Reactive state:
```js
const totalConfirmed = ref(0)
const filterBreakdown = ref({ sectors: [], stages: [] })  // { sectors: [{label,count}], stages: [{label,count}] }
const lastDigestRun = ref(null)                           // ISO timestamp string or null
const isLoading = ref(true)
const error = ref(null)
```

`fetchStats()` async function — runs all three queries in parallel via `Promise.all`:

1. **Confirmed count**:
   ```js
   const countRes = await supabase
     .from('map_subscriptions')
     .select('*', { count: 'exact', head: true })
     .eq('confirmed', true)
   ```
   On error throw; otherwise `totalConfirmed.value = countRes.count ?? 0`.

2. **Filter rows for client-side aggregation**:
   ```js
   const rowsRes = await supabase
     .from('map_subscriptions')
     .select('filter_criteria')
     .eq('confirmed', true)
   ```
   On error throw; otherwise aggregate as follows:
   ```js
   const sectorMap = new Map()
   const stageMap = new Map()
   for (const row of rowsRes.data ?? []) {
     const fc = row.filter_criteria ?? {}
     for (const s of fc.sectors ?? []) sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1)
     for (const st of fc.stages ?? []) stageMap.set(st, (stageMap.get(st) ?? 0) + 1)
   }
   const toSortedTop5 = (m) => [...m.entries()]
     .map(([label, count]) => ({ label, count }))
     .sort((a, b) => b.count - a.count)
     .slice(0, 5)
   filterBreakdown.value = {
     sectors: toSortedTop5(sectorMap),
     stages: toSortedTop5(stageMap),
   }
   ```

3. **Last digest run**:
   ```js
   const digestRes = await supabase
     .from('map_digest_runs')
     .select('run_at, subscribers_sent, errors')
     .order('run_at', { ascending: false })
     .limit(1)
     .maybeSingle()
   ```
   On error throw; otherwise `lastDigestRun.value = digestRes.data ?? null`.

Wrap all three in a single `try { isLoading.value = true; error.value = null; ... } catch (err) { error.value = err.message ?? 'Failed to load' } finally { isLoading.value = false }`. Run `Promise.all([countCall, rowsCall, digestCall])` so failures of any one surface to the catch.

Add a helper `computed` `lastDigestDisplay`:
```js
const lastDigestDisplay = computed(() => {
  const ts = lastDigestRun.value?.run_at
  return ts ? new Date(ts).toLocaleString() : 'Never'
})
```

Lifecycle:
```js
onMounted(fetchStats)
```

Template structure (preserve the card classes from the existing file and `AdminDashboard.vue:58-69`):

1. **Header card** (no more "Populates in M9" badge): `<h1 class="text-xl font-semibold text-gray-900">Subscriber Stats</h1>` inside `bg-white rounded-lg border border-gray-200 p-5`. Add a small "Refresh" button on the right that calls `fetchStats()` (`text-xs text-utah-blue hover:underline`).

2. **Error banner** (only when `error` is non-null): `<div v-if="error" class="p-3 bg-red-50 border border-error-red text-error-red text-sm rounded">{{ error }}</div>`.

3. **Three metric tiles** in a `grid grid-cols-1 sm:grid-cols-3 gap-4`:
   - "Total confirmed subscribers" — value `totalConfirmed`, with the same loading-pulse `<div class="h-7 w-24 bg-gray-200 rounded animate-pulse" />` (lifted from `AdminDashboard.vue:65`).
   - "Last digest sent" — value `lastDigestDisplay`.
   - "Subscribers in last digest" — value `lastDigestRun?.subscribers_sent ?? '—'` (small bonus stat; no extra query needed since we already pulled the row).

4. **Two breakdown tables** in a `grid grid-cols-1 lg:grid-cols-2 gap-4` (preserve table classes from existing file lines 42-67):
   - "By Sector" — iterate `filterBreakdown.sectors` with `v-for="row in filterBreakdown.sectors" :key="row.label"`; each row shows `row.label` left and `row.count` right; show `"No data yet"` empty-state row when the array is empty.
   - "By Stage" — same structure, iterating `filterBreakdown.stages`.

5. Remove the old `sectorBreakdown` / `stageBreakdown` mock arrays from `<script setup>`.

6. Remove the M9 "Populates in M9" badge from the header card AND the inline italic note at the bottom of the template (`This panel is a UI shell. M9 (Notifications) populates the live data.`). Replace the bottom note with a small caption: `<p class="text-xs text-gray-400 italic">Counts include confirmed subscribers only. Updated on page load.</p>`.

7. `<style scoped></style>` block at the bottom (empty), per project convention.

No new dependencies; uses only `vue` and the existing `supabase` client. No semicolons in this file. Two-space indent. Keep `<script setup>` first, `<template>` second, `<style scoped></style>` last.
</action>

<verify>
1. File exists: `/home/cayden/code/start_up_state_hackathon/goed/src/views/admin/SubscriberPanel.vue`.
2. `grep -c "from '@/lib/supabase'" goed/src/views/admin/SubscriberPanel.vue` returns `1`.
3. `grep -c "totalConfirmed" goed/src/views/admin/SubscriberPanel.vue` returns at least `3` (declaration + template render + at minimum one assignment).
4. `grep -c "map_subscriptions" goed/src/views/admin/SubscriberPanel.vue` returns at least `2` (count query + filter_criteria query).
5. `grep -c "map_digest_runs" goed/src/views/admin/SubscriberPanel.vue` returns at least `1`.
6. `grep -c "Populates in M9" goed/src/views/admin/SubscriberPanel.vue` returns `0` (legacy badge removed).
7. `grep -E ";\s*$" goed/src/views/admin/SubscriberPanel.vue` returns no lines inside the `<script setup>` block (no semicolons enforcement — the file may contain `;` only inside `<template>` quoted attribute values which is fine).
8. Manual: run `cd goed && npm run dev`, sign in as an allow-listed admin (`map_admin_users.email`), navigate to `/admin/dashboard/subscribers` — page loads without console errors, "Total confirmed subscribers" shows `>= 1` (matches the seed row from Task 1), "Last digest sent" shows either a timestamp or the literal `Never`, and the "By Sector" table shows `AI` and `SaaS` each with count `1` (from the seed row).
9. Manual: stop the dev server, force a query failure (e.g., temporarily change `map_subscriptions` to `map_subscriptionsX` in one of the `from()` calls) — reload the page and confirm the red error banner appears with a non-empty message; restore the file before committing.
10. Manual: in the browser network panel, the three Supabase REST calls fire in parallel (overlapping start times) rather than sequentially.
</verify>

<done>
- [x] `SubscriberPanel.vue` rewritten with live queries; no shell zeros remain.
- [x] Confirmed count, last-digest timestamp, and sector/stage breakdown all render real data when at least one confirmed row exists.
- [x] Loading state (skeleton pulse) shows during the initial fetch.
- [x] Error banner displays on query failure (verified by induced failure).
- [x] No semicolons added in the `<script setup>` block; component matches surrounding admin-page visual style.
Completed: 2026-05-09
</done>

---

### Task 3: Create `SubscribeCTA.vue` and mount it in `MapView.vue`

**Type:** auto
**Sequence:** 2
**Estimated effort:** ~20 minutes

<files>
goed/src/components/map/SubscribeCTA.vue
goed/src/views/MapView.vue
</files>

<action>

**Part A — create `goed/src/components/map/SubscribeCTA.vue`** (new file):

`<script setup>`:
```js
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const dismissed = ref(false)
const visible = ref(false)
const STORAGE_KEY = 'subscribe_cta_dismissed'
let revealTimer = null

function handleDismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch (_e) {
    // localStorage may be disabled (private mode); fall through and just hide for the session
  }
  dismissed.value = true
}

function handleSubscribeClick() {
  router.push({ name: 'Subscribe' })
}

onMounted(() => {
  let alreadyDismissed = false
  try {
    alreadyDismissed = localStorage.getItem(STORAGE_KEY) === '1'
  } catch (_e) {
    alreadyDismissed = false
  }
  if (alreadyDismissed) {
    dismissed.value = true
    return
  }
  revealTimer = window.setTimeout(() => {
    visible.value = true
  }, 3000)
})

onBeforeUnmount(() => {
  if (revealTimer) {
    window.clearTimeout(revealTimer)
    revealTimer = null
  }
})
```

`<template>`:
```html
<Transition name="cta-slide">
  <div
    v-if="visible && !dismissed"
    class="fixed bottom-0 left-0 right-0 bg-utah-blue text-white flex items-center justify-between px-4 py-3 shadow-lg z-50"
    role="region"
    aria-label="Subscribe call to action"
  >
    <p class="text-sm font-medium">
      Get weekly Utah startup updates &rarr;
    </p>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-semibold rounded border border-white text-white hover:bg-white hover:text-utah-blue transition-colors"
        @click="handleSubscribeClick"
      >
        Subscribe
      </button>
      <button
        type="button"
        class="w-8 h-8 inline-flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-utah-blue-dark"
        aria-label="Dismiss"
        @click="handleDismiss"
      >
        &#x2715;
      </button>
    </div>
  </div>
</Transition>
```

`<style scoped>`:
```css
.cta-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.cta-slide-enter-active {
  transition: transform 0.35s ease-out, opacity 0.35s ease-out;
}
.cta-slide-enter-to {
  transform: translateY(0);
  opacity: 1;
}
.cta-slide-leave-from {
  transform: translateY(0);
  opacity: 1;
}
.cta-slide-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.cta-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
```

Conventions: no semicolons in `<script setup>`; brand tokens `utah-blue` and `utah-blue-dark` only (no raw hex); `<script setup>` then `<template>` then `<style scoped>`.

**Part B — modify `goed/src/views/MapView.vue`** (existing file at lines 1-72):

1. Add the import at the top of `<script setup>` after the existing component imports (insert as the **last** component import, line 8 area — after `FilterSidebar`):
   ```js
   import SubscribeCTA from "@/components/map/SubscribeCTA.vue";
   ```

2. Add the CTA mount **outside** the `<main>` flex container so it overlays the entire page (the map's flex layout would otherwise reserve vertical space for it). Place `<SubscribeCTA />` as the **last child of the root `<div :class="layoutClasses">`** (after the closing `</main>` tag, before the closing `</div>`):
   ```html
       </main>
       <SubscribeCTA />
     </div>
   ```

3. Do NOT modify the `<style scoped>` block, the existing computed classes, or the `onMounted` data-fetching logic. This change is purely additive.

Note: `MapView.vue` currently uses semicolons in `<script setup>` (lines 1-29) — this is a pre-existing inconsistency. **Do not "fix" it in this task**; just append the new import using the same style as the surrounding lines (with the trailing semicolon to match local style).
</action>

<verify>
1. File exists: `/home/cayden/code/start_up_state_hackathon/goed/src/components/map/SubscribeCTA.vue`.
2. `grep -c "subscribe_cta_dismissed" goed/src/components/map/SubscribeCTA.vue` returns at least `1`.
3. `grep -c "useRouter" goed/src/components/map/SubscribeCTA.vue` returns `1`.
4. `grep -c "name: 'Subscribe'" goed/src/components/map/SubscribeCTA.vue` returns `1`.
5. `grep -c "fixed bottom-0" goed/src/components/map/SubscribeCTA.vue` returns `1`.
6. `grep -c "bg-utah-blue" goed/src/components/map/SubscribeCTA.vue` returns at least `1`.
7. `grep -c "z-50" goed/src/components/map/SubscribeCTA.vue` returns `1`.
8. `grep -c "import SubscribeCTA" goed/src/views/MapView.vue` returns `1`.
9. `grep -c "<SubscribeCTA" goed/src/views/MapView.vue` returns `1`.
10. Manual (fresh visitor): `localStorage.removeItem('subscribe_cta_dismissed')` in the dev console, hard reload `/`, wait ~3 seconds — sticky bottom bar slides up with text "Get weekly Utah startup updates →", a "Subscribe" outlined button, and a "✕" dismiss button.
11. Manual (Subscribe click): click the "Subscribe" button — URL changes to `/subscribe`, `SubscribeView.vue` mounts.
12. Manual (dismiss persistence): reload `/`, wait 3 seconds — CTA appears; click "✕" — CTA slides away; hard reload `/` — CTA does **not** reappear; `localStorage.getItem('subscribe_cta_dismissed')` returns `'1'`.
13. Manual (no layout regression): the OpenLayers map fills the same vertical space as before (no clipped map controls; the CTA overlays on top, not inside, the map flex container).
</verify>

<done>
- [ ] `SubscribeCTA.vue` exists, uses brand tokens only, has slide-up CSS transition, and is wired to `router.push({ name: 'Subscribe' })`.
- [ ] CTA appears ~3 seconds after first visit; dismissal persists across reloads via `localStorage`.
- [ ] `MapView.vue` imports and mounts `<SubscribeCTA />` outside `<main>` so it overlays without disturbing the map layout.
- [ ] Clicking "Subscribe" navigates to `/subscribe`; clicking "✕" hides the CTA permanently.
</done>

---

## Verification Checklist (1:1 with ROADMAP success criteria)

- [ ] **CTA appears on `/` after ~3 seconds for fresh visitors** — verified by Task 3 step 10 (clear localStorage, reload, wait, observe slide-up).
- [ ] **"✕" dismiss persists across page reloads** — verified by Task 3 step 12 (dismiss + reload + assert no reappearance + `localStorage.getItem` returns `'1'`).
- [ ] **"Subscribe" button navigates to `/subscribe`** — verified by Task 3 step 11.
- [ ] **`/admin/dashboard/subscribers` shows non-zero confirmed subscriber count** — verified by Task 1 seed (`phase4-demo@example.com`) + Task 2 step 8 (manual page load).
- [ ] **Admin panel shows last digest run timestamp (or "Never")** — verified by Task 2 step 8: with no rows in `map_digest_runs`, the tile reads `Never`; after a manual `INSERT INTO map_digest_runs (subscribers_sent, errors) VALUES (1, 0);` and reload, the tile reads a localized timestamp.
- [ ] **Per-filter breakdown table lists sectors and counts** — verified by Task 2 step 8 (seed row contributes `AI: 1` and `SaaS: 1` to "By Sector"; `Seed: 1` to "By Stage").
- [ ] **Privacy preserved (anon cannot read subscribers)** — verified by Task 1 step 10 (anon REST call returns 0 rows / RLS blocks despite the new admin policy).

---

## Success Criteria

Phase 4 is complete when:

1. `supabase/migrations/0011_admin_map_subscriptions_rls.sql` is written, applied, and visible in `pg_policy`.
2. `SubscribeCTA.vue` exists and mounts in `MapView.vue` exactly per Task 3.
3. `SubscriberPanel.vue` shows live data per Task 2 — confirmed count, last digest run, sector + stage breakdown.
4. All 7 items in the Verification Checklist above are checked.
5. Anon clients still cannot SELECT `map_subscriptions` rows (privacy regression check passes).
6. No new ESLint/console errors in `npm run dev`; no map layout regression.
