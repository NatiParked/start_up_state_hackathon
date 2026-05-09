# Feature 0008: Engagement — Analytics & Share Cards

> Created: 2026-05-09
> Status: Draft
> Epic: 0001 | Milestone: 10 | Tier: 3

## Overview

This feature closes the retention loop for founders on the Utah Startup Map. It introduces anonymous, fire-and-forget view tracking on every drawer open, surfaces those view counts in a live `CompanyAnalytics` panel inside the founder's `CompanyEditView`, generates branded Open Graph PNG cards via a Satori Edge Function, and wires a `useShareCard` composable plus a Share button on the drawer so any company URL renders as a premium card on LinkedIn and Twitter.

By the end of this feature, a founder who has claimed their listing can see real "views this week / total views" stats, copy a deep-link share URL, and post it to social where it resolves to a Utah-blue branded OG image with company name, sector, stage, and logo. The M9 ecosystem digest also gains real "most-viewed this week" data sourced from the new `company_views` table.

## Problem Statement

Today, founders who claim their listing have no signal that the map matters: there is no view tracking, no analytics surface, and no shareable artifact that motivates them to post the link externally. The `CompanyEditView` is a placeholder ("coming in the next phase"); there is no `CompanyAnalytics` component anywhere in `goed/src/components/map/`; and sharing a URL produces a default Vite preview card on social platforms — visually inert and indistinguishable from a 404.

Without view tracking and OG cards, the engagement flywheel cannot start: founders have nothing to check back for, and shared URLs do not pull traffic. The hackathon judging criteria explicitly weigh polish and viral potential, both of which depend on this feature.

## User Stories

- As a founder who has claimed my listing, I want to see "X views this week / Y views total" inside my edit view so that I have a concrete reason to check the map regularly.
- As any visitor who opens a company drawer, I want my view to be silently recorded so that founders see real-world interest reflected in their analytics.
- As a founder, I want to copy a shareable link to my listing in one click and have it render as a branded OG card on LinkedIn so that posting feels premium and on-brand.
- As an ecosystem subscriber, I want the weekly digest's "most-viewed this week" section to reflect actual map interactions so that the digest stays relevant.
- As a privacy-conscious user, I want the system to record only an anonymous session UUID with each view so that no PII is stored.

---

## Codebase Context

### Technology Stack

Already installed and in use:
- Vue 3.5, Vue Router 5, Pinia 3, Vite 8 — frontend
- `@supabase/supabase-js` — DB client (singleton at `goed/src/lib/supabase.js`)
- Tailwind with Utah brand tokens (`utah-blue: #0065A4`, `hiring-green`, etc.)
- Supabase Edge Functions (Deno runtime) — already in production for `claim-company`, `send-digest`, etc.

To be added (within Edge Function code only — no new npm deps in `goed/`):
- `satori` (Deno-compatible build) for SVG rendering
- A PNG encoder in Deno (e.g. `@resvg/resvg-wasm` via esm.sh, or `satori` + `png` encoder of choice) — final selection deferred to Phase 4

### Relevant Directories

- `goed/src/components/drawer/CompanyDrawer.vue` — existing drawer with `watch(isOpen, ...)` hook (currently fires onboarding logic)
- `goed/src/components/map/` — `CompanyPin.vue`, `EcosystemStatsBar.vue`, `PinCluster.vue`, `SubscribeCTA.vue`, `UtahMap.vue` (no `CompanyAnalytics.vue` exists yet — this feature creates it)
- `goed/src/views/CompanyEditView.vue` — current placeholder; will host `CompanyAnalytics`
- `goed/src/composables/` — existing composables: `useAdminAuth`, `useClaimAuth`, `useLogoDev`, `useOnboarding` (no `useShareCard` yet — this feature creates it)
- `goed/src/lib/supabase.js` — Supabase client singleton
- `supabase/migrations/` — existing migrations 0001–0011 (no 0008/0010 view-tracking migration exists)
- `supabase/functions/` — existing Edge Functions (`claim-company`, `send-digest`, etc.); will gain `track-view` and `generate-og-image`
- `supabase/functions/_shared/` — shared utilities for Edge Functions (CORS helpers, etc.)

### Conventions to Follow

- SFC block order: `<script setup>` → `<template>` → `<style scoped>`
- JS only — no TypeScript anywhere
- snake_case DB column names preserved in Vue state (never converted to camelCase)
- Map-product DB tables prefixed with `map_` — but for cross-product tables like `company_views` and `subscriptions`, follow the precedent set by the existing `subscriptions` migration (no `map_` prefix where the data may be reused outside the map)
- Named exports for composables and `lib/`; default exports for Vue components
- No barrel/`index.js` files — always direct imports
- JSDoc required on all exported functions in `goed/src/lib/` and `goed/src/composables/`
- Edge Functions return JSON `{ data, error }` shape; CORS headers via `_shared/cors.js`
- Tailwind theme tokens only — no raw hex strings in templates (the Utah-blue hex `#0065A4` is allowed inside the OG image renderer, since Satori needs literal CSS strings)
- 2-space indent, single quotes, no semicolons, trailing commas
- No `console.log` in committed frontend code (Edge Functions may use `console.log` for Deno logs)
- Migrations are numeric-prefixed and sequential — next available number is **0012** (the spec's `0010_view_counts.sql` filename collides with existing `0010_map_startups_hide_softdelete.sql`; renumbering is the safer choice — see Open Questions)

---

## Implementation Plan

### Phase 1: Database & View Tracking Migration

**Goal:** Establish the `company_views` table with proper RLS, indexes, and a `get_company_view_stats` RPC so the frontend has a stable, queryable shape for everything that follows.

**Tasks:**

- Create `supabase/migrations/0012_view_counts.sql` (renumbered from spec's `0010` — see Open Questions) containing:
  - `create table company_views (id uuid primary key default gen_random_uuid(), startup_id uuid not null references map_startups(id) on delete cascade, viewed_at timestamptz not null default now(), session_id text not null)`
  - B-tree index on `company_views(startup_id, viewed_at desc)` named `company_views_startup_id_viewed_at_idx` for aggregate queries
  - Enable RLS: `alter table company_views enable row level security;`
  - RLS policy: public `insert` allowed for anon (so the Edge Function called with the anon key can write); no public `select` (stats are exposed only via the `security definer` RPC below)
  - `create or replace function get_company_view_stats(p_startup_id uuid) returns table (views_this_week bigint, views_total bigint) language sql security definer set search_path = public as $$ select count(*) filter (where viewed_at >= now() - interval '7 days') as views_this_week, count(*) as views_total from company_views where startup_id = p_startup_id $$;`
  - `grant execute on function get_company_view_stats(uuid) to anon, authenticated;`
- Apply the migration via Supabase MCP `apply_migration` (mirrors the workflow used in Feature 0001 Phase 2)

**Success Criteria:**

- `company_views` table exists with all 4 columns (`id`, `startup_id`, `viewed_at`, `session_id`) and the `(startup_id, viewed_at desc)` index visible in the Supabase table editor.
- Anonymous client can `insert` into `company_views` and is blocked from `select`.
- Calling `supabase.rpc('get_company_view_stats', { p_startup_id: '<existing id>' })` from a logged-out client returns `{ views_this_week, views_total }` with both counts as numbers (zero when no rows exist for that id).
- The foreign key correctly cascades — deleting a row from `map_startups` removes its `company_views` rows.

---

### Phase 2: Edge Function `track-view` + Drawer Wiring

**Goal:** Ship the fire-and-forget view-tracking pipeline end to end: an Edge Function that records a view in under 50 ms, a stable client-side anonymous session UUID in `sessionStorage`, and a drawer-open hook that dispatches the call without awaiting it. After this phase, opening any drawer increments `company_views` rows in real time.

**Tasks:**

- Create `supabase/functions/track-view/index.js` — Deno Edge Function:
  - Accepts `POST` with JSON body `{ startup_id: string, session_id: string }`
  - Validates that `startup_id` is a UUID and `session_id` is a non-empty string ≤ 64 chars; returns 400 with `{ error: 'invalid input' }` on failure
  - Uses the service-role key (or anon — anon is sufficient given the RLS insert policy) to `insert into company_views { startup_id, session_id }`
  - Returns `{ ok: true }` with status 200 immediately on success; on insert failure logs to `console.error` and still returns 200 (fire-and-forget — never block the user even on internal failure)
  - Includes CORS headers from `supabase/functions/_shared/cors.js`
- Update `goed/src/components/drawer/CompanyDrawer.vue`:
  - In the existing `watch(isOpen, ...)` block at line 49 (or alongside the existing onboarding hook), when `open === true` and `props.company?.id` is set, fire-and-forget call `track-view` via `fetch(${SUPABASE_URL}/functions/v1/track-view, { method: 'POST', body: JSON.stringify({ startup_id, session_id }) })`
  - Read or initialize `session_id` via a tiny inline helper that lives in the same SFC: `const sid = sessionStorage.getItem('goed_session_id') ?? crypto.randomUUID(); sessionStorage.setItem('goed_session_id', sid); return sid` — wrapped in a `try/catch` to handle Safari private-mode/SSR edge cases (fall back to a per-call ephemeral UUID)
  - No `await` on the fetch; no UI state change; no error toast — the call must be invisible to the user
- Deploy the function via `supabase functions deploy track-view`

**Success Criteria:**

- Opening a company drawer in the running dev server triggers a `POST /functions/v1/track-view` call visible in the Network tab; the request resolves in < 200 ms with `200 OK`.
- After opening a drawer, `select count(*) from company_views where startup_id = '<that company>'` in Supabase returns `1` (or N for N drawer opens).
- Opening the same drawer twice in the same browser tab uses the same `session_id` (verifiable in the request payload); opening it in a fresh incognito tab uses a different `session_id`.
- Drawer UI is unaffected by the call — no loading spinner, no error state, no perceived latency on open.

---

### Phase 3: Live `CompanyAnalytics` + Digest Backfill

**Goal:** Replace the placeholder `CompanyEditView` body with a live `CompanyAnalytics` component that calls the `get_company_view_stats` RPC, and update the M9 `send-digest` Edge Function to query the real `company_views` table for the "most-viewed this week" section.

**Tasks:**

- Create `goed/src/components/map/CompanyAnalytics.vue`:
  - Props: `startupId: { type: String, required: true }`
  - Setup: `ref` for `viewsThisWeek`, `viewsTotal`, `isLoading`, `error`
  - `onMounted` calls `supabase.rpc('get_company_view_stats', { p_startup_id: props.startupId })`; populates refs on success, sets `error` on failure, always clears `isLoading`
  - Template renders two stat cards side-by-side using Tailwind brand tokens (`bg-utah-blue`, white text, large numerals); a skeleton shimmer state while `isLoading`; a muted error message on failure
  - SFC block order observed; no logic in template (use `computed` if needed)
- Update `goed/src/views/CompanyEditView.vue`:
  - Replace the "coming in the next phase" placeholder body with: title, brief intro line, `<CompanyAnalytics :startup-id="id" />`, and the existing Sign Out button
  - Import `CompanyAnalytics` directly (no barrel)
- Update `supabase/functions/send-digest/index.js`:
  - Replace the existing fallback (whatever currently fills the "most-viewed this week" slot in the digest) with a query against `company_views` joined to `map_startups`: top 5 by count where `viewed_at >= now() - interval '7 days'`
  - Use `supabase.rpc` or a raw `.from('company_views').select(..., count: 'exact').gte('viewed_at', ...)` chain — choose whichever matches the existing function's style
  - Preserve the existing digest fallback for the case when the table has zero rows in the past week (e.g., reuse the existing ecosystem-stats path)

**Success Criteria:**

- Navigating to `/edit/<claimed-company-id>` (the `CompanyEditView` route) renders the `CompanyAnalytics` component with two visible stat cards showing the current week count and total count for that company.
- Stat counts update on a fresh page load after a new drawer open (i.e., the RPC is wired live, not memoized).
- Calling the deployed `send-digest` Edge Function (or invoking it locally) produces a digest payload whose "most-viewed this week" section lists the top companies from the past 7 days of `company_views` rows; with the table empty, the payload still renders successfully (no 500).
- `CompanyAnalytics.vue` renders correctly in isolation when given a valid `startupId` prop, and degrades to an error state (not a crash) if the RPC fails.

---

### Phase 4: Satori OG Image Edge Function

**Goal:** Generate branded PNG OG cards on demand via a Satori-powered Edge Function, served at a stable URL with a 24-hour cache, so any company deep-link unfurls as a premium card on LinkedIn and Twitter. This is the highest-risk phase — if blocked, view tracking + meta tags from Phase 5 still ship and the OG card can degrade to a static placeholder.

**Tasks:**

- Create `supabase/functions/generate-og-image/index.js` — Deno Edge Function:
  - Imports `satori` from a Deno-compatible source (`https://esm.sh/satori@0.10`) and a PNG encoder (`https://esm.sh/@resvg/resvg-wasm@2`)
  - Accepts `GET` at `/og/:companyId.png` (route handled inside the function via URL parsing — no server router needed)
  - Loads the company row from `map_startups` by id; on miss returns 404 with a generic placeholder PNG
  - Builds a Satori VDOM: 1200×630 frame, Utah-blue background (`#0065A4`), white text — large company name (clipped/wrapped at ~24 chars), sector badge (small pill, `hiring-green` background, white text), stage badge (small pill, white background, Utah-blue text), logo image (fetched from `https://img.logo.dev/{domain}?token=...`, embedded as base64 with a graceful fallback to a Utah-shape SVG when the logo fetch fails or the company has no website)
  - Uses a single embedded font (Inter Regular + Inter Bold, fetched once at module top-level via `fetch` and cached in module scope between invocations) — Satori requires fonts as ArrayBuffers
  - Renders the VDOM to SVG via Satori, then to PNG via the resvg WASM encoder
  - Responds with `Content-Type: image/png` and `Cache-Control: public, max-age=86400, s-maxage=86400`
  - On any internal error, returns a static fallback PNG (small placeholder shipped alongside the function) with `Cache-Control: no-cache` so the cache is not poisoned
- Deploy the function via `supabase functions deploy generate-og-image`
- Smoke-test in the browser: visiting `https://<project>.functions.supabase.co/generate-og-image/og/<a-real-company-id>.png` returns a valid PNG (Content-Type, dimensions, file size sanity)

**Success Criteria:**

- Hitting the deployed function URL with a valid company id returns a 1200×630 PNG with `Content-Type: image/png` and a `Cache-Control: public, max-age=86400` header.
- The rendered card visibly contains the correct company name, sector pill, stage pill, and a logo or fallback shape — verified by opening the URL in a browser and reading the image.
- Hitting the function with an invalid/unknown company id returns the static fallback PNG (HTTP 200 with `Cache-Control: no-cache`) — the function does not 500.
- Re-hitting the same URL within 24 hours is served from CDN cache (verifiable via `cf-cache-status` / `age` headers).
- Pasting the URL into LinkedIn's Post Inspector and Twitter Card Validator produces a valid card preview (manual check at end of phase).

---

### Phase 5: `useShareCard` Composable + Drawer Share Button

**Goal:** Wire the share UX end to end: a composable that constructs the deep-link URL, sets `<meta og:image>` / `<meta twitter:card>` tags dynamically when a drawer is open, and a Share button in the drawer that copies the URL to the clipboard with a "Copied!" confirmation. After this phase, founders and visitors can share any company in one click and the link unfurls correctly on LinkedIn and Twitter.

**Tasks:**

- Create `goed/src/composables/useShareCard.js`:
  - Named export `useShareCard(company)` — accepts a `company` record (object or `Ref<object>`) and returns `{ shareUrl, ogImageUrl, copyLink }` — JSDoc on the function
  - `shareUrl` is a computed `Ref<string>`: `${window.location.origin}/?company=${company.id}` (deep-link auto-opens the drawer — see drawer change below)
  - `ogImageUrl` is a computed `Ref<string>`: pointing to the deployed `generate-og-image` URL with the company id
  - On mount (or when `company.id` changes), upserts the following `<meta>` tags in `document.head`: `og:image`, `og:title`, `og:description`, `twitter:card` (= `summary_large_image`), `twitter:image`, `twitter:title` — finds existing tags by `property=` / `name=` and updates them, or appends new ones
  - On unmount (or when company is cleared), removes the tags it added so subsequent navigation does not leak stale OG state
  - `copyLink()` async function: writes `shareUrl.value` to `navigator.clipboard`, returns `true` on success and `false` on failure (caller renders the "Copied!" UI)
- Update `goed/src/components/drawer/CompanyDrawer.vue`:
  - Import `useShareCard`; instantiate with the open company
  - Add a Share button in the drawer header (next to the existing close/external-link controls); on click calls `copyLink()` and toggles a local `copiedAt` ref to render a 2-second "Copied!" pill confirmation
  - Style with Tailwind brand tokens (`bg-utah-blue`, `hover:bg-utah-blue-dark`, white text)
- Update the `Map` route (`goed/src/router/index.js` or `goed/src/views/MapView.vue`) to read a `?company=<id>` query param on mount and auto-open the corresponding drawer via the existing drawer open mechanism (selecting the pin / setting the active company in the Pinia store) — this is what makes the share URL actually deep-link

**Success Criteria:**

- Opening a drawer and clicking the Share button writes the correct deep-link URL (`<origin>/?company=<id>`) to the clipboard; a "Copied!" pill appears for ~2 seconds and then dismisses.
- Pasting the copied URL into a fresh browser tab loads the map with the corresponding company drawer open automatically.
- While a drawer is open, inspecting `document.head` shows the `og:image` meta tag with the correct `generate-og-image` URL pointing to that company's id; closing the drawer removes/resets the meta tags.
- Pasting the deep-link URL into LinkedIn Post Inspector and Twitter Card Validator renders the branded OG card from Phase 4.
- The share flow works for both an authenticated founder (in `CompanyEditView` indirectly via the same drawer URL) and an anonymous visitor (drawer open from the map view).

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0012_view_counts.sql` | Create | `company_views` table, RLS policies, indexes, `get_company_view_stats` RPC |
| `supabase/functions/track-view/index.js` | Create | Fire-and-forget Edge Function that inserts a row into `company_views` |
| `supabase/functions/_shared/cors.js` | Reuse | Existing CORS helper (no change) |
| `goed/src/components/drawer/CompanyDrawer.vue` | Modify | Fire-and-forget `track-view` call on open; mount `useShareCard`; add Share button |
| `goed/src/components/map/CompanyAnalytics.vue` | Create | Live stats panel (calls `get_company_view_stats` RPC) |
| `goed/src/views/CompanyEditView.vue` | Modify | Replace placeholder body with `<CompanyAnalytics />` |
| `supabase/functions/send-digest/index.js` | Modify | Replace fallback with real `company_views` query for "most-viewed this week" |
| `supabase/functions/generate-og-image/index.js` | Create | Satori-powered Deno Edge Function that returns a 1200×630 branded PNG |
| `goed/src/composables/useShareCard.js` | Create | Composable: constructs share URL, sets OG meta tags, exposes `copyLink()` |
| `goed/src/views/MapView.vue` *(or `router/index.js`)* | Modify | Read `?company=<id>` query param on mount and auto-open the matching drawer |

---

## Testing Strategy

No automated test framework is in scope during the hackathon. Verification is manual and observable, executed at the end of each phase per the success criteria above.

### Manual Verification Checklist (end of feature)

- Opening any company drawer fires a `POST /functions/v1/track-view` and inserts a row in `company_views` (verifiable in Supabase table editor and browser Network tab).
- Visiting a claimed company's edit page (`/edit/<id>`) renders two live stat cards with non-stub view counts.
- Hitting `https://<project>.functions.supabase.co/generate-og-image/og/<id>.png` returns a 1200×630 PNG with the company's name, sector pill, stage pill, and logo on a Utah-blue background.
- Clicking Share in the drawer copies the deep-link URL; pasting it into a new tab auto-opens the matching drawer; pasting it into LinkedIn Post Inspector renders the branded OG card.
- Invoking the `send-digest` Edge Function (manually or via the existing pg_cron schedule) produces a payload whose "most-viewed this week" section is sourced from real `company_views` rows.

---

## Dependencies

### Prerequisites

- Feature 0001 (map foundation, `map_startups` table, router, Pinia stores) — complete.
- Milestone 4 (`CompanyEditView` route registered, claim auth working) — partially complete; this feature creates the `CompanyAnalytics` component the M4 spec said would be a stub.
- Milestone 9 (`send-digest` Edge Function in place) — must exist before Phase 3 backfill.
- Supabase Edge Functions deployment access (already in use for `claim-company`, etc.).

### External Dependencies

- Satori (Deno build via esm.sh) — runtime dep of the OG Edge Function only; no `goed/` npm change.
- @resvg/resvg-wasm (Deno build via esm.sh) — PNG encoder for the OG Edge Function.
- Inter font files (fetched once at module load inside the OG function) — TTF/OTF served from a public URL, e.g. rsms.me/inter/font-files.
- logo.dev (already wired via `useLogoDev`) — consumed inside the OG function for the logo crop.

### Blocking/Blocked By

- **Blocks:** No downstream features in this epic; this is the last engagement-loop milestone.
- **Blocked by:** M9 `send-digest` must exist for Phase 3's digest backfill task. M1 + M4 routes/views must exist for Phase 3's `CompanyEditView` mount.

---

## Open Questions

- The spec calls the migration `0010_view_counts.sql`, but the project already has `0010_map_startups_hide_softdelete.sql` and `0011_admin_map_subscriptions_rls.sql`. **Decision:** renumber to `0012_view_counts.sql` to keep migrations sequential and avoid number collisions. Documented here so the spec source can be reconciled later.
- The spec implies a `CompanyAnalytics.vue` stub already exists from M4, but no such file is present in `goed/src/components/map/`. **Decision:** treat this feature as creating the component from scratch; the M4 stub assumption is wrong.
- The spec calls for the OG card to live at `/og/[company-id].png`. Edge Function URLs are fixed at `https://<project>.functions.supabase.co/<function-name>/...`. **Decision:** the function `generate-og-image` parses the trailing path segment for the id; the public-facing URL becomes `https://<project>.functions.supabase.co/generate-og-image/og/<id>.png`. A clean rewrite via Netlify can be added later if desired.
- Should `track-view` deduplicate rapid double-opens from the same `session_id` within e.g. 1 minute? **Default:** no — record every open; founders see the raw signal. Revisit if spam becomes visible.
- Should `get_company_view_stats` filter out the founder's own session views (avoid self-inflation)? **Default:** no for v1 — founders generally do not browse their own listing in the public map; revisit if it becomes a problem.
- Should the share URL use a path (`/company/<id>`) or a query param (`/?company=<id>`)? **Decision:** query param, because the existing router has `/` as the map route and adding a sub-route would require reshuffling pin selection state. Query param is a one-line read on mount.
