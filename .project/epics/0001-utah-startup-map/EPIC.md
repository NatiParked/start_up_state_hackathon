# Epic 0001: Utah Startup Map & Founder's Navigator

## Challenge Brief
**Utah GOED AI Builder Day Hackathon** — Requirements and judging rubric: https://startupstate.netlify.app/

## Vision
Build a polished, premium-feeling **platform** for the Utah startup ecosystem — not a one-time directory, but a recurring destination that turns visitors into subscribers and founders into advocates. The core experience is an interactive map that visualizes every Utah company as a logo pin, paired with an AI-powered onboarding pipeline that lets any founder add their company in one URL paste. Retention mechanics — weekly digest emails, job-match alerts, profile view analytics, and shareable branded OG cards — convert a first visit into a habit. A second product, Founder's Navigator, helps founders find the right GOED programs, capital, and community resources. Submitted to the Utah GOED AI Builder Day Hackathon ($10k prize, potential live deployment on startup.utah.gov).

The weekly digest, job alerts, profile analytics, and shareable OG cards are the retention mechanics that turn a one-time visitor into a recurring user.

## Problem Statement
Utah's startup ecosystem is one of the densest per-capita in the country, but it is largely invisible. Founders, investors, journalists, and out-of-state talent have no canonical way to see who is building in Utah, where they are located, what stage they are at, who is hiring, or which fund has backed them. GOED has the data but not the surface. Existing directories are stale because they rely on manual data entry — companies submit once, then nobody maintains the listing. This epic ships both a public discovery surface (the Map) and the self-serve, AI-driven data pipeline that keeps it fresh without GOED staff doing manual review for every submission.

Investors specifically lack a way to browse the Utah ecosystem by portfolio, syndicate, or fund — knowing that Kickstart Fund or Album VC has backed ten companies in a sector is useful signal that no current tool surfaces.

## Goals
- Public Utah Startup Map with all 96 seed companies visualized as clickable logo pins on an OpenLayers map of Utah
- Filter sidebar covering sector, stage, employee count, hiring status, founding year, funding stage, business type, and **investor** (e.g., "backed by Kickstart Fund")
- Smooth animated company drawer (GSAP) showing logo, sector, stage, hiring badge, jobs preview, external links, **investor names with funding round pills**, and **total raised badge**
- Self-serve onboarding: a founder pastes a URL and an API-first enrichment pipeline (logo.dev + Nominatim + Utah DCC + Crunchbase + ATS endpoints, then Claude Haiku via OpenCode Zen for gaps) produces a structured, geocoded, logo'd company record
- Auto-publish path for high-confidence Utah submissions; human review queue for everything else
- **Investor data layer:** investor names stored as a filterable `text[]` array on the `startups` table, sourced from the Crunchbase enricher in M2; powers the "Investor" filter in the sidebar and the "Investors" section in the company drawer — making the map useful to VCs and angels browsing the ecosystem by syndicate or fund
- Weekly recurring refresh of job postings via pg_cron + ATS JSON APIs (no AI cost); investor/funding data refreshed on founder claim or quarterly only
- Admin UI for GOED staff to manage submissions, edit records, trigger refreshes, and monitor subscriber counts
- **Engagement & retention layer:** weekly personalized digest emails, anonymous view tracking with founder-facing analytics, and shareable branded OG social cards — turning one-time visitors into recurring users and passive listings into active founder touchpoints
- Founder's Navigator delivering personalized resource recommendations + recommended GOED contact + next-steps guide from a 100-resource corpus
- Brand-aligned (Utah blue #0065A4) but architected for easy restyle if absorbed into startup.utah.gov

## Scope

### In Scope
- Vue 3.5 + Vite 8 single-page app with Vue Router and Pinia stores
- OpenLayers map (via vue3-openlayers) with logo-pin markers and clustering at zoom-out
- One-time geocoded import of 96 companies from Google Sheet to Supabase `startups` table
- Filter sidebar + URL-synced filter state, including an "Investor" filter backed by `investors text[]`
- GSAP-animated right-side company drawer, including an "Investors" section (name pills + total raised badge)
- Supabase Edge Functions for: AI onboarding pipeline, weekly job refresh, semantic resource search, magic-link claim verification, **weekly digest delivery, anonymous view tracking, OG image generation**
- Claude Haiku 4.5 via OpenCode Zen for map onboarding gaps (Edge Function fetches HTML, passes to model — no native `web_fetch` through gateway); Crunchbase scraped directly by the Edge Function
- logo.dev integration for logos by domain
- Nominatim integration for address geocoding
- pgvector for semantic search over the resources corpus (Founder's Navigator)
- Admin route protected by Supabase auth (GOED staff only) with submission queue, edit/delete, manual refresh, and **subscriber count + last digest send time**
- Domain-ownership claim flow (magic link to `admin@<domain>`) for existing-company edits
- **Subscription flow:** `/subscribe` route with email + filter preferences; confirmation email via Resend; weekly pg_cron digest personalized per subscriber
- **Founder analytics:** company view counts surfaced in the post-claim edit UI (`CompanyAnalytics.vue`)
- **OG social cards:** Edge Function generates a branded PNG per company (name, sector, stage, logo, Utah-blue background); `useShareCard.js` composable populates meta tags
- Netlify deployment

### Out of Scope
- Native mobile apps (responsive web only)
- **Investors as first-class map entities** (investor profiles as pins, filtering map by investor geography or fund focus area) — future roadmap; the hackathon scope adds investor *data* to company records but does not treat investors as primary map entities
- **Global talent identification and outreach campaign tooling** — identifying out-of-state talent for Utah recruitment campaigns is a high-value follow-on that directly addresses organizer feedback about attracting international talent; not in hackathon scope
- **Founder ↔ investor direct matching and messaging** — in-app deal flow introduction tooling; addresses organizer feedback about making Utah "sticky" for global investors; post-hackathon roadmap only
- Direct messaging between founders and GOED inside the app
- Payment processing, paid listings, or featured-placement upsells
- Real-time multi-user collaboration on company records
- Historical time-travel / "Utah in 2019" map view
- Full-text crawl of the entire Utah web — refresh is scoped to known company domains and ATS endpoints
- Authentication for general public users (only founders claiming a listing and admins log in)

These out-of-scope items are explicitly deferred, not abandoned. They represent the platform vision beyond the hackathon: investors as first-class entities on the map, a global talent-attraction campaign layer, and founder-investor matching all directly address GOED's stated goals of making Utah sticky for global capital and international talent.

## Technical Context
- **Frontend:** Vue 3.5 (Composition API), Vue Router 5, Pinia, Vite 8, Tailwind CSS, GSAP for animation, vue3-openlayers for the map
- **Backend:** Supabase (Postgres, Edge Functions on Deno, pgvector extension, Auth, Storage for any cached photos), pg_cron for scheduled refresh
- **AI (Map pipeline):** Claude Haiku 4.5 via OpenCode Zen — API-first enrichment; structured sources run first, AI fills remaining gaps from website HTML fetched by the Edge Function (no native `web_fetch` through a gateway — the Edge Function fetches, then passes content to the model)
- **AI (Founder's Navigator):** Google Gemini 1.5 Flash (free tier) — `text-embedding-004` at 768 dimensions for pgvector, Gemini Flash for reranking and next-steps synthesis
- **External APIs:** logo.dev (logos by domain), Nominatim (OSM geocoding, with self-hosted fallback if rate limits bite), ATS endpoints (Greenhouse, Lever, Ashby) for jobs, Resend (transactional + digest email delivery)
- **Hosting:** Netlify (frontend), Supabase (everything backend)
- **Key constraints:**
  - Hackathon timeline: Map must be demo-ready before AI onboarding is fully polished — slice work so the map alone is a complete product
  - "A complete, polished build of one product scores higher than two rushed ones" — Founder's Navigator is genuinely deferred to Milestone 5 and is allowed to be leaner
  - All AI calls go through Edge Functions, never directly from the browser (API key safety + prompt-injection isolation)
  - Auto-publish quality gate: name + address + sector + description must all be present, address must geocode inside Utah's bounding box, no duplicate by name or domain
  - Logos are fetched at render time from logo.dev (cached in `logo_url` column once resolved) — no S3 logo hosting
  - Investor data sourced entirely from the Crunchbase enricher — no manual investor entry; stored as `text[]` so it is filterable and pillable without a separate join table

## Success Metrics
Tied to the four hackathon judging criteria:

- **Usability & Experience (30%)** — A first-time visitor can land on the map, see Utah, click a pin, read a company (including its investors and funding), filter to "hiring B2B SaaS in SLC backed by Album VC," subscribe to a weekly digest, and submit their own company in under 90 seconds total. No instructions required.
- **Technical Execution (25%)** — End-to-end AI onboarding pipeline works in a live demo: paste URL → 30-90 seconds later the company appears on the map with logo, geocoded pin, structured profile, investor data, and current job postings. Zero manual steps.
- **Design & Visual Impact (25%)** — Map feels premium: company logos as pins (not generic markers), Utah-blue brand, GSAP drawer transitions, dense SLC/Provo clustering reads as "thriving ecosystem" rather than chaos. Screenshot-worthy at every zoom level. OG cards look polished when shared on LinkedIn.
- **Innovation & Creativity (20%)** — The AI onboarding + recurring refresh + digest retention pattern is the original idea: most directories die because they're static. This one self-heals weekly and re-engages subscribers automatically. The investor filter, founder analytics, and OG share card elevate it from directory to platform.

## Key Decisions
- **Map library:** OpenLayers via vue3-openlayers (not Mapbox/Google) — open-source, no API key billing, full control over styling, fits Vue idioms
- **Logo source:** logo.dev API by domain — premium look without hosting overhead; falls back to monogram if no logo found
- **Geocoding:** Nominatim (OSM) — free, accurate enough for street addresses; self-host if rate-limited
- **Enrichment order:** API-first — logo.dev → Nominatim → Utah DCC → Crunchbase → ATS job endpoints → Claude Haiku (gap-fill only); AI only touches what structured sources could not provide; fires on new submissions and claim events, never on the weekly cron
- **Weekly refresh:** ATS job endpoint polling only (Greenhouse/Lever/Ashby structured JSON — no AI, no cost); investor/funding refreshed on founder claim or quarterly; company profile only on founder request
- **AI providers:** Claude Haiku 4.5 via OpenCode Zen for map pipeline; Google Gemini 1.5 Flash (free tier) for Founder's Navigator (embeddings at 768 dims via `text-embedding-004`, reranking, synthesis)
- **Database:** Supabase Postgres with pgvector — single backend for relational data, vector search, auth, edge functions, and cron
- **Onboarding intake:** URL only (not a long form) — radical simplicity is the differentiator; the pipeline does the work
- **Auto-publish gate:** Quality + Utah-bounds + no-duplicate; everything else routes to admin queue — keeps the map clean without bottlenecking on humans
- **Refresh cadence:** Weekly cron for jobs only (cheap HTTP calls); investor and profile data event-driven — scales to hundreds of companies without meaningful cost
- **Claim verification:** Magic link to `admin@<domain>` — proves domain ownership without OAuth complexity
- **Brand:** Utah blue #0065A4 + white, but theming layer kept thin (Tailwind + CSS variables) so startup.utah.gov can restyle
- **Build order:** Map (M1) before AI pipeline (M2) before refresh (M3) before admin (M4) before Navigator (M5) before retention (M6) — every milestone leaves a shippable artifact
- **Investor data:** stored as `text[]` on `startups` — avoids a join table for the hackathon, still queryable with `@>` array operators and filterable in the sidebar; upgrade to a proper `investors` table post-hackathon
- **Email delivery:** Resend API — developer-friendly, generous free tier, works cleanly from Deno Edge Functions
- **OG image generation:** Satori (or `@vercel/og` pattern adapted for Deno) in an Edge Function — no headless browser needed, purely JS-based PNG rendering
- **View tracking:** anonymous `session_id` only — no PII, no auth required, fire-and-forget from the frontend
- **Hosting:** Netlify for frontend, Supabase for backend — both have generous free tiers and zero-config Vue/Edge Function deploys

## Personas
| Persona | Age | Location | Stage / Sector | Primary Use of the Map |
|---|---|---|---|---|
| Jordan | 20 | Salt Lake City | Pre-seed ideation | Browse SLC peers at similar stage; find founders to meet for coffee |
| Maria | 38 | Washington County (rural) | Scaling, woman-owned agriculture | Filter by rural Utah + agriculture to find peer scaling-stage businesses; submit her own company to be visible |
| Marcus | 34 | Ogden | Early-stage fabrication, veteran founder | Find other Ogden / Northern Utah hardware companies and suppliers |
| Priya | 31 | Salt Lake City | B2B SaaS, raising VC | Filter by SaaS + Series A/B + investor to map competitive landscape and identify peers for warm intros; subscribe to weekly digest of new SaaS companies |
| David | 45 | Provo | Medical device, international expansion | Find other Utah medical device companies for partnership; verify his own listing is accurate; share his OG card on LinkedIn |
| Dr. Amir | 29 | Salt Lake City | Deep-tech / novel commercialization, PhD | Discover other research-driven Utah startups; later, use Founder's Navigator to find non-dilutive funding programs |
