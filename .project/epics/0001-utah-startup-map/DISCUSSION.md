# Discussion Log — Epic 0001: Utah Startup Map & Founder's Navigator

## Revision 1 — 2026-05-08

**Type:** Direct revision (no discussion round required — feedback was fully specified)

**Changes applied:**

1. **Challenge Brief link added** — `https://startupstate.netlify.app/` added as a "Challenge Brief" section at the top of EPIC.md above the Vision, making the judging rubric and requirements URL permanently referenceable.

2. **Vision reframed as platform** — Vision section updated to explicitly frame the product as a recurring-engagement platform, not a one-time directory. Added the sentence: "The weekly digest, job alerts, profile analytics, and shareable OG cards are the retention mechanics that turn a one-time visitor into a recurring user."

3. **Investor data layer added throughout** — `investors text[]` and `total_raised text` columns added to the `startups` schema (M1 init migration). `InvestorFilter.vue` added to the M1 filter sidebar deliverables. `CompanyDrawer.vue` updated in M1 to include an "Investors" section (name pills + total raised badge). The Crunchbase enricher in M2 is now explicit about storing investor names into `startups.investors` and total funding into `startups.total_raised`. Investor filter added to the Goals section and In Scope list in EPIC.md.

4. **Milestone 6: Engagement & Retention Layer added** — New milestone covers: `subscriptions` table + weekly pg_cron digest via `send-digest` Edge Function (Resend API), `company_views` table + `track-view` Edge Function, `CompanyAnalytics.vue` for founder-facing view stats, `generate-og-image` Edge Function (Satori/Deno), `useShareCard.js` composable, `/subscribe` route + `SubscribeView.vue`, and `SubscribeCTA.vue` sticky footer. MILESTONES.md Overview updated to reference six milestones.

5. **M4 expanded** — `SubscriberPanel.vue` added to the admin nav and deliverables list; shows subscriber count and last digest send time. `AdminLayout.vue` nav updated to include "Subscribers" tab. Roadmap content in M4 expanded to include the three future-roadmap platform vision items.

6. **Out of Scope expanded** — Three future-roadmap items added with explicit rationale: investors as first-class map entities, global talent identification and outreach campaign tooling, and founder ↔ investor direct matching. Each is tied to stated GOED organizer goals (Utah "sticky" for global investors, attracting international talent).

7. **Personas updated** — Priya's persona updated to reflect the investor filter and digest subscription use case. David's persona updated to reference sharing his OG card on LinkedIn.
