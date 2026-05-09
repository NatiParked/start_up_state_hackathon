# VERIFICATION — Feature 0008 Phase 5

**Date:** 2026-05-09
**Phase:** Phase 5 — `useShareCard` Composable + Drawer Share Button
**App URL:** http://localhost:5173

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 0    | 0    | 1    | 1     |
| ENV        | 1    | 0    | 0    | 1     |
| CODE       | 8    | 0    | 0    | 8     |
| UI         | 0    | 0    | 5    | 5     |
| **Total**  | 9    | 0    | 6    | 15    |

**Overall: PASS**
_(PASS: smoke SKIP is acceptable, 0 ENV failures, 0 CODE failures, 0 UI failures. UI criteria deferred to manual smoke since the Playwright MCP browser session was locked by another running instance.)_

## Smoke Test

**Result:** SKIP
**URL:** http://localhost:5173 (HTTP 200 via curl)

The Vite dev server is reachable, but the Playwright MCP Chromium user-data-dir at `/home/cayden/.cache/ms-playwright/mcp-chrome-d40aa59` was locked by an existing Chrome PID 155197 (started 13:46), so `mcp__playwright__browser_navigate` returned `Browser is already in use`. Per the verify-phase contract, server-running-but-MCP-unavailable maps to SKIP, not FAIL. CODE checks proceeded; UI items recorded as SKIP with PASS-by-code notes.

## Project Context (resolved)

- DEV_URL: `http://localhost:5173` (Vite default; `goed/vite.config.js` does not override)
- SRC_DIR: `goed/src`
- TEMPLATE_EXT: `.vue`, `.js`
- BUILD_DIR: `goed/dist`

## Criteria Results

### ENV

- **PASS** — Dev server responds at `http://localhost:5173` (curl returned `200`).

### CODE (criterion-by-criterion static audit)

- **PASS** — `shareUrl` format is `${window.location.origin}/?company=${id}` — `goed/src/composables/useShareCard.js:64`.
- **PASS** — `ogImageUrl` resolves to the deployed `generate-og-image` URL with the company id — `goed/src/composables/useShareCard.js:71` (`${VITE_SUPABASE_URL}/functions/v1/generate-og-image/og/${id}.png`).
- **PASS** — Share button is rendered in the drawer header with click handler `handleShareClick` — `goed/src/components/drawer/CompanyDrawer.vue:133–137`.
- **PASS** — "Copied!" pill is rendered conditionally and dismissed after ~2 seconds — `goed/src/components/drawer/CompanyDrawer.vue:25–30, 142` (`setTimeout(() => { copiedAt.value = 0 }, 2000)`).
- **PASS** — All six required meta tags are upserted: `og:image`, `og:title`, `og:description`, `twitter:card`, `twitter:image`, `twitter:title` — `goed/src/composables/useShareCard.js:91–96`.
- **PASS** — Managed meta tags are removed on company-cleared and on `onUnmounted` — `goed/src/composables/useShareCard.js:42–49, 77–79, 101–103` (only tags marked `dataset.useShareCard='true'` are removed, so static `index.html` tags are preserved).
- **PASS** — `MapView.vue` reads the `?company=<id>` query param on mount and calls `selectCompany(requestedId)` after `companies` are fetched — `goed/src/views/MapView.vue:28–39`.
- **PASS** — `selectCompany` is a public action of the `startups` store — `goed/src/stores/startups.js:53, 80`.

### UI (deferred to manual smoke; CODE wiring verified above)

- **SKIP** — Click Share → URL copied to clipboard + "Copied!" pill (~2s). _MCP browser unavailable; code wiring at `CompanyDrawer.vue:25–30` confirms the round-trip (await `copyLink()` from `useShareCard`, then `setTimeout` 2000 ms reset)._
- **SKIP** — Pasting deep-link URL auto-opens the corresponding drawer. _MCP browser unavailable; `MapView.vue:32–38` reads `route.query.company` and calls `selectCompany` after `fetchAll()` completes._
- **SKIP** — While drawer is open, `<meta og:image>` is set; closing the drawer removes it. _MCP browser unavailable; `useShareCard.js:74–99` upserts on `company.id` change and `removeManagedTags()` runs on cleared company / `onUnmounted`._
- **SKIP** — LinkedIn Post Inspector / Twitter Card Validator render the branded OG card. _Requires deployed Phase 4 `generate-og-image` Edge Function. Per `STATE.md`, Phase 4 deploy is DEFERRED to ops; once deployed, manual validation per Phase 4 VERIFICATION.md applies._
- **SKIP** — Share flow works for authenticated founder + anonymous visitor. _Same drawer is used in both contexts; both routes render `<CompanyDrawer />` with the same Pinia-driven `selectedCompany`. MCP browser unavailable to exercise both auth states._

## Failures

_None._

## Notes for the next run

- The MCP Chromium user-data-dir was locked. Once the existing Chrome (PID 155197) exits, re-run `/spec:verify-phase 0008 5` to capture full UI criteria via Playwright.
- Phase 4's `generate-og-image` Edge Function still needs an ops deploy before Criterion 4 (LinkedIn/Twitter validators) is testable end-to-end. The deep-link auto-open and meta-tag upsert are independent of that and can be smoked locally without the Edge Function being live.
