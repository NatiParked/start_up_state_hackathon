# Decisions Log

ADR-style record of every locked decision. If you change one, update this file with the date, the reason, and what changed downstream.

---

## D-001: Two products on one platform

**Date:** Tonight
**Decision:** Build both Founder Resources (Part 1) and Utah Startup Map (Part 2) of the hackathon brief. Resources lives on `main`; Map lives on `feat/map`.
**Why:** Both share the same data infrastructure, design system, and audience. Skipping the Map leaves judging points on the table. Doing both poorly is worse than doing one well, but our team size (4) and parallel architecture allow both if cutlines are enforced.
**Alternative considered:** Resources only. Rejected because the Map is half the brief and the Map is the screen that talks to investors.

---

## D-002: Three-panel dashboard, not flat top-15

**Date:** Tonight
**Decision:** Dashboard renders three distinct panels: "Do This Now" (3 hand-curated items), "Your Relevant Resources" (top 15 scored), "People to Meet This Month" (3 matched humans).
**Why:** Founders need different content shapes for different needs. A scored top-15 is overwhelming on its own; hand-curation surfaces the right thing first. People-to-meet is the missing layer in the current state site.
**Alternative considered:** Single ranked list of 15 (per the original sprint plan). Rejected because it doesn't differentiate guidance from discovery.

---

## D-003: "Do This Now" is hand-curated, not scored

**Date:** Tonight
**Decision:** Panel 1 items come from `roadmaps.json` keyed on stage. Five variants: pre-revenue, early-revenue, scaling, established-utah, established-relocating.
**Why:** The first 3 things a founder should do at a given stage are not a function of industry or topic — they're stage-specific. Scoring would surface "Pelion VC" for a pre-revenue founder who needs to validate the idea first. Curation prevents that.
**Alternative considered:** Score with stage-weighted bonus. Rejected because hand-curation is more legible to founders and more defensible to GOEO.

---

## D-004: Score drives ranking of "Your Relevant Resources" panel

**Date:** Tonight
**Decision:** Panel 2 ranks all matched resources by score DESC. Tiebreaker: alpha by title.
**Why:** Score-based ranking handles the long-tail of the resource catalog where curation isn't feasible. Industry+Topic+Stage signals are sufficient to put the most relevant ones on top.

---

## D-005: Stage → Communities mapping flagged as heuristic

**Date:** Tonight
**Decision:** Beau implements stage-mapped Communities scoring (+40) but documents it as a heuristic, not a literal mapping. Final weight may drop to +25 once Beau reviews and posts the chosen interpretation in Slack.
**Why:** Stage and Community are independent axes (a pre-revenue founder can be a veteran). The original mapping conflates them. Until we have real `stages` data on resources, this is the cleanest available signal.
**Owner:** Beau will post in Slack before 8 AM tomorrow with the chosen approach.

---

## D-006: Established stage triggers a sub-question

**Date:** Tonight
**Decision:** If Q1 = Established, show a sub-screen: "Established & based in Utah" vs "Established & looking to relocate to Utah."
**Why:** Relocating founders need tax incentives and site selection (EDTIF, county economic dev). Utah-based established companies need contracts and international trade. Different roadmaps, different people-to-meet matches.
**Implementation:** `/quiz/established` route, conditional. Adds `established_intent` field to quiz state. +60 score boost on relocation-tagged resources if `intent === 'relocating'`.

---

## D-007: Anonymous sessions, no auth in v1

**Date:** Tonight
**Decision:** Client-generated UUID stored in localStorage as `session_id`. All persistence (checkbox state, feedback, concierge questions, founder profiles) keyed on this ID.
**Why:** Auth in 6 hours is a distraction. Anonymous sessions cover the v1 demo. Phase 2 adds magic-link verification for the founder profile and the business claim form.

---

## D-008: AI Concierge is nice-to-have, not must-have

**Date:** Tonight
**Decision:** Build the concierge only if Phases 1–4 are on schedule. Hard stop at 11:50 AM.
**Why:** The dashboard is the demo. The concierge is a multiplier, but if it's broken at 1:30 PM the demo collapses. Better to ship a clean dashboard without it than a fragile dashboard with it.

---

## D-009: Concierge uses no embeddings — full catalog in prompt

**Date:** Tonight
**Decision:** Stuff all ~100 resources as JSON into Claude's system prompt on every call. No vector store, no embeddings.
**Why:** Catalog is small (~30K tokens). Vector retrieval would add 3+ hours of infra for marginal precision improvement. Direct injection ships in 45 minutes and the model handles citation reliably with the right prompt.

---

## D-010: Concierge logs every question (answered or not)

**Date:** Tonight
**Decision:** Every concierge call writes to `concierge_questions(was_answered, citations, ...)`. Unanswered questions become a content gap report for GOEO.
**Why:** This is the analytics narrative that closes the demo. We're not just helping founders; we're closing the feedback loop with the state. Worth real points on the Innovation criterion.

---

## D-011: Visual direction = Linear-clean + Utah accent

**Date:** Tonight
**Decision:** shadcn/ui Slate base + red-rock orange (`#C2410C`) primary accent. Inter type. Linear/Vercel/Stripe Press as references.
**Why:** Production polish out of the box. Modern but not generic. The orange accent gives subtle Utah identity without going full state-government aesthetic.
**Owner:** Drew may adjust. Update `DESIGN_SYSTEM.md` if so.

---

## D-012: Two routes for profiles (not one with conditional fields)

**Date:** Tonight
**Decision:** `/profile` (founder profile, lightweight) and `/claim` (business profile, 11 fields) are separate routes.
**Why:** Different intents. A founder filling out their personal profile after a quiz is different from a company owner claiming a business listing on the map. One form would have to ask "Are you here to make a personal profile or a business profile?" — that's a UX failure. Two routes = two clear intents.

---

## D-013: Universal CTA + conditional CTA

**Date:** Tonight
**Decision:** Dashboard CTA block always shows "Create your founder profile →." Additionally, if `stage !== 'pre-revenue'`, shows "Claim your business on the Utah Startup Map →."
**Why:** Pre-revenue founders by definition don't have a business yet. Showing them a Map CTA is confusing.

---

## D-014: Map Phase 1 = directory + claim, Phase 2 = Mapbox

**Date:** Tonight
**Decision:** Phase 1 ships filterable directory list + 11-field claim form + business profile pages. Phase 2 (only if time after Phase 1) drops a Mapbox component on `/directory`.
**Why:** Data layer matters more than visual map. Phase 1 satisfies the brief's hard requirements (self-service profiles, all required fields, filterable). Phase 2 is the visual flourish.

---

## D-015: Demo personas = Maria + Priya

**Date:** Tonight
**Decision:** Live demo walks through Maria (Scaling / Agriculture / Talent) → Priya (Scaling / Software/IT / Funding). Drew narrates, Cayden clicks.
**Why:** Same Stage, completely different industry/topic → forces the algorithm to differentiate beyond Stage alone. Best showcase of personalization. Maria covers rural+women+ag (judges' favorite questions); Priya covers SaaS+funding (most recognizable founder type).

---

## D-016: Anonymous sessions sufficient for roadmap progression

**Date:** Tonight
**Decision:** Roadmap checkbox state lives in localStorage only. No DB write needed in v1.
**Why:** Cross-device sync isn't a v1 requirement. The demo doesn't depend on it. localStorage is one line of code via Zustand `persist`.

---

## D-017: Repo unlicensed during the build

**Date:** Tonight
**Decision:** Repo is public, no license file.
**Why:** GOEO partnership decisions get made post-judging. Adding MIT now might be premature commitment. Add license post-hackathon when the destiny of the codebase is clear.

---

## D-018: Framework / package manager / TS — owned by Cayden

**Date:** Tonight
**Decision:** Cayden picks Vite vs Next, pnpm vs npm, Node version, TypeScript yes/no. Recommendation in `ARCHITECTURE.md` is Vite + pnpm + Node 20 + TS, but the call is his.
**Why:** Cayden is the front-end lead and lives in this code longest. He should pick the tools.
**Required:** Cayden posts the decision in Slack tonight before going home so the rest of the team can install correctly tomorrow morning.

---

## D-019: People-to-meet uses placeholder data for v1

**Date:** Tonight
**Decision:** `people.json` is hand-seeded with ~12 stub entries covering combinations of stage / industry / topic. Real GOEO staff names + photos + Calendly links are populated post-hackathon.
**Why:** Real data gathering is hours of research. The panel architecture and matching logic are what we're demoing. Placeholders communicate the intent and let GOEO fill in real entries later.

---

## D-020: One cinematic animation moment, restraint everywhere else

**Date:** Tonight
**Decision:** GSAP-orchestrated full-viewport transition on Q3 submit → dashboard reveal. Everywhere else, Framer Motion for subtle component-level transitions.
**Why:** Animation is expensive (build time + perception). Concentrate it where it lands the most: the dashboard reveal is the demo's emotional peak. Decorative motion elsewhere reads as amateur.
