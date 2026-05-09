# VERIFICATION — Feature 0007 Phase 4

**Date:** 2026-05-09 18:35 UTC
**Phase:** Map CTA & Admin Panel Population
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 1    | 0    | 0    | 1     |
| CODE       | 4    | 0    | 0    | 4     |
| UI         | 3    | 0    | 3    | 6     |
| **Total**  | 9    | 0    | 3    | 12    |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

> Note: 3 admin-panel UI criteria are SKIP because this run is unattended and lacks
> Supabase magic-link credentials to authenticate as an admin. The route guard
> correctly redirects `/admin/subscribers` → `/admin/login` (verified). Per
> STATE.md, migration `0011_admin_map_subscriptions_rls.sql` is also still pending
> apply to live Supabase, which would block live data even with credentials.

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

Navigated to root, waited 2s, captured snapshot. App rendered fully:
top nav, filter sidebar with all sector/stage/region/investor controls,
EcosystemStatsBar showing live company counts (224 / 55 / 134), 144+
company logos rendered, and the **SubscribeCTA region** (`role="region"`,
`aria-label="Subscribe call to action"`) was present with its Subscribe
and Dismiss buttons.

Console: only a harmless `404 favicon.ico` (cosmetic; no app-level errors).

## Criteria Results

### ENV

- **PASS** — Vite dev server responding on http://localhost:5173 (curl → 200)

### CODE

- **PASS** — `goed/src/components/map/SubscribeCTA.vue` exists (104 lines, complete SFC with Transition + slide-up keyframes, localStorage dismiss, `router.push({ name: 'Subscribe' })`)
- **PASS** — `<SubscribeCTA />` is imported and mounted in `goed/src/views/MapView.vue` (import line 9, mount line 52, after `</main>` so the fixed footer overlays correctly)
- **PASS** — `goed/src/views/admin/SubscriberPanel.vue` rewritten with live queries (`Promise.all` over `map_subscriptions` count + filter_criteria rows + `map_digest_runs` order-by-desc-limit-1; client-side top-5 aggregation for sectors and stages; loading skeleton + error banner; `lastDigestDisplay` computed → `'Never'` fallback)
- **PASS** — Migration file `supabase/migrations/0011_admin_map_subscriptions_rls.sql` exists with idempotent admin-SELECT policies for both tables (mirrors `0007_admin_map_startups_rls.sql` pattern)

### UI

- **PASS** — Map page (`/`) shows the SubscribeCTA sticky footer for a fresh visitor. After navigating with `subscribe_cta_dismissed` cleared from localStorage and waiting ~3s, the `region "Subscribe call to action"` appears in the DOM with the expected text, Subscribe button, and Dismiss button. Visible at `bottom-0 left-0 right-0` with `bg-utah-blue` styling per snapshot.
- **PASS** — Clicking ✕ dismisses the CTA and persists across reload. Click on Dismiss removed the region from the DOM. After hard navigate back to `/` and waiting 4s, the region was still absent (localStorage `subscribe_cta_dismissed = '1'` blocked the timer's reveal).
- **PASS** — Clicking "Subscribe" navigates to `/subscribe`. After clearing localStorage, reloading, waiting 4s, and clicking the Subscribe button inside the CTA region, page URL changed from `/` → `/subscribe` (vue-router named-route push).
- **SKIP** — `/admin/dashboard` Subscribers panel shows real confirmed subscriber count. Cannot verify in unattended mode: admin guard requires a Supabase magic-link session; no credentials available. Confirmed the guard works — `/admin/subscribers` redirects to `/admin/login` cleanly. Additionally, per STATE.md, `0011_admin_map_subscriptions_rls.sql` has not been applied to live DB, so the panel would render zeros under RLS even with credentials. Verify manually after applying the migration and seeding a confirmed row.
- **SKIP** — Admin panel shows last digest run timestamp or "Never". Same auth/DB blocker as above. Code path verified: `lastDigestDisplay` computed returns `new Date(ts).toLocaleString()` when a row exists or `'Never'` when `lastDigestRun.value` is null.
- **SKIP** — Per-filter breakdown table lists sectors and counts. Same auth/DB blocker. Code path verified: client-side aggregation builds top-5 lists for both sectors and stages from `filter_criteria` arrays.

## Failures

_None._

## Skipped — Manual Follow-Up Required

To clear the 3 skipped admin-panel criteria, run interactively (or with MCP OAuth credentials):

1. Apply migration `0011_admin_map_subscriptions_rls.sql` to live Supabase (via Supabase MCP `apply_migration` or the SQL editor).
2. Seed a confirmed subscriber:
   ```sql
   INSERT INTO map_subscriptions (email, filter_criteria, confirmed)
   VALUES ('phase4-demo@example.com',
           '{"sectors":["B2B Software","FinTech"],"stages":["Seed"],"regions":["Salt Lake City metro"],"hiring_only":false,"investor":""}'::jsonb,
           true)
   ON CONFLICT (email) DO UPDATE SET confirmed = true, filter_criteria = EXCLUDED.filter_criteria;
   ```
3. Sign in as an allow-listed admin, navigate to `/admin/subscribers`, confirm: total ≥ 1, "Last digest sent" reads `Never` (or a timestamp if `send-digest` has run), and the By Sector / By Stage tables list non-zero rows.
