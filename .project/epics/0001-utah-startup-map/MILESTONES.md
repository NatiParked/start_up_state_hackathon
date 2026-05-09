# Milestones — Epic 0001: Utah Startup Map

## Overview

Eight milestones, each ending in a workable application state. No milestone leaves the app broken for the next. The original milestones have been split at natural seams so that each phase of the `/spec:new-feature` workflow is digestible and independently shippable.

Complexity scale: S (hours), M (1 day), L (2-3 days), XL (4+ days).

### Database Scope

This epic shares a Supabase project with other services. **Only interact with tables owned by this epic:** `map_startups` and `map_startup_submissions`. Ignore all other tables (`resources`, `businesses`, `feedback`, `concierge_questions`, `founder_profiles`, etc.) — they belong to other services and must not be modified, queried for verification, or considered in schema checks. When verifying database criteria, confirm only that our tables exist and have the correct shape.

### Priority Tiers

Work is sequenced across three tiers. Complete each tier before starting the next. Do not skip ahead.

**Tier 1 — Must Ship (demo day core):** M1 → M2 → M3 → M5 → M6
**Tier 2 — If time remains (in this order):** M9 → M10 → M4

| # | Milestone | Complexity | Tier | Workable State After |
|---|-----------|-----------|------|----------------------|
| 1 | Map Foundation: Infrastructure & Data Import | M | **T1** | App boots, 96 companies in DB, map renders pins |
| 2 | Map Core: Filters, Drawer & Interactivity | M | **T1** | Full interactive map — filterable, clickable, investor-aware |
| 3 | AI Onboarding: Submission Pipeline | L | **T1** | URL paste → enriched company on map in <90s |
| 5 | Recurring Data Refresh | S | **T1** | Jobs refresh weekly via ATS APIs (no AI); investor/profile event-driven |
| 6 | Admin Management UI | M | **T1** | GOED staff can approve, edit, refresh, monitor |
| 9 | Engagement: Subscriptions & AI Digest | M | **T2** | Subscribers receive weekly Claude-written email |
| 10 | Engagement: Analytics & Share Cards | M | **T2** | Founders see view stats; shareable OG cards live |
| 4 | AI Onboarding: Claim & Self-Service Edit | M | **T2** | Founders can claim and manage their listing |

### M3 Enricher Scoping

API-first pipeline: structured sources run in order before any AI call. Claude Haiku (OpenCode Zen) is last and only fills what APIs couldn't provide. Stretch enrichers added after Tier 1 and Tier 2 complete.

| Enricher | Status | Reason |
|---|---|---|
| logo.dev | **Core** | Pure visual win; API call, free |
| Nominatim | **Core** | Geocoding; API call, free |
| Utah DCC | **Core** | Quality gate + verification story; free |
| Crunchbase | **Core** | Investor names + total raised; scrape, free |
| ATS endpoints (Greenhouse/Lever/Ashby) | **Core** | Job postings; structured JSON APIs, free — reused by weekly cron |
| Claude Haiku via OpenCode Zen | **Core** | Gap-fill only: description, sector, stage from website HTML; fires last |
| Google Places | Stretch | Photos + rating; moderate API complexity |
| GitHub | Stretch | Tech signal; easy lookup; good for SaaS |
| Silicon Slopes / YC badge | Stretch | Ecosystem credibility; simple lookup |
| Wappalyzer | Roadmap | Tech stack tags; API key complexity |
| ProductHunt | Roadmap | Launch signal; secondary |
| News API | Roadmap | Press mentions; secondary |
| Proxycurl / LinkedIn | Roadmap | Paid per-request |
| PitchBook | Roadmap | Institutional access only — skip entirely |

---

## Milestone 1: Map Foundation — Infrastructure & Data Import
**Complexity: M**
**Tier: 1**
**Linked Feature: 0001**

The skeleton everything else attaches to. App boots, Supabase is connected, all 96 seed companies are in the database, and logo pins render on the map. No interaction yet — just the foundation.

**Description:**
Bootstrap the Vue 3.5 + Vite app, install all dependencies, configure Tailwind + router, provision Supabase, run the one-time geocoded import of 96 companies, and render them as logo-pin markers on a basic OpenLayers map. The filter sidebar and company drawer are placeholders at this stage.

**Key Deliverables:**
- [ ] `goed/package.json` — add deps: vue3-openlayers, ol, @supabase/supabase-js, gsap; add devDeps: tailwindcss, postcss, autoprefixer
- [ ] `goed/vite.config.js`, `goed/tailwind.config.js` (Utah blue + semantic color tokens), `goed/jsconfig.json` configured
- [ ] `goed/src/main.js` — app bootstrap with Pinia + Router + vue3-openlayers plugin
- [ ] `goed/src/router/index.js` — all routes registered: `/` (MapView), `/submit`, `/admin`, `/navigator`, `/roadmap`, `/subscribe` — last five use PlaceholderView.vue until their milestones land; route names PascalCase
- [ ] `goed/src/lib/supabase.js` — Supabase client singleton
- [ ] `supabase/migrations/0001_init.sql` — `startups` table: name, description, website, linkedin, address, lat, lng, region, sector, stage, employee_range, founded_year, is_hiring, job_titles text[], careers_url, logo_url, google_place_id, google_rating, phone, verified, last_refreshed_at, created_at, updated_at, `investors text[]` (filterable array of investor/fund names e.g. `{"Kickstart Fund","Album VC"}`), `total_raised text` (human-readable e.g. `"$4.2M"`); B-tree indexes on sector, stage, region; GIN index on investors for array containment queries
- [ ] `goed/scripts/import-seed-companies.js` — one-time import from Google Sheet CSV + Nominatim geocoding; derives region from lat/lng bounding boxes; run with `node scripts/import-seed-companies.js` from inside `goed/`
- [ ] `goed/src/stores/startups.js` — Pinia setup store: companies, isLoading, error, filteredCompanies getter, fetchAll() action
- [ ] `goed/src/stores/filters.js` — Pinia setup store: 9 filter types (sector, stage, employee range, hiring, founded year, funding stage, business type, location, investor), clearAll() action, URL query sync structure defined (repeated keys: `?sectors=AI&sectors=SaaS&investors=Kickstart+Fund`) — filter UI components come in M2
- [ ] `goed/src/views/MapView.vue` — page shell with `<UtahMap />` mounted; filter sidebar and drawer slots are empty divs at this stage
- [ ] `goed/src/views/PlaceholderView.vue` — single reusable "Coming soon" view with title prop
- [ ] `goed/src/components/map/UtahMap.vue` — OpenLayers map centered on Utah bounding box, OSM tile layer, fit-to-state on first load, all companies rendered as `<CompanyPin />`
- [ ] `goed/src/components/map/CompanyPin.vue` — logo-pin marker from `logo_url`, monogram fallback
- [ ] `goed/src/components/map/PinCluster.vue` — clustering layer with logo-preview on hover
- [ ] `goed/src/composables/useLogoDev.js` — domain → logo URL with in-memory cache
- [ ] `goed/src/styles/brand.css` — Tailwind @tailwind directives (no CSS vars — colors in tailwind.config.js)
- [ ] `netlify.toml` at repo root — SPA fallback + build config
- [ ] All 96 seed companies visible on map as logo pins; app routes work; Supabase connected

**Dependencies:** None — this is the foundation.

---

## Milestone 2: Map Core — Filters, Drawer & Interactivity
**Complexity: M**
**Tier: 1**
**Linked Feature: 0002**

Turns the pin map into a fully interactive product. This milestone alone is a complete, demo-able experience.

**Description:**
Wire up the filter sidebar (all 9 filters including investor), the GSAP-animated company drawer with investor section, and the ecosystem stats bar. End state: load the URL, see Utah, click a logo, read the company including investor data, filter to "hiring B2B SaaS backed by Kickstart Fund in SLC." Brand-aligned, premium feel.

**Key Deliverables:**
- [ ] `goed/src/components/filters/FilterSidebar.vue` — collapsible sidebar shell composing all filter components
- [ ] `goed/src/components/filters/SectorFilter.vue` — multi-select checkboxes
- [ ] `goed/src/components/filters/StageFilter.vue` — multi-select checkboxes
- [ ] `goed/src/components/filters/EmployeeRangeFilter.vue` — multi-select checkboxes
- [ ] `goed/src/components/filters/HiringFilter.vue` — boolean toggle
- [ ] `goed/src/components/filters/FoundedYearFilter.vue` — range with computed min/max from data
- [ ] `goed/src/components/filters/FundingStageFilter.vue` — multi-select checkboxes
- [ ] `goed/src/components/filters/BusinessTypeFilter.vue` — multi-select checkboxes
- [ ] `goed/src/components/filters/LocationFilter.vue` — region multi-select
- [ ] `goed/src/components/filters/InvestorFilter.vue` — text input with autocomplete from distinct values in `startups.investors`; filters using Postgres `@>` array containment via the Pinia filteredCompanies getter
- [ ] `goed/src/components/map/EcosystemStatsBar.vue` — reactive metrics: total companies, sector count, hiring count, avg founded year; updates as filters change
- [ ] `goed/src/components/drawer/CompanyDrawer.vue` — right-slide GSAP drawer: logo, name, sector/stage pills, employee range, description, website + LinkedIn links, hiring badge, job titles with "+X more"; includes **"Investors" section** with investor name pills + total raised badge, conditionally rendered when `investors` array is non-empty
- [ ] `goed/src/views/MapView.vue` update — wire FilterSidebar, CompanyDrawer, EcosystemStatsBar into the page shell; connect ol-interaction-select to drawer open/close
- [ ] URL query sync live — filter state round-trips through `?sectors=&investors=` query params
- [ ] All 96 companies filterable by all 9 dimensions; drawer opens on pin click with investor data visible; stats bar reflects active filters

**Dependencies:** M1 (app, Supabase, `startups` table, UtahMap, stores).

---

## Milestone 3: AI Onboarding — Submission Pipeline
**Complexity: L**
**Tier: 1**
**Linked Feature: 0003**
**Linked Feature: 0003**

The headline innovation. A founder pastes a URL; the AI pipeline produces a complete, geocoded, logo'd, investor-enriched company record that appears on the map in under 90 seconds.

**Description:**
Build the public submission form and the Edge Function enrichment pipeline using the four core enrichers: Claude scrapes the site, Crunchbase provides investor data, Utah DCC validates registration, and logo.dev resolves the logo. The quality gate decides auto-publish vs. review queue. This is the demoable "wow" — zero manual steps from URL to pin. Stretch enrichers (Google Places, GitHub, Silicon Slopes/YC) are added only after Tier 1 and Tier 2 milestones are complete.

**Enrichment philosophy:** API-first. Structured sources run in priority order before any AI call. Claude Haiku 4.5 (via OpenCode Zen) only runs at the end to fill gaps that APIs could not cover — primarily extracting description, sector, and stage from website HTML fetched by the Edge Function. AI calls fire on new submissions and claim events only, never on the weekly cron.

**Enrichment Data Sources (run in this order):**

| # | Source | Status | Cost | Key Data | Method |
|---|--------|--------|------|----------|--------|
| 1 | **logo.dev** | **Core** | Free tier | Company logo by domain | API |
| 2 | **Nominatim** | **Core** | Free | lat/lng, city from address | API |
| 3 | **Utah Div. of Corporations** | **Core** | Free | Reg. date, entity type, active status, officers | Scrape/API |
| 4 | **Crunchbase** | **Core** | Free | Total raised, round history, investor names → `investors text[]` | Scrape |
| 5 | **ATS endpoints** | **Core** | Free | Current job postings from Greenhouse/Lever/Ashby | JSON API |
| 6 | **Claude Haiku (gap-fill)** | **Core** | OpenCode Zen | Description, sector, stage, founding year — only what APIs missed | AI (last resort) |
| 7 | **Google Places** | Stretch | Free tier | Photos, rating, phone, business status | API |
| 8 | **GitHub** | Stretch | Free | Repo count, languages, recent merged PRs, contributor count | API |
| 9 | **Silicon Slopes / YC alumni** | Stretch | Free | Ecosystem credibility badge | Scrape |
| 10 | **Wappalyzer** | Roadmap | Free tier | Tech stack tag pills | API |
| 11 | **ProductHunt** | Roadmap | Free | Launch date, upvote count | Scrape |
| 12 | **News API** | Roadmap | Free tier | Up to 3 recent press mentions | API |
| — | **LinkedIn via Proxycurl** | Roadmap | ~$0.02/req | Employee growth — paid per request | API |
| — | **PitchBook** | Roadmap | $20k+/yr | Skip — institutional access only | — |

All enrichers are best-effort: if a source returns no confident match, it is silently skipped; the record is not penalized in the quality gate. The `_shared/pipeline.js` module is structured so stretch enrichers can be added as drop-in modules without touching the orchestrator.

**Key Deliverables:**
- [ ] `supabase/migrations/0002_submissions.sql` — `startup_submissions` table (id, submitted_url, submitted_by_email, status 'pending'|'approved'|'rejected'|'auto_published', extracted_data jsonb, rejection_reason, created_at, reviewed_at, reviewed_by)
- [ ] `supabase/functions/_shared/llm.js` — shared LLM client for OpenCode Zen (Anthropic-compatible endpoint); Edge Function fetches website HTML via Deno `fetch`, then passes content to Claude Haiku for gap-fill extraction; no native `web_fetch` tool needed
- [ ] `supabase/functions/_shared/logo-dev.js` — logo.dev fetcher with domain normalization
- [ ] `supabase/functions/_shared/nominatim.js` — geocoding helper with retry + rate-limit backoff
- [ ] `supabase/functions/_shared/google-places.js` — Places API client; requires `GOOGLE_PLACES_API_KEY` env var
- [ ] `supabase/functions/_shared/enrichers/crunchbase.js` — scrapes public Crunchbase company page; extracts funding rounds, total raised, investor names (→ `startups.investors text[]`), total funding (→ `startups.total_raised`)
- [ ] `supabase/functions/_shared/enrichers/utah-dcc.js` — queries Utah Division of Corporations registry; returns entity type, status, registration date, registered officers
- [ ] `supabase/functions/_shared/enrichers/places.js` — Google Places text search → place details (photos[], rating, phone, business_status)
- [ ] `supabase/functions/_shared/enrichers/github.js` — searches GitHub for org matching domain; fetches repo count, languages, recent merged PRs, contributor count
- [ ] `supabase/functions/_shared/enrichers/wappalyzer.js` — Wappalyzer API lookup by URL; returns tech stack tags
- [ ] `supabase/functions/_shared/enrichers/producthunt.js` — searches ProductHunt by company name; returns launch date, upvotes if found
- [ ] `supabase/functions/_shared/enrichers/news.js` — NewsAPI query for company name; returns up to 3 recent headlines
- [ ] `supabase/functions/_shared/pipeline.js` — exported `runEnrichmentPipeline(input)` that orchestrates all enrichers in priority order and returns a normalized company record (including `investors text[]` and `total_raised`); used by both `onboard-company` and `refresh-jobs`
- [ ] `supabase/functions/onboard-company/prompts.js` — Claude system prompt + structured output schema for profile extraction
- [ ] `supabase/functions/onboard-company/quality-gate.js` — passes if (name + address + sector + description present) AND (lat/lng inside Utah bounding box) AND (no duplicate by normalized domain or name) AND (Utah DCC record active, if found)
- [ ] `supabase/functions/onboard-company/utah-bounds.js` — Utah bounding-box check (approx 37.0–42.0 lat, -114.05 to -109.05 lng) + state-name verification
- [ ] `supabase/functions/onboard-company/index.js` — orchestrates full enrichment pipeline; runs quality gate; auto-publishes to `startups` or inserts into `startup_submissions` with status 'pending'
- [ ] `goed/src/views/SubmitView.vue` — public submission form (single URL input + email)
- [ ] `goed/src/components/submit/SubmitForm.vue` — form with optimistic loading ("Claude is reading your site...")
- [ ] `goed/src/components/submit/SubmitProgress.vue` — animated pipeline stages (scrape → Crunchbase → Utah DCC → Places → GitHub → logo → geocode → publish)
- [ ] `goed/src/components/submit/SubmitResult.vue` — success ("You're on the map!") with pin deep link, OR pending-review with "claim your listing" CTA
- [ ] `goed/src/composables/useOnboarding.js` — invokes Edge Function, polls status, handles errors
- [ ] End-to-end demo: paste URL → enriched company on map with logo + investor names + total raised + tech stack in under 90s

**Dependencies:** M1 + M2 (needs `startups` table with investor columns and the drawer to show the result).

---

## Milestone 4: AI Onboarding — Claim & Self-Service Edit
**Complexity: M**
**Tier: 3** — Build after M9 and M10. Demo-critical for founders but judges prioritize the AI pipeline and Navigator over the claim flow.
**Linked Feature: 0006**

Gives founders ownership of their listing. Domain-verified magic link → self-service edit UI → profile always current without GOED involvement.

**Description:**
Build the claim flow (magic link to `admin@<domain>`, cross-referenced against Utah DCC officer list) and the self-service edit UI where verified founders update their full profile, curate a photo gallery, and see their view analytics (the analytics component is stubbed here; data populates in M10).

**Key Deliverables:**
- [ ] `supabase/migrations/0003_claims.sql` — `company_claims` table (startup_id, claimer_email, claim_token, verified_at, expires_at)
- [ ] `supabase/functions/claim-company/index.js` — issues magic link to `admin@<domain>`; cross-references Utah DCC officer list as secondary verification signal
- [ ] `supabase/functions/verify-claim/index.js` — accepts claim token, marks claim verified, grants edit access
- [ ] `goed/src/views/CompanyEditView.vue` — self-service edit page post-claim; all profile fields including `investors text[]` and `total_raised`; Google Places photo gallery curation
- [ ] `goed/src/components/company/PhotoGallery.vue` — Google Places photos as starting gallery; owner curates / adds custom uploads
- [ ] `goed/src/components/map/CompanyAnalytics.vue` — stubbed stat cards ("Your listing was viewed X times this week / X times total"); wired to a Supabase RPC that will return real data in M10; shows zeros until then
- [ ] `goed/src/composables/useCompanyClaim.js` — reads claim token from URL, verifies, stores edit session
- [ ] End state: founder receives magic link, verifies domain ownership, edits their listing, sees analytics stub

**Dependencies:** M3 (`startup_submissions` table, `onboard-company` pipeline that generates the "claim your listing" CTA).

---

## Milestone 5: Recurring Data Refresh
**Complexity: S**
**Tier: 1**
**Linked Feature: 0004**

Keeps the map alive. The differentiator vs. every dead startup directory. Intentionally lean — jobs refresh weekly via free structured APIs; AI-dependent enrichment (investor data, company profile) is event-driven, not scheduled.

**Description:**
Schedule a weekly pg_cron job that polls ATS job endpoints (Greenhouse, Lever, Ashby JSON APIs) for each company and updates `job_titles`, `is_hiring`, and `careers_url`. No AI calls, no Claude, no cost — just HTTP fetches to public structured APIs. Investor/funding data is refreshed separately on founder claim or via a quarterly admin-triggered run. This keeps the map's hiring data fresh without scaling costs as the company count grows.

**Refresh Scoping:**

| Data | Cron cadence | Method | AI? |
|------|-------------|--------|-----|
| Job postings (`job_titles`, `is_hiring`, `careers_url`) | Weekly | ATS JSON APIs (Greenhouse/Lever/Ashby) | No |
| Investor/funding (`investors`, `total_raised`) | On claim or quarterly admin trigger | Crunchbase scrape via existing enricher | No (scrape only) |
| Company profile (description, sector, etc.) | On founder request only | Full pipeline via `onboard-company` | Yes (Claude gap-fill) |

**Key Deliverables:**
- [ ] `supabase/migrations/0004_pg_cron.sql` — enables `pg_cron` extension, schedules weekly job invoking `refresh-jobs`
- [ ] `supabase/migrations/0005_refresh_log.sql` — `refresh_log` table (startup_id, run_at, source `'cron'|'manual'|'admin'`, success, error_message, jobs_updated int)
- [ ] `supabase/functions/_shared/ats.js` — ATS job poller: detects ATS platform from `careers_url` domain, calls the appropriate structured API (Greenhouse `boards-api.greenhouse.io/v1/boards/{co}/jobs`, Lever `api.lever.co/v0/postings/{co}`, Ashby `jobs.ashbyhq.com/{co}` JSON endpoint); returns normalized `{ job_titles: string[], is_hiring: boolean, careers_url: string }`; returns null if no ATS detected (falls back to existing values)
- [ ] `supabase/functions/refresh-jobs/index.js` — accepts optional `{ startup_id, force }`: if `startup_id` given, refreshes one company; if bulk, queries `startups WHERE jobs_refreshed_at < NOW() - INTERVAL '7 days'`; for each company, calls `_shared/ats.js` only; updates `job_titles`, `is_hiring`, `careers_url`, `jobs_refreshed_at`; logs to `refresh_log`; `force: true` bypasses recency gate
- [ ] `supabase/functions/refresh-jobs/logger.js` — writes run outcome to `refresh_log`
- [ ] Verified: cron fires weekly, `jobs_refreshed_at` advances, recently-refreshed companies are skipped, manual force-refresh works, log entries appear in `refresh_log`; zero AI calls in cron path

**Dependencies:** M1 (`startups` table, `pg_cron` not yet enabled). M3 (`_shared/ats.js` is a new shared module — M3 uses it during onboarding too, so build it in M3 and import here).

---

## Milestone 6: Admin Management UI
**Complexity: M**
**Tier: 1**
**Linked Feature: 0005**
**Linked Feature: 0005**

GOED operational control. Staff approve submissions, edit records, trigger refreshes, and monitor subscriber counts.

**Description:**
Protected `/admin` route with Supabase auth (GOED staff allow-list), submission queue, full CRUD on the `startups` table, manual refresh buttons, and a subscriber dashboard panel (populated by M9 data but built as a shell now so M9 just fills it in). Also ships the public `/roadmap` page for judges.

**Key Deliverables:**
- [ ] `supabase/migrations/0006_admin_users.sql` — `admin_users` table (email allow-list) and RLS policies that gate `/admin` mutations
- [ ] `goed/src/router/guards.js` — route guard redirecting unauthenticated users away from `/admin`
- [ ] `goed/src/views/admin/AdminLayout.vue` — admin shell with nav (Dashboard, Submissions, Companies, Refresh, Subscribers)
- [ ] `goed/src/views/admin/AdminLogin.vue` — Supabase magic-link login restricted to allow-listed GOED emails
- [ ] `goed/src/views/admin/AdminDashboard.vue` — counts of pending submissions, total companies, last cron run, hiring count, subscriber count (zero until M9), last digest send time (zero until M9)
- [ ] `goed/src/views/admin/SubmissionQueue.vue` — list of `startup_submissions` with status='pending'; click row to inspect
- [ ] `goed/src/components/admin/SubmissionReview.vue` — side-by-side: extracted data + scraped source preview; Approve / Reject / Edit-then-Approve buttons
- [ ] `goed/src/views/admin/CompanyList.vue` — searchable / sortable list of all `startups` rows
- [ ] `goed/src/components/admin/CompanyEditor.vue` — full edit form for a single startup record (all schema fields including `investors text[]` and `total_raised`)
- [ ] `goed/src/views/admin/RefreshControl.vue` — "Refresh all" button + per-company refresh buttons; tails recent `refresh_log` entries
- [ ] `goed/src/views/admin/SubscriberPanel.vue` — shell: total confirmed subscribers, per-filter-criteria breakdown, timestamp of last digest send; shows zeros until M9 populates data
- [ ] `goed/src/stores/admin.js` — Pinia store for admin session + submissions list
- [ ] `goed/src/composables/useAdminAuth.js` — auth state + allow-list check
- [ ] `supabase/functions/approve-submission/index.js` — moves a submission to the `startups` table, marks submission `approved`
- [ ] `supabase/functions/reject-submission/index.js` — marks submission `rejected` with reason
- [ ] `goed/src/views/RoadmapView.vue` — public-facing product vision page at `/roadmap`; polished card layout; linked from main nav footer
- [ ] `goed/src/components/roadmap/RoadmapCard.vue` — vision feature card (icon, title, description, status badge: "Coming Soon" / "In Development" / "Planned")
- [ ] Roadmap content covers: Stripe verified MRR/ARR leaderboard, LinkedIn integration, deeper investor analytics, investors as first-class map entities, global talent identification and recruitment campaign tooling, founder ↔ investor matching and messaging, mobile app, API access, international expansion beyond Utah
- [ ] End-to-end: GOED staff logs in, sees queue, approves a submission, company appears on public map; judges navigate to `/roadmap` to see platform vision

**Dependencies:** M3 (`startup_submissions` table). M5 (refresh control invokes M5's Edge Function). M9 data surfaces in SubscriberPanel but M6 builds the shell regardless.

---

## Milestone 9: Engagement — Subscriptions & AI Digest
**Complexity: M**
**Tier: 3**
**Linked Feature: 0007**
**Linked Feature: 0007**

The primary retention mechanic. Visitors subscribe to weekly Utah startup updates; Claude writes a personalized digest (or ecosystem highlights when their filter has no new activity).

**Description:**
Build the subscription form, double opt-in confirmation via Resend, and the weekly `send-digest` Edge Function that runs Claude in one of two modes per subscriber. Populates the SubscriberPanel in admin that was built as a shell in M6.

**Digest Architecture — Two Modes, One Edge Function:**

| Mode | Trigger | Claude's job |
|---|---|---|
| `personalized` | ≥ 1 matching update (new company, stage change, new `is_hiring`) in subscriber's filter since last digest | Write a targeted narrative about what changed in their sectors this week |
| `ecosystem_highlights` | 0 matching updates in subscriber's filter | Write a broader ecosystem digest: most-viewed companies this week, total hiring count, one featured startup — keeps cadence without sending empty emails |

Both modes share one system prompt and the same Resend send path. The user prompt template switches on `mode`. No digest is ever skipped — slow weeks become ecosystem highlights.

**Key Deliverables:**
- [ ] `supabase/migrations/0009_subscriptions.sql` — `subscriptions` table: id, email, filter_criteria jsonb (`{ sectors: string[], stages: string[], hiring_only: boolean, regions: string[], investor: string }`), frequency text default `'weekly'`, last_digest_sent timestamptz, created_at, confirmed boolean default false; `digest_runs` table (id, run_at, subscribers_sent int, errors int); pg_cron entry scheduling `send-digest` weekly
- [ ] `supabase/functions/send-digest/prompts.js` — `buildPersonalizedPrompt(subscriber, updates)` and `buildEcosystemPrompt(subscriber, highlights)` user prompt templates plus one shared system prompt; exported for `index.js`
- [ ] `supabase/functions/send-digest/index.js` — queries all confirmed subscriptions; for each subscriber: queries `startups` for matching updates since `last_digest_sent`; if ≥ 1 update → calls Claude with `buildPersonalizedPrompt`; if 0 → queries ecosystem highlights (top viewed companies from `company_views`, hiring count, newest verified listing) → calls Claude with `buildEcosystemPrompt`; sends Claude-written subject + HTML body via Resend with unsubscribe link; updates `last_digest_sent`; logs run to `digest_runs`
- [ ] `/subscribe` route + `goed/src/views/SubscribeView.vue` — subscription form: email input + filter preferences (sector multi-select, stage multi-select, hiring toggle, investor text input, region multi-select); on submit, inserts unconfirmed row + sends Resend confirmation email; on confirm click, sets `confirmed = true`
- [ ] `goed/src/components/map/SubscribeCTA.vue` — sticky footer CTA strip on the map: "Get weekly Utah startup updates →"; opens subscription modal; dismissable (localStorage); shown to non-subscribers only
- [ ] Admin `SubscriberPanel.vue` (M6 shell) now fully populated — total confirmed subscribers, per-filter-criteria breakdown, timestamp of last digest send from `digest_runs`
- [ ] End state: visitor subscribes in 30 seconds → receives weekly Claude-written digest matching their criteria; GOED admin sees subscriber count in dashboard

**Dependencies:** M1 (map, router, `startups` table, brand styles). M5 (`pg_cron` extension already enabled). M6 (`SubscriberPanel` shell). Note: ecosystem highlights mode queries `company_views` — this table is created in M10, so until M10 lands, the ecosystem fallback uses only hiring count + newest listing.

---

## Milestone 10: Engagement — Analytics & Share Cards
**Complexity: M**
**Tier: 3** — OG image generation via Satori is the highest-risk deliverable in this milestone. If time is tight, ship view tracking + basic meta tags first; defer full Satori OG rendering to roadmap.

Closes the retention loop for founders. View tracking gives them a reason to check back; OG social cards give them a reason to share.

**Description:**
Add anonymous view tracking (fire-and-forget on drawer open), populate the CompanyAnalytics component built as a stub in M4, generate branded OG PNG cards via a Satori Edge Function, and wire up the useShareCard composable so sharing a company URL looks premium on LinkedIn and Twitter.

**Key Deliverables:**
- [ ] `supabase/migrations/0010_view_counts.sql` — `company_views` table: startup_id (fk → startups.id), viewed_at timestamptz, session_id text (anonymous UUID from client sessionStorage); no PII stored; index on (startup_id, viewed_at) for aggregate queries
- [ ] `supabase/functions/track-view/index.js` — inserts a row into `company_views`; responds 200 immediately; called fire-and-forget from frontend (no await, no loading state)
- [ ] `goed/src/components/drawer/CompanyDrawer.vue` update — calls `track-view` on drawer open (fire-and-forget fetch, no UI side effects)
- [ ] `goed/src/components/map/CompanyAnalytics.vue` update (M4 stub → live) — Supabase RPC `get_company_view_stats(startup_id)` returns `{ views_this_week, views_total }`; renders as clean stat cards inside `CompanyEditView.vue`
- [ ] `supabase/functions/generate-og-image/index.js` — Edge Function using Satori (adapted for Deno) that generates a branded PNG OG card: company name, sector badge, stage badge, logo (via logo.dev), Utah blue (#0065A4) background, white text; served at `/og/[company-id].png`; cached with `Cache-Control: public, max-age=86400`
- [ ] `goed/src/composables/useShareCard.js` — accepts a company record; constructs the shareable deep-link URL (map with drawer auto-open); sets `<meta property="og:image">` and `<meta property="twitter:card">` dynamically; returns `{ shareUrl, ogImageUrl, copyLink() }`
- [ ] Share button wired into `CompanyDrawer.vue` — calls `useShareCard.copyLink()`, shows "Copied!" confirmation; founders and visitors can share any company
- [ ] M9 `send-digest` ecosystem fallback now queries real `company_views` data for "most-viewed this week" section
- [ ] End state: founder claims listing → sees real view stats in CompanyAnalytics → copies share URL → LinkedIn post shows branded OG card

**Dependencies:** M1 (map, `startups` table, router). M4 (`CompanyAnalytics` stub, `CompanyEditView`). M9 (ecosystem digest fallback gains real view data).
