# Project Brief

Source of truth for the hackathon criteria. Read once, refer back when scope creep tries to sneak in.

---

## The challenge

Two products, one platform:

1. **Founder's Navigator** — Replace the static "Entrepreneur Journey" page at startup.utah.gov with a personalized, AI-augmented discovery experience.
2. **Utah Startup Map** — Filterable directory of Utah startups with self-service profile claiming and (Phase 2) an interactive map view.

Both must live together on the official Startup State platform and be shown to international investors.

> The brief's explicit warning: *"a complete, polished build of one product will score higher than two rushed ones."*

We're building both because they share data and infrastructure, but Resources is primary. If anything has to give, it's the literal map view, not the data layer.

---

## Non-negotiable requirements

| Requirement | How we satisfy it |
|---|---|
| **Working prototype** (not slides) | Live Netlify deploy from day 1, real data flowing through real APIs |
| **Personalized experience** | Three-panel dashboard differentiated by stage + industry + topic (see `UX_FLOWS.md`) |
| **Easily updatable** | Resources live in Supabase, not in code. Adding a row = adding a resource. No deploy. |
| **Self-service profiles (Map)** | Open submit form on `/claim`, no auth gate (Phase 1); email verification deferred to Phase 2 |
| **Dual audience ready** | Same data, two surfaces: founder dashboard + public directory |
| **Production quality** | Linear-clean visual direction, shadcn/ui primitives, GSAP polish on the moments that matter |

---

## The 6 test personas

Our scoring algorithm and dashboard must surface meaningfully different content for each. We will live-demo two of them (Maria + Priya). All six must work.

| # | Persona | Quiz answers | What the dashboard must surface |
|---|---|---|---|
| 1 | **Jordan, 20, SLC** — pre-seed, idea-stage | Pre-revenue / Other / Community | Lassonde, BoomStartup, idea-stage grants, student programs |
| 2 | **Maria, 38, Washington Co.** — woman-owned ag, scaling | Scaling / Agriculture / Talent/hiring | Women's Business Center of Utah, USDA Rural Dev, Utah Dept. of Ag, Southwest SBDC |
| 3 | **Marcus, 34, Ogden** — veteran, manufacturing, early | Early revenue / Manufacturing / Funding | Veteran Business Outreach, Boots to Business, Utah MEP, Weber State SBDC |
| 4 | **Priya, 31, SLC** — B2B SaaS, raising Series A | Scaling / Software/IT / Funding | Pelion, Album VC, Kickstart, Park City Angels, RevRoad, pitch competitions |
| 5 | **David, 45, Provo** — medical device, FDA cleared, internationalizing | Established (Utah-based) / Healthcare / Other | BioHive Utah, World Trade Center Utah, STEP grant, EXIM Bank |
| 6 | **Dr. Amir, 29, SLC** — U of U PhD, deep tech | Pre-revenue / Healthcare / Funding | PIVOT Center, SBIR/STTR, I-Corps, Lab-to-Market |

**Demo personas:** Maria + Priya (same Stage, completely different industries → proves the algorithm differentiates beyond Stage alone).

---

## Judging criteria

| Weight | Criterion | What judges actually look for |
|---|---|---|
| **30%** | Usability & Experience | Would a real founder use this? Speed, clarity, "felt built for me" |
| **25%** | Technical Execution | Does it work? Is it scalable? Does the algorithm hold up under varied input? |
| **25%** | Design & Visual Impact | Investor-ready presentation quality. Could this go on a screen in Tokyo? |
| **20%** | Innovation & Creativity | Did you surprise us? (Our angle: GOEO admin analytics + concierge question gap report) |

UX + Design = 55%. **Polish wins.** This is why we cut features after 11 AM.

---

## What "winning" looks like beyond the prize

- **$10,000 cash prize** — split TBD by team
- **Possible production deployment** on startup.utah.gov via GOEO partnership
- A real opportunity to build the v2 with state backing

The brief is explicit: *"This weekend might be where it all starts."* Plan accordingly.

---

## Provided data

| Asset | Location | Owner |
|---|---|---|
| Resources spreadsheet (~100 rows) | [Google Sheet](https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit) | Beau (parses to JSON, loads to Supabase) |
| Map data (companies) | [Google Sheet](https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit) | Beau (loads to Supabase on `feat/map`) |
| Reference startup map | [pampam.city/utah-startup-map](https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN) | Drew (visual reference) |
| Live state site | [startup.utah.gov](https://startup.utah.gov/) | Reference for what we're improving on |

**We are not gathering data. Beau owns ingestion. Everyone else builds.**
