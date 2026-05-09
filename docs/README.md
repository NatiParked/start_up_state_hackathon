# Utah Founder Navigator

> A personalized founder dashboard built for the Utah GOEO AI Builder Day hackathon.
> If we win, this replaces or augments [startup.utah.gov/entrepreneur-journey](https://startup.utah.gov/entrepreneur-journey/).

**Repo:** https://github.com/NatiParked/start_up_state_hackathon
**Branches:**
- `main` — Founder Resources (Part 1 of the hackathon brief)
- `feat/map` — Utah Startup Map (Part 2 of the hackathon brief)

---

## What we're building

Two interconnected products on one platform:

1. **The Founder's Navigator** (`main`) — A 3-question quiz routes founders to a personalized dashboard with hand-curated next steps, a ranked list of relevant state resources, and a list of real humans to meet. An AI concierge ("Ask the State") handles edge cases and logs unanswered questions for GOEO.

2. **The Utah Startup Map** (`feat/map`) — A filterable directory of Utah startups with self-service profile claiming. Phase 2 adds an interactive map view.

The hackathon brief explicitly warns: *"a complete, polished build of one product will score higher than two rushed ones."* We are building both with strict cutlines (see `SPRINT_PLAN.md`).

---

## Getting started

> **⚠️ Cayden owns the framework decision** (Vite vs Next, package manager, Node version, TypeScript yes/no). Post the answer in Slack ASAP — half this doc set codifies once that's locked. See `OPEN_QUESTIONS.md`.

Assuming Vite + pnpm + Node 20 (the recommended stack — see `ARCHITECTURE.md`):

```bash
git clone https://github.com/NatiParked/start_up_state_hackathon.git
cd start_up_state_hackathon
pnpm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
pnpm dev
```

Live preview: Netlify auto-deploys every push to `main` and `feat/map`.

---

## Repo map

```
/docs                        ← you are here
  README.md                  ← this file
  PROJECT_BRIEF.md           ← hackathon criteria, personas, judging rubric
  ARCHITECTURE.md            ← stack, deployment, env vars, system diagram
  DATA_MODEL.md              ← resource schema, scoring algorithm, DB tables
  API_CONTRACT.md            ← every endpoint, request/response shape
  UX_FLOWS.md                ← screen-by-screen, state diagram
  DESIGN_SYSTEM.md           ← Drew's playground (colors, type, components)
  AI_CONCIERGE.md            ← system prompt, citations, question logging
  MAP_BUILD.md               ← Map half (feat/map branch)
  SPRINT_PLAN.md             ← timeline, cutlines, parallelism
  DECISIONS.md               ← ADR log of every locked decision
  OPEN_QUESTIONS.md          ← what we still need to answer + who owns it
  /tasks
    burkely.md               ← deploy + unblocker
    cayden.md                ← front-end lead
    beau.md                  ← data + back-end
    drew.md                  ← design + UX + animation
/src                         ← (created by Cayden's scaffold)
/supabase                    ← migrations, seed scripts (Beau)
/netlify/functions           ← AI concierge proxy (Beau)
```

---

## Team

| Name | Role | Primary deliverables |
|---|---|---|
| **Burkely** | DevOps / unblocker | Netlify pipeline, Supabase env, monitoring, demo backstop |
| **Cayden** | Full-stack / front-end lead | Quiz, dashboard, all routes, API integration |
| **Beau** | Data / back-end | Sheet → JSON, Supabase schema, scoring API, profile API, concierge logging |
| **Drew** | Design / UX | Sketches, design system, GSAP/Framer animations, mobile QA, demo narration |

Each role has a dedicated brief at `/docs/tasks/<name>.md`. Open that file first.

---

## The 30-second pitch

Utah's founder ecosystem has world-class resources buried in a state website built like a library. We replaced the library with a guide:
- Tell us where you are (3 questions, 60 seconds)
- We hand you a personalized dashboard with what to do *this week*, ranked resources for your stack, and humans to meet this month
- Ask the State, our grounded AI concierge, handles whatever the quiz missed and logs gaps for GOEO

Built for founders. Demoed to investors. Designed to ship to production on `startup.utah.gov`.

---

## Key conventions

- **API contract is frozen by 9:00 AM tomorrow.** See `API_CONTRACT.md`. If back-end isn't ready, Cayden builds against mocks. No surprises at 11 AM.
- **10:00 AM standup: "are we connected?"** Front-end and back-end must be talking. If not, that's the only thing we work on until they are.
- **After 11:00 AM: polish only.** No new features. No scope creep. See `SPRINT_PLAN.md` cutlines.
- **Every decision goes in `DECISIONS.md`.** If you change one, update the doc.
- **Every blocker goes in Slack immediately.** Don't sit on a problem.

---

## License

Currently unlicensed. To be decided post-hackathon (likely MIT if GOEO takes it to production).
