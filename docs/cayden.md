# Cayden — Front-End Lead

You own the front-end build. Quiz, dashboard, all routes, API integration, and the founder profile + business claim forms. You're the busiest person on the team for 5 of the 6 hours.

---

## ⚠️ First decision (tonight, before going home)

Pick the framework, package manager, Node version, and TypeScript yes/no. **Post in Slack tonight.** The team can't install correctly tomorrow until you've decided.

**Recommendation:** Vite 5 + React 18 + React Router v6 + TypeScript + pnpm + Node 20.

| Pick | Why recommended |
|---|---|
| Vite over Next | Faster cold start, no SSR complexity. Supabase handles the API layer; we don't need server components. |
| TypeScript | The 11-field form, the scoring logic, and the Anthropic integration all benefit. Catches bugs we don't have time to find at runtime. |
| pnpm | 2–3× faster installs across 4 devs across 6 hours. |
| Node 20 LTS | Vite 5 + Supabase JS happy path. |

If you go a different direction, update `ARCHITECTURE.md` to match before going home.

---

## Tonight (1:30–2:30 PM) — 20 minutes

### Tasks

1. Create the GitHub repo if not already done. Confirm Burkely has access.
2. Scaffold the project:
   ```bash
   pnpm create vite@latest start_up_state_hackathon -- --template react-ts
   cd start_up_state_hackathon
   pnpm install
   pnpm install react-router-dom zustand react-hook-form zod @anthropic-ai/sdk @supabase/supabase-js gsap framer-motion lucide-react clsx tailwind-merge
   pnpm install -D tailwindcss postcss autoprefixer @types/node
   pnpm dlx tailwindcss init -p
   pnpm dlx shadcn@latest init
   pnpm dlx shadcn@latest add button card input label select textarea checkbox dialog sheet toast badge separator skeleton dropdown-menu
   ```
3. Confirm `pnpm dev` runs. Push the scaffold to `main`.
4. Create `feat/map` branch, push. Confirm Burkely sees both deploy.
5. Post the framework decision + first deploy URL in Slack.

### Output at 2:30 PM

- Repo scaffolded, framework decision posted, both branches deploy successfully.

---

## Tomorrow

### 8:00–9:00 AM — Component library + scoring

Pair with Drew on the component skeletons. Build the shells; Drew styles them.

| Component | What it needs to do |
|---|---|
| `QuizCard` | Big tappable answer card. Variants: idle / hover / selected. |
| `RoadmapItem` | Title, one-liner, eligibility, time, cost, "why," apply button, checkbox, feedback widget. |
| `ResourceCard` | Title, description, tag pills, match-reason pill, action button, feedback widget. |
| `PersonCard` | Avatar/initials, name, role, org, "Book a call" button. |
| `MatchPill` | Renders "Matched on industry + topic" or similar from `match_reasons` array. |
| `FeedbackWidget` | Thumbs up/down + collapsible "didn't apply because…" text input. POSTs to `/api/feedback`. |
| `CitationPill` | `[res_id]` rendered as a clickable badge → `/resources/:id`. |

Also: pair with Beau on `lib/scoring.ts`. The same scoring function should run on both client (for tests, debugging) and server (for the real API). Export a pure function that takes `(resource, answer)` and returns `(score, match_reasons[])`.

### 9:00–11:00 AM — Build the spine

This is your two-hour core build. Order matters; don't deviate.

1. **Routing** (10 min)
   - Set up React Router with all routes from `UX_FLOWS.md` sitemap.
   - Empty placeholder components for now.

2. **Zustand stores** (15 min)
   - `quizStore` with `persist` middleware → localStorage `usn:quiz`. Fields: `stage`, `established_intent`, `industry`, `topic`. Actions: `setAnswer`, `reset`.
   - `dashboardStore` with `persist` → `usn:checked`. Fields: `checkedItemIds: string[]`. Actions: `toggleItem`.
   - Generate or pull `session_id` from localStorage on first load (use `crypto.randomUUID()`).

3. **Quiz flow** (40 min)
   - Q1 on `/`: 4 stage cards + "Skip" link.
   - Conditional `/quiz/established` if Q1 = Established.
   - `/quiz/industry`: 6 industry cards.
   - `/quiz/need`: 5 topic cards.
   - On Q3 submit: call `POST /api/quiz/score`, navigate to `/dashboard`.
   - Use Framer Motion for slide transitions between questions.
   - "Back" link works correctly (browser history aware).
   - Edit-answers from dashboard pre-fills correctly.

4. **Dashboard** (50 min)
   - Header with "Hi, [stage] [industry] founder" + edit/retake links.
   - Panel 1: render `roadmaps[stage]` with checkbox state from dashboardStore.
   - Panel 2: render scored results from quizStore + API. Inline filters (Topic, Community, Region).
   - Panel 3: render people from `people.json` filtered by quiz match.
   - CTA block: primary always, secondary conditional on `stage !== 'pre-revenue'`.
   - Skeleton loading states while API resolves.

5. **Resources detail** (15 min)
   - `/resources/:id`: fetch single resource, render full info, related sidebar.
   - `/resources` (skip target): list all, filter rail, search.

6. **API integration** (10 min)
   - Replace any mock imports with real client calls to Supabase / Netlify Functions.

### 10:00 AM standup

Force the question: **"Is front-end calling real APIs and rendering real data?"** If no, drop everything else and fix that. The demo doesn't exist if this loop isn't working.

### 11:00–11:50 AM — Profile forms + (optional) Concierge UI

#### Founder profile `/profile`

- 6 fields: name, email, stage (pre-filled), industry (pre-filled), topics (multi-select pre-filled), region (optional).
- react-hook-form + zod validation.
- Submit → POST → redirect to `/dashboard` with toast.

#### Business claim `/claim` (feat/map branch — switch branch for this)

- 11 fields per `MAP_BUILD.md`.
- Multi-section single-page form with grouping headers.
- Photo upload via Supabase Storage.
- Submit → POST → redirect to `/directory/:id`.

#### Concierge UI (only if on schedule)

- Bottom sheet on dashboard, collapsible.
- Single input + send button.
- Display history (user / assistant turns).
- Render citations as `CitationPill` components inline.
- "Fake stream" reveal of response text (15ms per char).
- POST to `/api/concierge` with `quiz_context` and last 6 turns of history.

### 11:50 AM–12:40 PM — Testing

- Walk through all 6 personas yourself. Verify dashboards differ meaningfully.
- Test mobile (375px iPhone SE width) — every route.
- Form validation: try submitting empty, invalid, max-length. Verify error states.
- localStorage clears: open in incognito, do the flow, confirm fresh session works.

### 12:40–1:00 PM — Deploy + rehearsal

- Final commits to both branches.
- Walk the demo with Drew.

---

## Cutlines (when to drop what)

If you're behind:

| Time | Drop in this order |
|---|---|
| Past 10:00 AM with quiz incomplete | Skip the Established sub-question for now, add later |
| Past 10:30 AM with dashboard partial | Skip Panel 2 inline filters; use defaults |
| Past 11:00 AM with profile not started | Cut founder profile to email-only field |
| Past 11:30 AM with claim form not started | Skip photo upload; ship without it |
| Past 11:30 AM with concierge not started | Cut concierge entirely. Mention as Phase 2. |
| Past 12:30 PM with reorderable resources | Cut drag-to-reorder, ship static order |

**Never cut:**
- Quiz Q1/Q2/Q3 + dashboard render with real data
- The Q3 → dashboard transition animation
- At least one stage's roadmap fully populated and matching the demo personas
- Live deploy to production URL

---

## Files you own

```
src/
├── App.tsx
├── main.tsx
├── routes/                    (every screen)
├── components/
│   ├── quiz/
│   ├── dashboard/
│   └── shared/
├── stores/
│   ├── quizStore.ts
│   └── dashboardStore.ts
├── lib/
│   ├── api.ts                 (Supabase wrapper)
│   ├── scoring.ts             (shared with Beau)
│   ├── supabase.ts            (client init)
│   └── mockApi.ts             (fallback if Beau's API isn't ready)
└── types/
    └── index.ts
```

Beau owns: Supabase migrations, server-side API logic, Netlify Functions, seed data.
Drew owns: design tokens, animation choreography, component visual styling, Tailwind config.

---

## Slack pings to expect from you

- Tonight: framework decision + first deploy URL.
- 9:00 AM: "API contract frozen, building against this shape: [link]"
- 10:00 AM: "Front-end connected to real API ✅" or "Blocked on [thing]"
- 11:00 AM: "Spine done, moving to profile forms"
- 12:00 PM: "Branch states: main = [status], feat/map = [status]"
- 12:40 PM: "Final commits in"

---

## When in doubt

- Build what's in `UX_FLOWS.md`. Don't invent.
- Match `API_CONTRACT.md` shapes exactly. Don't drift.
- If something feels too complicated, it probably is. Find the simpler version.
- Burkely is the unblocker. Page him in Slack instead of fighting alone for >10 minutes.
