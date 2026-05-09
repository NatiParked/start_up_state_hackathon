---
phase: 4
feature: 0007
verified: 2026-05-09T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Admin panel queries return live data when migration RLS policies are applied to live Supabase"
    status: failed
    reason: "Migration file is written and structurally correct, but RLS policies are NOT applied to the live Supabase database yet (per STATE.md: unattended session lacked MCP OAuth token for apply step)"
    artifacts:
      - path: "supabase/migrations/0011_admin_map_subscriptions_rls.sql"
        issue: "File created correctly but apply_migration step deferred; policies exist in codebase but not in live DB"
    missing:
      - "Apply migration via `supabase migrations apply --name 0011_admin_map_subscriptions_rls` or paste SQL into Supabase dashboard SQL editor"
      - "Seed a confirmed subscriber row: INSERT INTO map_subscriptions (email, filter_criteria, confirmed) VALUES ('phase4-demo@example.com', '{\"sectors\":[\"AI\",\"SaaS\"],\"stages\":[\"Seed\"],\"regions\":[\"Salt Lake County\"],\"hiring_only\":false,\"investor\":\"\"}'::jsonb, true)"
      - "Verify policies exist: SELECT polname FROM pg_policy WHERE polrelid IN ('map_subscriptions'::regclass, 'map_digest_runs'::regclass) AND polname LIKE '%admin_select%'"
---

# Phase 4: Map CTA & Admin Panel Population Verification Report

**Phase Goal:** Wire `SubscribeCTA.vue` into `MapView.vue` as a dismissable sticky footer; populate `SubscriberPanel.vue` with live `map_subscriptions` and `map_digest_runs` queries; ship additive admin RLS migration `0011_admin_map_subscriptions_rls.sql`.

**Verified:** 2026-05-09
**Status:** gaps_found (1 critical gap: migration not applied to live DB)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CTA appears on `/` after ~3 seconds for fresh visitors | ✓ VERIFIED | `SubscribeCTA.vue` exists with 3000ms `setTimeout`, `subscribe_cta_dismissed` localStorage check in `onMounted` |
| 2 | Dismiss button persists dismissal via localStorage across reloads | ✓ VERIFIED | `handleDismiss()` sets `localStorage.setItem(STORAGE_KEY, '1')`, check in `onMounted` prevents reappearance |
| 3 | Subscribe button navigates to `/subscribe` route | ✓ VERIFIED | `handleSubscribeClick()` calls `router.push({ name: 'Subscribe' })`, route exists in `router/index.js:70` with name `'Subscribe'` |
| 4 | Admin panel shows non-zero confirmed subscriber count when data exists | ✗ FAILED | `SubscriberPanel.vue` implements live `map_subscriptions` count query, but RLS policies blocking the query are not yet applied to live Supabase |
| 5 | Admin panel shows last digest timestamp or "Never" | ✓ VERIFIED | `SubscriberPanel.vue` implements `lastDigestDisplay` computed with `new Date(ts).toLocaleString()` or `'Never'` fallback |
| 6 | Sector/stage breakdown tables list top 5 with counts | ✓ VERIFIED | `SubscriberPanel.vue` aggregates `filter_criteria` arrays client-side, sorts desc, slices to top 5, renders in two breakdown tables |
| 7 | Anon clients cannot read subscribers (privacy preserved) | ✗ UNCERTAIN | RLS policies not yet applied to live DB; cannot verify without manual testing post-apply |

**Score:** 4/7 truths fully verified; 2 require live DB migration apply; 1 is uncertain pending apply

### Required Artifacts

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `supabase/migrations/0011_admin_map_subscriptions_rls.sql` | Admin RLS policies for subscriptions + digest tables | ✓ | ✓ (31 lines, valid SQL) | ✗ (not applied to live DB) | PARTIAL |
| `goed/src/components/map/SubscribeCTA.vue` | Sticky footer with dismissal + router.push | ✓ | ✓ (104 lines, complete) | ✓ (imported + mounted) | VERIFIED |
| `goed/src/views/MapView.vue` (modified) | Mounts SubscribeCTA after </main> | ✓ | ✓ (no changes to logic, only import + mount added) | ✓ (imported line 9, mounted line 52 AFTER </main>) | VERIFIED |
| `goed/src/views/admin/SubscriberPanel.vue` (modified) | Live queries for count, digest, breakdown | ✓ | ✓ (148 lines, complete with Promise.all, error handling, loading state) | ✓ (imports supabase, onMounted calls fetchStats) | VERIFIED |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| SubscribeCTA "Subscribe" button | `/subscribe` route | `router.push({ name: 'Subscribe' })` | ✓ WIRED |
| SubscribeCTA "Dismiss" button | localStorage | `localStorage.setItem('subscribe_cta_dismissed', '1')` | ✓ WIRED |
| SubscribeCTA dismiss check | Prevent reappearance | `localStorage.getItem(STORAGE_KEY) === '1'` in onMounted | ✓ WIRED |
| SubscribeCTA component | MapView layout | `<SubscribeCTA />` mounted AFTER `</main>` (fixed positioning overlay) | ✓ WIRED |
| SubscriberPanel count query | `map_subscriptions` table | RLS policy `map_subscriptions_admin_select` (NOT YET APPLIED TO LIVE DB) | ✗ NOT_WIRED_LIVE |
| SubscriberPanel digest query | `map_digest_runs` table | RLS policy `map_digest_runs_admin_select` (NOT YET APPLIED TO LIVE DB) | ✗ NOT_WIRED_LIVE |
| SubscriberPanel error banner | Supabase query failures | Error handling in catch block, rendered with `v-if="error"` | ✓ WIRED |
| SubscriberPanel loading state | Skeleton pulse during fetch | `v-if="isLoading"` shows `animate-pulse` skeleton | ✓ WIRED |

### Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| `SubscribeCTA.vue` | No TODO/FIXME/placeholder comments | ✓ Clean | ℹ️ None |
| `SubscribeCTA.vue` | No empty returns or hollow implementations | ✓ Full logic | ℹ️ None |
| `SubscriberPanel.vue` | No "Populates in M9" badge or legacy note | ✓ Removed | ℹ️ None |
| `SubscriberPanel.vue` | No TODO/FIXME/placeholder comments | ✓ Clean | ℹ️ None |
| Migration file | Idempotent (DROP POLICY IF EXISTS before each CREATE) | ✓ Present | ℹ️ Correct pattern |

---

## Gaps Summary

**1 critical gap blocking goal achievement:**

### Gap 1: RLS Migration Not Applied to Live Supabase Database

**Truth affected:** "Admin panel shows non-zero confirmed subscriber count" + "Privacy regression check" + "Anon clients cannot read subscribers"

**Root cause:** Unattended `/spec:execute-phase` execution lacked authorized MCP OAuth token (`mcpOAuth.accessToken` empty in `~/.claude/.credentials.json`). The `apply_migration` step in Task 1 was deferred.

**Current state:**
- ✓ File `supabase/migrations/0011_admin_map_subscriptions_rls.sql` is correctly authored (verified all 31 lines, both policies, idempotent pattern)
- ✓ Migration is ready to apply
- ✗ Policies `map_subscriptions_admin_select` and `map_digest_runs_admin_select` do NOT exist in live Supabase database
- ✗ SubscriberPanel queries will return 0 rows under RLS even with confirmed subscribers until this is applied

**Impact on Phase 4:**
- Code is 100% complete and wired correctly
- End-to-end functionality is blocked: admin cannot see live subscriber data in the browser until policies are applied
- `SubscribeCTA.vue` mounting + router wiring works standalone (no blocker for user-facing CTA)
- CTA navigation + dismissal works independently

**Resolution recipe:**

1. **Apply migration via Supabase MCP** (recommended):
   ```bash
   supabase migrations apply --name 0011_admin_map_subscriptions_rls
   ```
   OR manually via Supabase Dashboard SQL Editor:
   ```sql
   -- Copy/paste contents of supabase/migrations/0011_admin_map_subscriptions_rls.sql
   DROP POLICY IF EXISTS map_subscriptions_admin_select ON map_subscriptions;
   CREATE POLICY map_subscriptions_admin_select
     ON map_subscriptions
     FOR SELECT
     TO authenticated
     USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));
   DROP POLICY IF EXISTS map_digest_runs_admin_select ON map_digest_runs;
   CREATE POLICY map_digest_runs_admin_select
     ON map_digest_runs
     FOR SELECT
     TO authenticated
     USING (auth.jwt() ->> 'email' IN (SELECT email FROM map_admin_users));
   ```

2. **Seed a confirmed subscriber** (for demo/testing visibility):
   ```sql
   INSERT INTO map_subscriptions (email, filter_criteria, confirmed)
   VALUES (
     'phase4-demo@example.com',
     '{"sectors":["AI","SaaS"],"stages":["Seed"],"regions":["Salt Lake County"],"hiring_only":false,"investor":""}'::jsonb,
     true
   )
   ON CONFLICT (email) DO UPDATE SET confirmed = true, filter_criteria = EXCLUDED.filter_criteria;
   ```

3. **Verify policies exist** (post-apply):
   ```sql
   SELECT polname FROM pg_policy
   WHERE polrelid IN ('map_subscriptions'::regclass, 'map_digest_runs'::regclass)
   AND polname LIKE '%admin_select%'
   ORDER BY polname;
   ```
   Expected result: 2 rows — `map_digest_runs_admin_select` and `map_subscriptions_admin_select`

4. **Verify privacy (anon blocked)**:
   - Open browser console on `/admin/dashboard/subscribers` while signed out (anon key)
   - Run: `supabase.from('map_subscriptions').select('*')`
   - Expected: RLS blocks the query, returns 0 rows (no error, just empty response)

---

## File-by-File Verification

### 1. Migration File: `supabase/migrations/0011_admin_map_subscriptions_rls.sql`

**Status:** ✓ ARTIFACT SUBSTANTIVE, ✗ NOT YET APPLIED TO LIVE DB

**Evidence:**
- File exists: `/home/cayden/code/start_up_state_hackathon/supabase/migrations/0011_admin_map_subscriptions_rls.sql`
- Line count: 31 lines (substantive, not stub)
- Contains `CREATE POLICY map_subscriptions_admin_select`: ✓ 1 occurrence
- Contains `CREATE POLICY map_digest_runs_admin_select`: ✓ 1 occurrence
- Contains `DROP POLICY IF EXISTS` (idempotency): ✓ 2 occurrences
- Contains `TO authenticated` (authentication guard): ✓ 2 occurrences
- Contains `map_admin_users` (allow-list reference): ✓ 3 occurrences (1 per policy USING clause + 1 in comment)
- Contains no TODO/FIXME/placeholder: ✓ Clean
- Follows established pattern from `0007_admin_map_startups_rls.sql`: ✓ Yes

**Gap:** Not applied to live Supabase database (see Gap 1 above)

### 2. Component: `goed/src/components/map/SubscribeCTA.vue`

**Status:** ✓ VERIFIED (complete, wired, mounted)

**Evidence:**
- File exists: ✓ 104 lines, complete SFC
- Script setup block:
  - Imports `ref, onMounted, onBeforeUnmount` from vue: ✓
  - Imports `useRouter` from vue-router: ✓
  - `dismissed = ref(false)`: ✓
  - `visible = ref(false)`: ✓
  - `STORAGE_KEY = 'subscribe_cta_dismissed'`: ✓
  - `handleDismiss()` calls `localStorage.setItem(STORAGE_KEY, '1')`: ✓
  - `handleSubscribeClick()` calls `router.push({ name: 'Subscribe' })`: ✓
  - `onMounted()` checks localStorage and sets 3-second timeout: ✓
  - `onBeforeUnmount()` clears timeout: ✓
  - No semicolons in script setup (project convention): ✓
- Template:
  - `<Transition name="cta-slide">` wrapper: ✓
  - `fixed bottom-0 left-0 right-0`: ✓ (fixed positioning overlay)
  - `bg-utah-blue text-white`: ✓ (brand colors only)
  - `z-50`: ✓ (high z-index for overlay)
  - `v-if="visible && !dismissed"`: ✓ (visibility gate)
  - Subscribe button: `@click="handleSubscribeClick"`: ✓
  - Dismiss button: `@click="handleDismiss"` with `&#x2715;` (✕ character): ✓
  - Text: "Get weekly Utah startup updates →": ✓
- Styles:
  - `.cta-slide-enter-from` (slide-up on entry): ✓
  - `.cta-slide-leave-to` (slide-down on exit): ✓
  - Transitions all defined: ✓
- Wiring:
  - Imported in `MapView.vue`: ✓ (line 9)
  - Mounted in `MapView.vue`: ✓ (line 52, AFTER `</main>`)

### 3. View: `goed/src/views/MapView.vue` (modified)

**Status:** ✓ VERIFIED (import + mount added correctly)

**Evidence:**
- File exists: ✓
- Import statement added: `import SubscribeCTA from "@/components/map/SubscribeCTA.vue"`: ✓ (line 9, last component import)
- Mount location: `<SubscribeCTA />` on line 52, AFTER `</main>` on line 51: ✓
- Mount structure correct (outside main flex container, so fixed positioning overlays without layout shift): ✓
- No semicolons after import (project convention for frontend): ✓
- No modifications to existing logic, styles, or computeds: ✓

### 4. Panel: `goed/src/views/admin/SubscriberPanel.vue` (modified)

**Status:** ✓ VERIFIED (live queries, error handling, loading state, legacy notes removed)

**Evidence:**
- File exists: ✓ 148 lines, complete rewrite from zero-filled shell
- Script setup:
  - Imports `ref, computed, onMounted` from vue: ✓
  - Imports `supabase` from `@/lib/supabase`: ✓
  - `totalConfirmed = ref(0)`: ✓
  - `filterBreakdown = ref({ sectors: [], stages: [] })`: ✓
  - `lastDigestRun = ref(null)`: ✓
  - `isLoading = ref(true)`: ✓
  - `error = ref(null)`: ✓
  - `fetchStats()` function:
    - Uses `Promise.all([...])` for parallel queries: ✓
    - Query 1: confirmed count via `select(..., { count: 'exact', head: true }).eq('confirmed', true)`: ✓
    - Query 2: rows for aggregation via `select('filter_criteria').eq('confirmed', true)`: ✓
    - Query 3: last digest run via `select('run_at, subscribers_sent, errors').order('run_at', { ascending: false }).limit(1).maybeSingle()`: ✓
    - Client-side aggregation of sectors/stages into Maps, sorted desc, top 5 sliced: ✓
    - Single try/catch/finally wrapping all three queries: ✓
    - `isLoading.value = true` at start, `false` in finally: ✓
    - `error.value` set on catch: ✓
  - `lastDigestDisplay` computed: `new Date(ts).toLocaleString()` or `'Never'`: ✓
  - `onMounted(fetchStats)`: ✓
  - No semicolons in script setup: ✓
- Template:
  - Header card with "Subscriber Stats" title: ✓
  - Refresh button: ✓
  - Error banner: `<div v-if="error" class="... bg-red-50 border-error-red text-error-red ...">`: ✓
  - Three metric tiles grid:
    - "Total confirmed subscribers": `{{ totalConfirmed }}` with loading skeleton: ✓
    - "Last digest sent": `{{ lastDigestDisplay }}` with loading skeleton: ✓
    - "Subscribers in last digest": `{{ lastDigestRun?.subscribers_sent ?? '—' }}` with loading skeleton: ✓
  - Loading skeleton: `<div v-if="isLoading" class="... animate-pulse" />`: ✓ (3 instances)
  - Breakdown tables:
    - "By Sector" table with `v-for="row in filterBreakdown.sectors"`: ✓
    - "By Stage" table with `v-for="row in filterBreakdown.stages"`: ✓
    - Empty state: "No data yet" when array is empty: ✓ (2 instances)
  - Footer note: "Counts include confirmed subscribers only. Updated on page load.": ✓
  - Legacy "M9" badge: ✗ REMOVED (was: "Populates in M9")
  - Legacy inline note: ✗ REMOVED (was: "This panel is a UI shell...")
- Wiring:
  - `supabase` client imported: ✓
  - `fetchStats()` called on `onMounted`: ✓
  - Three Supabase queries implemented: ✓

### 5. Router: `goed/src/router/index.js`

**Status:** ✓ VERIFIED (Subscribe route wired correctly)

**Evidence:**
- Route name `'Subscribe'` exists: ✓ (line 70)
- Route path `/subscribe`: ✓ (line 69)
- Component lazy-loaded from `SubscribeView.vue`: ✓ (line 71)
- SubscribeView file exists and is substantive (312 lines): ✓

---

## Summary

**Code completion:** ✓ 100% — All artifacts written, wired, and substantive

**Database application:** ✗ Incomplete — Migration not applied to live Supabase

**Blockers for Phase 4 approval:**
1. Apply RLS migration to live Supabase database
2. Seed at least one confirmed subscriber row
3. Verify policies exist in `pg_policy`
4. Test admin access to SubscriberPanel

**Non-blockers (code-only verification):**
- SubscribeCTA wiring: ✓ Verified
- SubscribeView target: ✓ Verified
- SubscriberPanel queries: ✓ Verified (will work post-migration)
- Router configuration: ✓ Verified

---
_Verified by: task-verifier_  
_Timestamp: 2026-05-09_
