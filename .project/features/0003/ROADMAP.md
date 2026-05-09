# Feature 0003: AI Onboarding — Submission Pipeline

> Created: 2026-05-09
> Status: Draft
> Epic: 0001

## Overview

This feature delivers the headline innovation of the Utah Startup Map: a founder pastes any company URL, and a multi-stage AI enrichment pipeline produces a complete, geocoded, logo'd, investor-enriched company record that appears on the map in under 90 seconds — with zero manual steps.

The enrichment pipeline is API-first: structured sources (logo.dev, Nominatim, Utah DCC, Crunchbase, ATS endpoints) run in priority order before any AI call. Claude Haiku 4.5 (via OpenCode Zen) runs last and only fills fields that APIs could not provide. A quality gate then decides whether the record auto-publishes to `map_startups` or enters `map_startup_submissions` for GOED staff review.

The frontend delivers a single-field submission form at `/submit` with an animated progress display (scrape → enrich → geocode → publish) and a result screen showing either a live map deep-link ("You're on the map!") or a pending-review confirmation with a "claim your listing" CTA.

## Problem Statement

Milestone 1 and 2 gave Utah's existing 96 startups a rich interactive map experience, but the dataset is static — adding a new company still requires a developer to run the import script. The map's long-term value depends on keeping company data current and growing, which means GOED staff or founders themselves must be able to submit a company without developer involvement.

Without a self-service submission pipeline, every new company addition is a manual operation, the map loses freshness over time, and the demo cannot show the most compelling judge-facing story: "paste any Utah startup URL and watch it appear on the map."

## User Stories

- As a Utah founder, I want to paste my startup's URL into a form so that I can add my company to the map without contacting anyone at GOED.
- As a founder waiting for my submission to process, I want to see animated progress stages so that I know the system is working and understand what enrichment is happening.
- As a founder whose company auto-published, I want a deep link to my pin on the map so that I can share it immediately.
- As a founder whose company entered review, I want a clear CTA to claim my listing so that I can get notified when it goes live.
- As a GOED judge watching a demo, I want to see a URL pasted and a pin appear on the map in under 90 seconds so that the "live, AI-powered" story is viscerally real.

---

## Codebase Context

### Technology Stack

Already installed and in use:
- Vue 3.5, Pinia 3, Vue Router 5, Vite 8 (all installed, all routes registered)
- `@supabase/supabase-js` — client already configured at `goed/src/lib/supabase.js`
- Tailwind CSS with Utah brand tokens — already configured
- GSAP — already installed, in use in `CompanyDrawer.vue`
- Supabase Edge Functions (Deno JS runtime) — existing functions: `embed-resources`, `search-resources`, `generate-next-steps`

New for this feature:
- OpenCode Zen (Anthropic-compatible endpoint) — Claude Haiku 4.5 for gap-fill extraction
- External scraping targets: Crunchbase public pages, Utah DCC registry, ATS job boards (Greenhouse/Lever/Ashby)
- External APIs: logo.dev (already used at import time), Nominatim (already used at import time), NewsAPI (new)

### Relevant Directories

- `supabase/functions/_shared/` — shared Deno modules imported by multiple Edge Functions
- `supabase/functions/_shared/enrichers/` — per-source enricher modules (to be created)
- `supabase/functions/onboard-company/` — new Edge Function (to be created)
- `supabase/migrations/` — SQL migrations at repo root
- `goed/src/views/` — route-level Vue components
- `goed/src/components/submit/` — submission form components (to be created)
- `goed/src/composables/` — Vue composition functions

### Conventions to Follow

- All Startup Map tables **must** be prefixed `map_` — the migration updates `map_startup_submissions` (not `startup_submissions`)
- Edge Functions are JavaScript (`.js`), never TypeScript
- SFC block order: `<script setup>` → `<template>` → `<style scoped>`
- No logic in templates — all derived values in `computed()`
- Service functions in `goed/src/lib/` return `{ data, error }` shape
- JSDoc required on all exported functions in `goed/src/lib/` and `goed/src/composables/`
- Pinia stores expose `isLoading: ref(false)` and `error: ref(null)`
- All enrichers are best-effort: a failed source is silently skipped; the record is not penalized
- AI (Claude Haiku) fires **last**, only to fill fields APIs could not provide; never on the weekly cron

---

## Implementation Plan

### Phase 1: Submissions Schema & Shared Helpers

**Goal:** Extend the existing `map_startup_submissions` table with M3-specific columns and build the four shared helper modules (LLM client, logo.dev, Nominatim, Google Places) that all enrichers and the pipeline depend on.

**Note:** `map_startup_submissions` already exists from Feature 0001 Phase 2 with minimal columns (`startup_data jsonb`, `status`, `submitted_at`). This migration adds the M3-specific columns and tightens the status constraint to include `'auto_published'`.

**Tasks:**

- Create `supabase/migrations/0002_submissions.sql`:
  - `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS submitted_url text`
  - `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS submitted_by_email text`
  - `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS extracted_data jsonb` — enriched company record from the pipeline
  - `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS rejection_reason text`
  - `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`
  - `ALTER TABLE map_startup_submissions ADD COLUMN IF NOT EXISTS reviewed_by text` — reviewer email or 'auto' for quality-gate auto-decisions
  - Drop and recreate the status check constraint to include `'auto_published'`: `status IN ('pending', 'approved', 'rejected', 'auto_published')`
  - Add B-tree index on `map_startup_submissions(status)` for queue queries
  - RLS: anon can `INSERT` (via public form); anon cannot `SELECT`; authenticated admin can SELECT + UPDATE
- Create `supabase/functions/_shared/llm.js`:
  - Exports `callLLM({ model, systemPrompt, userPrompt, schema })` using OpenCode Zen Anthropic-compatible endpoint
  - Reads `OPENCODE_ZEN_API_KEY` and `OPENCODE_ZEN_BASE_URL` from Deno environment
  - Uses Claude Haiku 4.5 model ID (`claude-haiku-4-5`)
  - Returns parsed structured content; throws on HTTP error
  - JSDoc on all exports
- Create `supabase/functions/_shared/logo-dev.js`:
  - Exports `fetchLogo(url)` — normalizes input URL to bare domain (strips protocol, `www.`, trailing slash, path), constructs `https://img.logo.dev/{domain}?token={LOGO_DEV_TOKEN}&size=128`; reads token from Deno env; returns the logo URL string (does not make the HTTP request — resolution happens in the browser)
  - Exports `normalizeDomain(url)` separately for use by dedup checks
  - JSDoc on all exports
- Create `supabase/functions/_shared/nominatim.js`:
  - Exports `geocodeAddress(address)` — sends request to Nominatim with `User-Agent: goed-hackathon`; enforces 1 req/sec via `setTimeout`; retries once on 429 with 2s backoff; returns `{ lat: number, lng: number, display_name: string } | null`
  - Exports `extractCity(nominatimResult)` — returns the city/municipality from the Nominatim address object
  - JSDoc on all exports
- Create `supabase/functions/_shared/google-places.js`:
  - Exports `placesSearch(name, city)` — text search via Places API v2; reads `GOOGLE_PLACES_API_KEY` from Deno env; returns top result with `{ place_id, rating, phone, business_status, photos: string[] }` or null if key absent or no match
  - Returns `null` silently when `GOOGLE_PLACES_API_KEY` is not set (stretch enricher — not required for demo)
  - JSDoc on all exports

**Success Criteria:**

- `supabase db push` (or Supabase MCP `apply_migration`) applies `0002_submissions.sql` without error.
- `map_startup_submissions` has all M3 columns present: `submitted_url`, `submitted_by_email`, `extracted_data`, `rejection_reason`, `reviewed_at`, `reviewed_by`.
- Status column accepts `'auto_published'` in addition to `'pending'`, `'approved'`, `'rejected'`.
- Importing `_shared/llm.js` in a Deno context and calling `callLLM` with a test prompt returns a parsed response (requires `OPENCODE_ZEN_API_KEY` in Supabase secrets).
- `fetchLogo('https://www.zonos.com/pricing')` returns `https://img.logo.dev/zonos.com?token=...&size=128` with the correct domain extracted.
- `geocodeAddress('136 S Main St, Salt Lake City, UT')` returns `{ lat, lng }` with lat ~40.76 and lng ~-111.89.

---

### Phase 2: Core Enrichers & Pipeline Orchestrator

**Goal:** Build all five core enricher modules (Crunchbase, Utah DCC, ATS, plus the stretch enrichers GitHub/Wappalyzer/ProductHunt/News) and the `pipeline.js` orchestrator that runs them in priority order, fetches website HTML for Claude gap-fill, and merges all results into a normalized company record.

**Tasks:**

- Create `supabase/functions/_shared/ats.js`:
  - Exports `pollAts(careersUrl)` — detects ATS platform from the URL domain pattern; calls the appropriate public JSON endpoint: Greenhouse (`boards-api.greenhouse.io/v1/boards/{co}/jobs`), Lever (`api.lever.co/v0/postings/{co}`), Ashby (`jobs.ashbyhq.com/{co}` JSON); returns `{ job_titles: string[], is_hiring: boolean, careers_url: string }` or `null` if no ATS detected
  - Returns `null` silently if `careersUrl` is null/empty
  - JSDoc on all exports
  - **Note:** This module is shared with Feature 0005 (Recurring Data Refresh) — build it here and M5 imports it from `_shared/ats.js`
- Create `supabase/functions/_shared/enrichers/crunchbase.js`:
  - Exports `enrichFromCrunchbase(domain)` — constructs the Crunchbase public company URL from the domain, fetches the HTML page, scrapes `og:description` and structured funding data from the JSON-LD or inline `__NEXT_DATA__` blob; returns `{ investors: string[], total_raised: string, funding_rounds: object[] }` or `{}` if no Crunchbase page found or scrape fails
  - Silently returns `{}` on fetch error or parse failure — never throws
  - JSDoc on all exports
- Create `supabase/functions/_shared/enrichers/utah-dcc.js`:
  - Exports `enrichFromUtahDcc(name)` — queries the Utah Division of Corporations public registry search (`https://secure.utah.gov/bes/index.html`); parses the results table for an entity name match; returns `{ entity_type: string, status: string, registration_date: string, officers: string[] }` or `{}` if not found
  - Silently returns `{}` on network error or no match
  - JSDoc on all exports
- Create `supabase/functions/_shared/enrichers/github.js`:
  - Exports `enrichFromGithub(domain)` — uses GitHub Search API (`/search/repositories?q=org:name`) to find an org matching the domain; returns `{ repo_count: number, languages: string[], contributor_count: number }` or `{}` if not found
  - Returns `{}` silently when GitHub rate-limits or domain has no GitHub presence
  - JSDoc on all exports
- Create `supabase/functions/_shared/enrichers/wappalyzer.js`:
  - Exports `enrichFromWappalyzer(url)` — calls Wappalyzer Lookup API with `WAPPALYZER_API_KEY`; returns `{ tech_stack: string[] }` or `{}` if key absent or lookup fails
  - Returns `{}` silently when `WAPPALYZER_API_KEY` is not set (roadmap enricher — key not required for demo)
  - JSDoc on all exports
- Create `supabase/functions/_shared/enrichers/producthunt.js`:
  - Exports `enrichFromProductHunt(name)` — searches ProductHunt API or public pages for a matching product; returns `{ launch_date: string, upvotes: number }` or `{}` if not found
  - Returns `{}` silently on failure (roadmap enricher)
  - JSDoc on all exports
- Create `supabase/functions/_shared/enrichers/news.js`:
  - Exports `enrichFromNews(name)` — calls NewsAPI (`newsapi.org/v2/everything`) with `NEWS_API_KEY`; returns `{ headlines: string[] }` (up to 3 recent) or `{}` if key absent or no results
  - Returns `{}` silently when `NEWS_API_KEY` is not set (roadmap enricher)
  - JSDoc on all exports
- Create `supabase/functions/_shared/pipeline.js`:
  - Exports `runEnrichmentPipeline(input)` where `input = { url: string, email?: string }`
  - Runs enrichers in this priority order:
    1. Fetch company website HTML via Deno `fetch(url)` (for Claude gap-fill later)
    2. `logo-dev.js` — resolve logo URL from domain
    3. `nominatim.js` — geocode address extracted from Claude gap-fill (or use city if already known)
    4. `enrichers/utah-dcc.js` — DCC registration lookup
    5. `enrichers/crunchbase.js` — investor data + funding
    6. `_shared/ats.js` — job postings via ATS detection on `careers_url`
    7. Stretch: `enrichers/github.js`, `enrichers/wappalyzer.js`, `enrichers/producthunt.js`, `enrichers/news.js`
    8. `llm.js` — Claude Haiku gap-fill: sends website HTML + partial record; fills missing `name`, `description`, `sector`, `stage`, `founded_year`, `address` only for fields that are still null/empty
  - Returns a normalized company object matching `map_startups` column shape: `{ name, description, website, address, city, lat, lng, region, sector, stage, employee_range, founded_year, is_hiring, job_titles, careers_url, logo_url, investors, total_raised, dcc_status, dcc_entity_type }`
  - All enrichers run with `Promise.allSettled` where order allows parallelism; structured sources complete before the Claude gap-fill call
  - Each failed enricher step is logged to `console.error` but does not abort the pipeline

**Success Criteria:**

- `runEnrichmentPipeline({ url: 'https://zonos.com' })` invoked from a Deno test context returns a record with non-null `name`, `logo_url`, `lat`, `lng`, `sector`, `description`.
- Crunchbase enricher returns a non-empty `investors` array for a company with a Crunchbase profile (e.g., Zonos or a similar well-known Utah company); returns `{}` for a URL with no Crunchbase match without throwing.
- Utah DCC enricher returns `{ entity_type, status, registration_date }` for a registered Utah LLC; returns `{}` for an unknown name without throwing.
- ATS enricher returns `{ job_titles, is_hiring: true }` for a company using Greenhouse/Lever/Ashby; returns `null` for a domain with no detected ATS.
- All stretch enrichers (GitHub, Wappalyzer, ProductHunt, News) return `{}` silently when their API key env var is absent — no uncaught errors.
- Claude Haiku gap-fill is called only for fields that are still null after all API enrichers have run; fields already populated by APIs are not overwritten.

---

### Phase 3: onboard-company Edge Function

**Goal:** Build the complete `onboard-company` Edge Function that receives a URL + email submission, runs the enrichment pipeline, validates the result through the Utah quality gate, and writes the record to either `map_startups` (auto-publish) or `map_startup_submissions` (pending review).

**Tasks:**

- Create `supabase/functions/onboard-company/utah-bounds.js`:
  - Exports `isInsideUtah({ lat, lng })` — returns `true` if coordinates fall inside Utah bounding box: lat 37.0–42.0, lng -114.05 to -109.05
  - Exports `verifyUtahState(nominatimResult)` — returns `true` if the Nominatim result's state field is "Utah" or "UT"
  - JSDoc on all exports
- Create `supabase/functions/onboard-company/quality-gate.js`:
  - Exports `runQualityGate(record, supabaseClient)` — async function that checks:
    1. Required fields present: `name`, `address`, `sector`, `description` (all non-null, non-empty)
    2. lat/lng inside Utah bounding box via `utah-bounds.js`
    3. No duplicate: query `map_startups` for matching `website` domain or `name` (case-insensitive); also check `map_startup_submissions` for pending/auto_published rows with same domain
    4. Utah DCC record active (if `dcc_status` is present and record was found, status must be `'Active'`; if DCC returned `{}`, gate still passes)
  - Returns `{ passed: boolean, reason: string | null }` — `reason` is null on pass, human-readable on fail
  - JSDoc on all exports
- Create `supabase/functions/onboard-company/prompts.js`:
  - Exports `SYSTEM_PROMPT` — Claude system prompt instructing gap-fill extraction: extract name, description, sector, stage, founded_year, address from website HTML; return JSON only; do not hallucinate fields not present in the HTML
  - Exports `buildUserPrompt(html, partialRecord)` — constructs the user-turn prompt with HTML content (truncated to 8000 chars) and a list of which fields are still missing
  - Exports `OUTPUT_SCHEMA` — expected JSON output shape for Claude's response validation
  - JSDoc on all exports
- Create `supabase/functions/onboard-company/index.js`:
  - HTTP handler (Deno `serve`) that accepts POST `{ url: string, email?: string }`
  - Validates input: `url` must be present and parseable as a URL; returns 400 on invalid input
  - Calls `runEnrichmentPipeline({ url, email })`
  - Calls `runQualityGate(record, supabaseClient)`
  - On quality gate **pass**: upsert into `map_startups` (insert or update by domain), set `verified = false` initially (GOED review can mark it true), insert into `map_startup_submissions` with `status = 'auto_published'`, return `{ status: 'auto_published', startup_id, company: record }`
  - On quality gate **fail**: insert into `map_startup_submissions` with `status = 'pending'`, `submitted_url`, `submitted_by_email`, `extracted_data`, `rejection_reason` populated, return `{ status: 'pending', reason }`
  - Returns `{ error, code }` on unexpected failure per Edge Function error convention
  - CORS headers for browser invocation from `goed/`

**Success Criteria:**

- `supabase functions invoke onboard-company --body '{"url":"https://zonos.com","email":"demo@test.com"}'` returns a JSON response with `status` of `'auto_published'` or `'pending'`.
- A company that passes the quality gate (name + address + sector + description present, Utah lat/lng) appears in `map_startups` as a new row with `verified = false`.
- A company that fails the quality gate (missing required fields or non-Utah coordinates) appears in `map_startup_submissions` with `status = 'pending'` and a non-null `rejection_reason`.
- Submitting the same URL twice does not create a duplicate `map_startups` row; the second call returns the existing `startup_id`.
- A non-Utah company URL (e.g., a San Francisco company) fails the quality gate with a Utah-bounds reason and goes to pending review.
- The Edge Function returns a proper `{ error, code }` JSON response (not an unhandled exception) when called with a malformed URL.

---

### Phase 4: Frontend Submission UI

**Goal:** Build the `/submit` page with a single-URL form, an animated pipeline progress display, and a result screen. Wire the form to the `onboard-company` Edge Function via `useOnboarding` composable. Update the router to serve `SubmitView` instead of `PlaceholderView` at `/submit`.

**Tasks:**

- Create `goed/src/composables/useOnboarding.js`:
  - Exports `useOnboarding()` returning `{ status, result, error, isLoading, submit }` reactive state
  - `submit({ url, email })` — calls `supabase.functions.invoke('onboard-company', { body: { url, email } })`, sets `isLoading` true during call, sets `status` to the response `status` field, sets `result` to the full response, sets `error` on failure
  - `status` transitions: `null` → `'running'` → `'auto_published' | 'pending' | 'error'`
  - JSDoc on all exports
- Create `goed/src/components/submit/SubmitForm.vue`:
  - `<script setup>` with `defineProps` and `defineEmits(['submit'])`
  - Single URL `<input>` (type `url`, required, placeholder "https://yourstartup.com") + optional email input + submit button
  - Emits `submit` event with `{ url, email }` on valid form submission
  - Shows loading spinner inside button while `isLoading` is true; disables form during submission
  - Validates URL format client-side before emitting; shows inline error for invalid URL
  - Uses Tailwind + Utah brand tokens; SFC block order observed; no logic in template
- Create `goed/src/components/submit/SubmitProgress.vue`:
  - Accepts `props.stage` — one of `'idle' | 'scrape' | 'crunchbase' | 'dcc' | 'ats' | 'logo' | 'geocode' | 'publish'`
  - Renders 7 pipeline stages as a vertical step list; active stage is highlighted, completed stages show a check, upcoming stages are dimmed
  - Each stage has a human-readable label: "Reading your website…", "Checking Crunchbase investors…", "Verifying Utah registration…", "Scanning job postings…", "Fetching logo…", "Geocoding address…", "Publishing to map…"
  - GSAP `gsap.to()` animates a progress bar filling across the current stage; entrance animation staggers the step items on mount
  - `computed` drives all stage visibility and class logic — no logic in template
- Create `goed/src/components/submit/SubmitResult.vue`:
  - Accepts `props.result` (`{ status: 'auto_published' | 'pending', startup_id?, company? }`) and `props.error`
  - `auto_published`: shows "You're on the map!" heading with GSAP entrance; deep link to map with drawer auto-open (`/?startup=${startup_id}`); "View on map" button in Utah blue; share URL copy button
  - `pending`: shows "Your submission is under review" heading; explains GOED will review within 48 hours; "Claim your listing" CTA (links to `/admin` claim flow, to be built in Feature 0004)
  - `error`: shows friendly error message with a "Try again" button
  - All conditional logic in `computed` properties; no ternaries in template
- Create `goed/src/views/SubmitView.vue`:
  - Page shell that composes `SubmitForm`, `SubmitProgress`, `SubmitResult` based on `useOnboarding` state
  - Uses `useOnboarding()` composable — calls `submit()` on form's `submit` emit
  - Shows `SubmitForm` when `status === null`; shows `SubmitProgress` while `status === 'running'`; shows `SubmitResult` when `status` is terminal
  - Page-level GSAP entrance animation on mount (fade + slide up the form card)
  - Utah-branded layout: centered card on a light gray background, Utah blue header with site nav
  - Note: `SubmitProgress.stage` is simulated client-side on a timed sequence (since the Edge Function runs synchronously and does not stream stage updates); advances through stages over ~60s while awaiting the Edge Function response
- Update `goed/src/router/index.js`:
  - Change `/submit` route from `PlaceholderView` to `() => import('@/views/SubmitView.vue')`
  - Keep route name `'Submit'`

**Success Criteria:**

- Navigating to `/submit` renders a clean submission form (URL input + email input + submit button) with Utah brand styling.
- Entering a valid Utah startup URL and pressing submit transitions to the `SubmitProgress` component showing animated pipeline stages advancing in sequence.
- After the Edge Function responds (~10–90s), `SubmitResult` renders the correct outcome: auto-published shows "You're on the map!" with a working deep-link to the map pin; pending shows the review message with CTA.
- The deep link `/?startup={startup_id}` navigates to the map and automatically opens the company drawer for the newly submitted company.
- A newly auto-published company appears on the map (`/`) as a new pin with its logo, name, sector, description, investor names, and `total_raised` visible in the drawer.
- End-to-end time from URL paste to pin visible on the map is under 90 seconds for a typical Utah startup with a Crunchbase profile.
- Submitting a non-URL string shows a client-side validation error without calling the Edge Function.
- Submitting a URL for a non-Utah company shows `SubmitResult` in `pending` state with the quality-gate rejection reason.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0002_submissions.sql` | Create | Extend `map_startup_submissions` with M3 columns; tighten status constraint |
| `supabase/functions/_shared/llm.js` | Create | Shared LLM client (OpenCode Zen / Claude Haiku gap-fill) |
| `supabase/functions/_shared/logo-dev.js` | Create | logo.dev URL builder + domain normalizer |
| `supabase/functions/_shared/nominatim.js` | Create | Geocoding helper with retry + rate-limit backoff |
| `supabase/functions/_shared/google-places.js` | Create | Google Places API client (stretch enricher) |
| `supabase/functions/_shared/ats.js` | Create | ATS job poller (Greenhouse/Lever/Ashby); shared with Feature 0005 |
| `supabase/functions/_shared/enrichers/crunchbase.js` | Create | Crunchbase HTML scraper → investors + total_raised |
| `supabase/functions/_shared/enrichers/utah-dcc.js` | Create | Utah DCC registry lookup → status, entity type, officers |
| `supabase/functions/_shared/enrichers/github.js` | Create | GitHub org lookup → repo count, languages (stretch) |
| `supabase/functions/_shared/enrichers/wappalyzer.js` | Create | Wappalyzer API → tech stack tags (roadmap) |
| `supabase/functions/_shared/enrichers/producthunt.js` | Create | ProductHunt search → launch date, upvotes (roadmap) |
| `supabase/functions/_shared/enrichers/news.js` | Create | NewsAPI headlines (roadmap) |
| `supabase/functions/_shared/pipeline.js` | Create | `runEnrichmentPipeline(input)` — orchestrates all enrichers in order |
| `supabase/functions/onboard-company/utah-bounds.js` | Create | Utah bounding-box check + Nominatim state verification |
| `supabase/functions/onboard-company/quality-gate.js` | Create | Quality gate: required fields + Utah bounds + dedup + DCC status |
| `supabase/functions/onboard-company/prompts.js` | Create | Claude system prompt + user prompt builder + output schema |
| `supabase/functions/onboard-company/index.js` | Create | Edge Function HTTP handler: pipeline → quality gate → DB write |
| `goed/src/composables/useOnboarding.js` | Create | Reactive composable: invokes Edge Function, manages status/result/error |
| `goed/src/components/submit/SubmitForm.vue` | Create | URL + email form with loading state |
| `goed/src/components/submit/SubmitProgress.vue` | Create | Animated 7-stage pipeline progress display |
| `goed/src/components/submit/SubmitResult.vue` | Create | Auto-published / pending-review / error result screens |
| `goed/src/views/SubmitView.vue` | Create | Page shell composing the three submit components |
| `goed/src/router/index.js` | Modify | Wire `/submit` route to `SubmitView` instead of `PlaceholderView` |

---

## Testing Strategy

No automated test framework is in scope during the hackathon. Verification is manual and observable per the success criteria above.

### Manual Verification Checklist (end of feature)

- Migration applied: `map_startup_submissions` has all M3 columns; `'auto_published'` accepted as status value.
- Edge Function invocation via CLI: `supabase functions invoke onboard-company --body '{"url":"https://zonos.com","email":"demo@test.com"}'` returns valid JSON with `status` field.
- Auto-publish path: a qualifying Utah company URL → row appears in `map_startups`; visible as a new pin on the map at `/`.
- Pending path: a non-Utah or incomplete company URL → row appears in `map_startup_submissions` with `status = 'pending'` and non-null `rejection_reason`.
- Dedup: same URL submitted twice → only one `map_startups` row.
- `/submit` page loads cleanly with URL input form.
- Form submission → animated progress stages advance → result screen renders correct outcome.
- Deep link in success result opens map with drawer auto-opened on the new company.
- Under-90s end-to-end time for a company with Crunchbase presence.

---

## Dependencies

### Prerequisites

- Feature 0001 complete: `map_startups` and `map_startup_submissions` tables exist; Supabase client wired; seed data loaded.
- Feature 0002 complete: `/` map route renders pins; `CompanyDrawer.vue` shows company details (needed to verify the deep-link success path).
- Supabase project has Edge Function secrets configured: `OPENCODE_ZEN_API_KEY`, `OPENCODE_ZEN_BASE_URL`, `LOGO_DEV_TOKEN`.

### External Dependencies

- OpenCode Zen (Anthropic-compatible endpoint) — `OPENCODE_ZEN_API_KEY` + `OPENCODE_ZEN_BASE_URL` in Supabase secrets
- logo.dev — `LOGO_DEV_TOKEN` in Supabase secrets (already present from import script)
- Nominatim — public endpoint, no key required
- Crunchbase — public HTML scraping, no API key
- Utah DCC — public HTML scraping, no API key
- ATS APIs (Greenhouse/Lever/Ashby) — public endpoints, no key required
- Google Places — `GOOGLE_PLACES_API_KEY` in Supabase secrets (stretch; not required for core demo)
- NewsAPI — `NEWS_API_KEY` in Supabase secrets (roadmap; not required for demo)

### Blocking/Blocked By

- **Blocks:** Feature 0004 (Claim & Self-Service Edit) — needs the `map_startup_submissions` table and the "claim your listing" CTA from `SubmitResult.vue`.
- **Blocks:** Feature 0005 (Recurring Data Refresh) — the `_shared/ats.js` module built here is reused by `refresh-jobs`.
- **Blocked by:** Feature 0001 (schema, store, seed data) and Feature 0002 (map rendering, drawer — needed to verify the end-to-end success path).

---

## Open Questions

- **OpenCode Zen model ID:** Assumed `claude-haiku-4-5`. Verify the exact model string accepted by the OpenCode Zen endpoint before implementing `_shared/llm.js`.
- **Crunchbase scraping reliability:** Crunchbase's public pages use heavy client-side rendering. If `__NEXT_DATA__` parsing is not reliable, fall back to parsing `og:description` for company summary only and return `{}` for funding data.
- **Dedup key:** Dedup is normalized domain (strip `www.`, protocol, trailing slash). If two submissions have the same company name but different domains (e.g., rebrand), the domain-based dedup passes and creates a second row. Acceptable for hackathon; flag for M4 claim flow to handle merges.
- **Quality gate threshold:** The gate currently requires name + address + sector + description. If Claude Haiku fills all four from HTML, nearly every company auto-publishes. Consider tightening to require Utah DCC match OR Crunchbase presence for auto-publish — but this risks rejecting real small companies. Decision deferred to demo rehearsal.
- **SubmitProgress stage timing:** The Edge Function is synchronous; stage advancement is simulated client-side on a timer. If the function returns faster than the animation, `SubmitResult` should appear immediately without waiting for the animation to complete.
