# Feature 0007: Engagement — Subscriptions & AI Digest

> Created: 2026-05-09
> Status: Draft
> Epic: 0001

## Overview

This feature builds the primary retention mechanic for the Utah Startup Map: a subscription form with double opt-in, a weekly AI-written digest Edge Function, and a sticky map CTA that surfaces the subscription flow to visitors. It also fully populates the `SubscriberPanel.vue` admin shell built in Feature 0005 (Milestone 6).

Visitors filter the map by sector, stage, region, and hiring status, then subscribe with one click to receive a weekly email written by Google Gemini. The digest runs in one of two modes per subscriber: personalized (≥1 matching update since last send) or ecosystem highlights (0 matches — broad Utah startup activity to maintain weekly cadence). No digest is ever skipped.

**AI model note:** All AI calls use Google Gemini 2.0 Flash via the existing `callLLM()` helper in `supabase/functions/_shared/llm.js` (locked codebase decision; `GOOGLE_AI_API_KEY` env var). The milestone spec refers to "Claude" but Gemini is the canonical model for this project.

**New secret required:** `RESEND_API_KEY` must be added via `supabase secrets set RESEND_API_KEY=...` before deploying the digest function or confirm flow.

## Problem Statement

After Milestone 6 ships, there is no mechanism to bring visitors back. The map is a point-in-time snapshot from the visitor's perspective: they see it once and leave. Without re-engagement, the map's value to GOED is limited to one-time discovery. Subscriptions give GOED a direct channel to founders, investors, and job-seekers — and give judges a visible retention metric that distinguishes the product from a static directory.

The `SubscriberPanel.vue` currently shows zeroes. GOED staff have no way to know whether the subscription feature works or how many people are signed up.

## User Stories

- As a map visitor, I want to subscribe with my email and specify sectors/stages/regions I care about so that I receive relevant weekly startup activity instead of noise.
- As a subscriber, I want to receive a confirmation email before being added to any list so that I stay in control of my inbox.
- As a subscriber, I want to receive a Gemini-written weekly digest tailored to my filter criteria so that I learn about new Utah startups that match my interests.
- As a map visitor, I want to see a subtle CTA reminding me I can get weekly updates so that I don't leave without subscribing.
- As a GOED admin, I want the SubscriberPanel to show real subscriber counts and last-digest timestamp so that I can demonstrate retention metrics during the demo.

---

## Codebase Context

### Technology Stack

Already in place:
- Vue 3.5, Vue Router 5, Pinia 3, Vite 8 — frontend SPA
- `@supabase/supabase-js` — DB client singleton at `goed/src/lib/supabase.js`
- Supabase Edge Functions (Deno) — `supabase/functions/`
- `pg_cron` + `pg_net` extensions — already enabled via `supabase/migrations/0004_pg_cron.sql`
- `callLLM()` — Gemini 2.0 Flash LLM helper at `supabase/functions/_shared/llm.js`
- `createAdminClient()` — service-role Supabase client at `supabase/functions/_shared/supabaseAdmin.js`
- Tailwind brand tokens: `utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`

New external dependency:
- **Resend** — transactional email API; requires `RESEND_API_KEY` secret; used via `fetch('https://api.resend.com/emails', ...)` (no npm package — Deno fetch)

### Relevant Directories

- `goed/src/views/` — add `SubscribeView.vue`
- `goed/src/components/map/` — add `SubscribeCTA.vue`; update `MapView.vue`
- `goed/src/views/admin/` — update `SubscriberPanel.vue` (shell exists from Feature 0005)
- `supabase/migrations/` — add `0009_subscriptions.sql`
- `supabase/functions/send-digest/` — new Edge Function directory
- `supabase/functions/confirm-subscription/` — new Edge Function for opt-in confirm link
- `goed/src/router/index.js` — `/subscribe` already registered as PlaceholderView; replace with real view

### Conventions to Follow

- `<script setup>` → `<template>` → `<style scoped>` SFC block order
- Composition-style Pinia stores with `isLoading` + `error` refs
- `camelCase` for JS; `PascalCase.vue` for components; `kebab-case` for Edge Function dirs
- Edge Function files: `index.js` + helpers in same folder; cross-function helpers in `_shared/`
- All Map-product tables must be prefixed `map_`: use `map_subscriptions`, `map_digest_runs`
- Deno import style: `npm:@supabase/supabase-js@2`; relative imports include `.js` extension
- Semicolons in Edge Functions; no semicolons in Vue/frontend files
- `errorResponse(code, message, status)` + CORS headers on every Edge Function response
- `storeToRefs(store)` when destructuring reactive state from Pinia stores in views

---

## Implementation Plan

### Phase 1: Database Schema & Migration

**Goal:** Create the `map_subscriptions` and `map_digest_runs` tables, RLS policies that allow public insert but restrict reads, a confirmation token column for double opt-in, and the pg_cron entry that will invoke `send-digest` weekly.

**Tasks:**

- Create `supabase/migrations/0009_subscriptions.sql` containing:
  - `create table map_subscriptions (id uuid primary key default gen_random_uuid(), email text not null, filter_criteria jsonb not null default '{}', frequency text not null default 'weekly', last_digest_sent timestamptz, confirm_token uuid not null default gen_random_uuid(), confirmed boolean not null default false, created_at timestamptz not null default now())` — `confirm_token` is the single-use UUID emailed to the subscriber for double opt-in
  - Unique constraint on `email` to prevent duplicate subscriptions
  - `create table map_digest_runs (id uuid primary key default gen_random_uuid(), run_at timestamptz not null default now(), subscribers_sent int not null default 0, errors int not null default 0)`
  - Enable RLS on both tables
  - RLS on `map_subscriptions`: `INSERT` allowed for anon (any visitor can subscribe); `SELECT/UPDATE` allowed only for service-role (used by Edge Functions); no client-side read of other users' subscriptions
  - RLS on `map_digest_runs`: service-role INSERT/SELECT only; no anon access
  - Index on `map_subscriptions(confirmed)` for fast "all confirmed" queries
  - Index on `map_subscriptions(email)` for duplicate check
  - pg_cron entry: `select cron.schedule('send-digest-weekly', '0 9 * * 1', $$select net.http_post(url := current_setting(''app.supabase_functions_url'') || ''/send-digest'', headers := json_build_object(''Authorization'', ''Bearer '' || current_setting(''app.service_role_key''))::jsonb, body := ''{}''::jsonb) as request_id$$)` — fires Mondays at 09:00 UTC; note the schedule SQL is provided as a reference only (must be applied via SQL editor post-migration since `current_setting` values must be configured per project)

**Success Criteria:**

- `map_subscriptions` table exists with all columns including `confirm_token`, `confirmed`, and `filter_criteria jsonb`
- `map_digest_runs` table exists with `run_at`, `subscribers_sent`, `errors` columns
- Anon client can `insert` into `map_subscriptions` but cannot `select` rows from it
- Service-role client can `select *` from `map_subscriptions`
- RLS is enabled on both tables (visible in Supabase dashboard → Table Editor → RLS column)

---

### Phase 2: Send-Digest Edge Function

**Goal:** Build the complete `send-digest` Edge Function: the prompt builder module (`prompts.js`) with both digest modes and the orchestrator (`index.js`) that queries confirmed subscribers, generates Gemini-written email content per subscriber, sends via Resend, and logs the run to `map_digest_runs`.

**Tasks:**

- Create `supabase/functions/send-digest/prompts.js`:
  - Export `SYSTEM_PROMPT` — a `const string` establishing the AI as a Utah startup ecosystem analyst writing weekly updates; tone: informative, concise, professional; no fluff; include Utah context
  - Export `buildPersonalizedPrompt(subscriber, updates)` — receives a subscriber object (with `filter_criteria`) and an array of company update objects; returns a user-prompt string describing what changed in their watched sectors/stages this week; instructs model to write subject line + 2–4 paragraph HTML email body
  - Export `buildEcosystemPrompt(subscriber, highlights)` — receives subscriber object and `highlights` object `{ hiringCount, newestCompany, totalCompanies }`; returns a user-prompt for a broader ecosystem digest; instructs model to write subject line + 2–3 paragraph HTML email body covering Utah startup activity
  - Both prompt builders must request a JSON response with keys `{ subject: string, htmlBody: string }` so the caller can destructure cleanly

- Create `supabase/functions/send-digest/index.js`:
  - File-level JSDoc with purpose and service-role-only auth note
  - `corsHeaders` const + OPTIONS preflight short-circuit
  - Method guard: only POST accepted
  - Inline `jsonResponse` / `errorResponse` helpers
  - Main handler steps:
    1. Create service-role Supabase client via `createAdminClient()`
    2. Fetch `RESEND_API_KEY` from `Deno.env.get('RESEND_API_KEY')` — throw descriptively if missing
    3. Fetch all confirmed subscribers: `select * from map_subscriptions where confirmed = true`
    4. For each subscriber:
       a. Query `map_startups` for rows where `created_at > last_digest_sent OR updated_at > last_digest_sent` that match `filter_criteria` (sector/stage/region array containment; `is_hiring` boolean if `hiring_only` is set)
       b. If `updates.length >= 1` → mode = `personalized`; call `buildPersonalizedPrompt(subscriber, updates)`
       c. If `updates.length === 0` → mode = `ecosystem_highlights`; query `map_startups` for `{ hiringCount: count of is_hiring=true, newestCompany: most recently created row, totalCompanies: total count }` → call `buildEcosystemPrompt(subscriber, highlights)`
       d. Call `callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt: builtPrompt, schema: { subject: 'string', htmlBody: 'string' } })` — parse JSON response; log error and skip subscriber on parse failure
       e. Build Resend payload: `{ from: 'Utah Startup Map <digest@utah-startup-map.com>', to: subscriber.email, subject, html: htmlBody + unsubscribeFooter }`; unsubscribe footer is a plain HTML `<p>` linking to `/subscribe?unsubscribe=<subscriber.id>`
       f. `await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer <RESEND_API_KEY>', 'Content-Type': 'application/json' }, body: JSON.stringify(resendPayload) })` — log error and increment `errors` count on non-2xx
       g. On success: `update map_subscriptions set last_digest_sent = now() where id = subscriber.id`
    5. Insert row into `map_digest_runs` with `subscribers_sent` and `errors` totals
    6. Return `jsonResponse({ sent: subscribersSent, errors }, 200)`
  - All errors are caught per-subscriber; a single failure never aborts the run; outer try/catch returns 500 on unexpected crash

**Success Criteria:**

- `supabase/functions/send-digest/prompts.js` exports `SYSTEM_PROMPT`, `buildPersonalizedPrompt`, and `buildEcosystemPrompt`; calling `buildPersonalizedPrompt({}, [])` returns a non-empty string
- `supabase/functions/send-digest/index.js` exists, handles CORS preflight, and handles the case of 0 confirmed subscribers by returning `{ sent: 0, errors: 0 }` without throwing
- Calling the function with a service-role JWT and zero subscribers in the DB returns HTTP 200 with `{ sent: 0, errors: 0 }`
- The function can be invoked via `supabase functions invoke send-digest --no-verify-jwt` with a mock service-role call (local test; actual email delivery verified manually or in staging)

---

### Phase 3: Subscribe View & Confirmation Flow

**Goal:** Replace the `/subscribe` PlaceholderView with a real subscription form capturing email + filter preferences, send a Resend double opt-in confirmation email on submit, and handle the confirmation click via a dedicated Edge Function that sets `confirmed = true`.

**Tasks:**

- Create `supabase/functions/confirm-subscription/index.js`:
  - Accepts GET request with query param `?token=<confirm_token>`
  - Looks up `map_subscriptions` by `confirm_token`; if not found → redirect to `/subscribe?error=invalid`
  - If already confirmed → redirect to `/subscribe?confirmed=already`
  - On success: `update map_subscriptions set confirmed = true where confirm_token = token` → redirect to `/subscribe?confirmed=true`
  - Uses service-role client (needs to update the row)
  - CORS headers on all responses; method: GET only

- Update `goed/src/router/index.js`:
  - Replace the `/subscribe` PlaceholderView route with a lazy `() => import('@/views/SubscribeView.vue')` route (name: `'Subscribe'` — preserves existing route name)

- Create `goed/src/views/SubscribeView.vue`:
  - `<script setup>`: import `ref`, `computed`, `onMounted` from vue; import `useRoute` from vue-router; import `supabase` from `@/lib/supabase`
  - Reactive state: `email = ref('')`, `sectors = ref([])`, `stages = ref([])`, `regions = ref([])`, `hiringOnly = ref(false)`, `investor = ref('')`, `isSubmitting = ref(false)`, `submitted = ref(false)`, `error = ref(null)`
  - `onMounted`: check `route.query.confirmed` — if `'true'`, show success banner; if `'already'`, show "already confirmed" message; check `route.query.unsubscribe` — if present, call `supabase.from('map_subscriptions').delete().eq('id', unsubscribeId)` and show unsubscribed confirmation
  - `handleSubmit()` async function:
    1. Validate email is non-empty and passes `new URL('mailto:' + email.value)` pattern (use native email input `required type="email"` as primary guard)
    2. Build `filter_criteria = { sectors: sectors.value, stages: stages.value, regions: regions.value, hiring_only: hiringOnly.value, investor: investor.value.trim() }`
    3. `const { error: dbError } = await supabase.from('map_subscriptions').insert({ email: email.value, filter_criteria })`
    4. On success: call the confirm email send via `supabase.functions.invoke('send-confirmation', { body: { email: email.value } })` — **Note:** the actual Resend call for the confirmation email lives in a separate `send-confirmation` Edge Function (see below); the confirm link in the email points to `<SUPABASE_FUNCTIONS_URL>/confirm-subscription?token=<confirm_token>`
    5. Set `submitted.value = true`; clear form
    6. On dbError with code `23505` (unique violation): show "You're already subscribed" message
  - Template: email input + 5 filter widgets (sector multi-select checkboxes, stage multi-select, region multi-select, hiring-only toggle, investor text input); "Subscribe" button; success state ("Check your inbox to confirm"); sector/stage/region options hardcoded from the known values in `map_startups` (AI, SaaS, HealthTech, FinTech, EdTech, CleanTech, etc.)
  - Use Tailwind brand tokens only; `utah-blue` primary button; form layout clean and mobile-friendly

- Create `supabase/functions/send-confirmation/index.js`:
  - Accepts POST with `{ email: string }`
  - Looks up `map_subscriptions` by email (service-role) to retrieve `confirm_token` and `id`
  - Sends Resend email: subject "Confirm your Utah Startup Map subscription", body with a prominent "Confirm my subscription" button linking to `<SUPABASE_URL>/functions/v1/confirm-subscription?token=<confirm_token>`
  - Returns 200 on success; 400 if email not found; 500 on Resend failure
  - Uses `RESEND_API_KEY` from env

**Success Criteria:**

- Navigating to `/subscribe` shows the real subscription form (not PlaceholderView)
- Filling in an email + at least one sector and submitting shows the "Check your inbox" confirmation state
- The `map_subscriptions` table gains a new row with `confirmed = false` and a non-null `confirm_token` after submission
- Submitting the same email a second time shows the "already subscribed" message (no duplicate row created)
- Navigating to `/subscribe?confirmed=true` shows the success banner without requiring a form submission
- The unsubscribe flow: navigating to `/subscribe?unsubscribe=<valid-id>` removes the row and shows a confirmation message

---

### Phase 4: Map CTA & Admin Panel Population

**Goal:** Wire `SubscribeCTA.vue` into `MapView.vue` as a dismissable sticky footer, and replace the zero-filled `SubscriberPanel.vue` shell with live data from `map_subscriptions` and `map_digest_runs`.

**Tasks:**

- Create `goed/src/components/map/SubscribeCTA.vue`:
  - `<script setup>`: `ref`, `onMounted` from vue; `useRouter` from vue-router
  - State: `dismissed = ref(false)`, `visible = ref(false)`
  - `onMounted`: check `localStorage.getItem('subscribe_cta_dismissed')` — if set, `dismissed.value = true`; otherwise `visible.value = true` after a 3-second delay (don't interrupt immediate map browsing)
  - `handleDismiss()`: sets `localStorage.setItem('subscribe_cta_dismissed', '1')`, `dismissed.value = true`
  - `handleSubscribeClick()`: `router.push({ name: 'Subscribe' })`
  - Template: sticky bottom strip (Tailwind: `fixed bottom-0 left-0 right-0 bg-utah-blue text-white flex items-center justify-between px-4 py-3 shadow-lg z-50`) — left text: "Get weekly Utah startup updates →"; right side: "Subscribe" button (white outlined) + "✕" dismiss button; `v-if="visible && !dismissed"`
  - Transition: `v-transition` with a slide-up entrance (CSS `@keyframes` or Tailwind `translate-y`)

- Update `goed/src/views/MapView.vue`:
  - Import `SubscribeCTA` from `@/components/map/SubscribeCTA.vue`
  - Add `<SubscribeCTA />` at the bottom of the template (outside the map container so it overlays correctly)

- Update `goed/src/views/admin/SubscriberPanel.vue` (shell from Feature 0005):
  - `<script setup>`: import `ref`, `onMounted`; import `supabase` from `@/lib/supabase`
  - State: `totalConfirmed = ref(0)`, `filterBreakdown = ref([])`, `lastDigestRun = ref(null)`, `isLoading = ref(false)`, `error = ref(null)`
  - `fetchStats()` action:
    1. `select count(*) from map_subscriptions where confirmed = true` → `totalConfirmed`
    2. `select filter_criteria from map_subscriptions where confirmed = true` → client-side aggregate to compute per-sector and per-stage counts for `filterBreakdown` (count how many subscribers have each sector in their `filter_criteria.sectors` array)
    3. `select * from map_digest_runs order by run_at desc limit 1` → `lastDigestRun`
  - Call `fetchStats()` in `onMounted`
  - Template: stat cards showing `totalConfirmed`, a breakdown table with sector → subscriber count rows (top 5), and the `lastDigestRun.run_at` formatted as a relative time; `isLoading` spinner; `error` message on failure
  - Use the same card styling as `AdminDashboard.vue` for visual consistency (reference existing admin card classes)

**Success Criteria:**

- The map page (`/`) shows the `SubscribeCTA` sticky footer after ~3 seconds for a fresh visitor (no `subscribe_cta_dismissed` in localStorage)
- Clicking "✕" on the CTA dismisses it and prevents it from reappearing after a page reload
- Clicking "Subscribe →" navigates to `/subscribe`
- Navigating to `/admin/dashboard` → Subscribers panel shows the real confirmed subscriber count (not zero, assuming at least one test subscription was confirmed)
- The admin panel shows the `last digest run` timestamp from `map_digest_runs` (or "Never" if no runs yet)
- The per-filter breakdown table lists sectors and how many subscribers chose each

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0009_subscriptions.sql` | Create | `map_subscriptions` + `map_digest_runs` tables, RLS, indexes, pg_cron entry |
| `supabase/functions/send-digest/prompts.js` | Create | `SYSTEM_PROMPT`, `buildPersonalizedPrompt`, `buildEcosystemPrompt` |
| `supabase/functions/send-digest/index.js` | Create | Weekly digest orchestrator — queries subscribers, calls Gemini, sends via Resend, logs run |
| `supabase/functions/confirm-subscription/index.js` | Create | GET handler that sets `confirmed = true` from confirm token in URL |
| `supabase/functions/send-confirmation/index.js` | Create | Sends Resend double opt-in email with confirm link |
| `goed/src/views/SubscribeView.vue` | Create | Public subscription form with filter preferences + double opt-in flow |
| `goed/src/router/index.js` | Modify | Replace `/subscribe` PlaceholderView with real `SubscribeView` |
| `goed/src/components/map/SubscribeCTA.vue` | Create | Sticky dismissable footer CTA on the map |
| `goed/src/views/MapView.vue` | Modify | Mount `<SubscribeCTA />` |
| `goed/src/views/admin/SubscriberPanel.vue` | Modify | Replace shell zeros with live `map_subscriptions` + `map_digest_runs` queries |

---

## Testing Strategy

No automated test framework. Verification is end-to-end via Playwright MCP and manual inspection per the success criteria above.

### Manual Verification Checklist (end of feature)

- `map_subscriptions` table exists with correct schema; anon insert succeeds; anon select is blocked
- `map_digest_runs` table exists; service-role insert succeeds
- `send-digest` function returns `{ sent: 0, errors: 0 }` when invoked with no confirmed subscribers
- `/subscribe` route loads `SubscribeView.vue` (not PlaceholderView)
- Subscribing with a new email creates an unconfirmed row with a `confirm_token`
- Subscribing with a duplicate email shows the "already subscribed" message
- Navigating to the confirm URL sets `confirmed = true` on the subscription
- `/subscribe?confirmed=true` shows the success banner
- `/subscribe?unsubscribe=<id>` removes the subscription row
- Map page shows the sticky CTA after 3 seconds; dismiss persists across reloads
- Admin → SubscriberPanel shows non-zero counts after at least one confirmed subscription exists
- Admin panel shows "Never" or a real timestamp in the last digest run field

---

## Dependencies

### Prerequisites

- Feature 0001 (M1): `map_startups` table, router, Supabase client, brand styles — confirmed in place
- Feature 0004 (M5): `pg_cron` + `pg_net` extensions already enabled — confirmed in place
- Feature 0005 (M6): `SubscriberPanel.vue` shell exists — confirmed in place (shell shows zeros)

### External Dependencies

- **Resend API** — requires `RESEND_API_KEY` secret set on the Supabase project before deploying `send-digest` or `send-confirmation`
- **Google Gemini** — `GOOGLE_AI_API_KEY` already configured; `callLLM()` helper already exists
- A confirmed sender email domain in Resend (or use Resend's shared `onboarding@resend.dev` domain for testing)

### Blocking/Blocked By

- **Blocks:** Feature (M10) ecosystem highlights digest gains real `company_views` data once M10 ships; until then ecosystem fallback uses only `is_hiring` count + newest company
- **Blocked by:** Features 0001, 0004, 0005 must be complete (all are complete per git history)

---

## Open Questions

- Should the unsubscribe flow require the subscriber's ID (UUID, opaque) in the URL, or should it use the `confirm_token` (already generated, already in their email)? Decision: use `confirm_token` as the unsubscribe identifier too — it is already in the confirmation email and avoids exposing the UUID primary key in URLs.
- The `from` address (`digest@utah-startup-map.com`) requires a verified domain in Resend. For the hackathon demo, Resend's shared `onboarding@resend.dev` sender can be used as a fallback. Document this in `send-digest/index.js` as a comment.
