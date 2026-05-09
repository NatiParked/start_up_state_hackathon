# Architecture

How the system fits together.

---

## Stack

> **⚠️ Cayden owns the framework decision** (Vite vs Next, package manager, Node version, TypeScript). This doc reflects the recommended stack. Update once Cayden confirms in Slack.

### Recommended (pending Cayden's confirmation)

| Layer | Pick | Why |
|---|---|---|
| **Build tool / framework** | Vite 5 + React 18 + React Router v6 | Fastest cold start, no SSR complexity to debug at midnight, judges see the deployed bundle anyway. Next's wins (RSC, API routes) are not needed — Supabase handles the API layer. |
| **Language** | TypeScript | The 11-field business form, scoring API, and Anthropic integration all benefit. Catches bugs we don't have time to find at runtime. |
| **Package manager** | pnpm | 2–3× faster installs than npm. Saves real time across 4 people across 6 hours. |
| **Node** | 20 LTS (20.18+) | Vite 5 + Supabase JS happy path |
| **Styling** | Tailwind CSS v3 + shadcn/ui | Production polish out of the box. shadcn = copy-paste components, no runtime dep, accessible. |
| **State** | Zustand + `persist` middleware (localStorage) | Quiz answers + dashboard checkbox state need cross-route persistence. Zustand `persist` = 10 lines. |
| **Forms** | react-hook-form + zod | The 11-field business profile form demands validation. Hand-rolled = guaranteed bugs. |
| **Animation** | GSAP for cinematic moments + Framer Motion for component transitions | They coexist fine. GSAP for the quiz → dashboard reveal; Framer for hover/enter/exit. |
| **Icons** | lucide-react | Comes with shadcn. No separate decision. |
| **API client** | Supabase JS SDK + thin `lib/api.ts` wrapper | Don't introduce TanStack Query in 6 hours. Plain async functions. |
| **Hosting** | Netlify (auto-deploy from GitHub) | Burkely owns the pipeline. |
| **Database** | Supabase (Postgres + auto REST API) | Free tier, instant API, easy schema changes. |
| **AI** | Anthropic Claude (Sonnet 4.x) via Netlify Function proxy | Keeps the API key off the browser. See `AI_CONCIERGE.md`. |
| **Maps (Phase 2 only)** | Mapbox GL JS | Same library the pampam reference uses. Free tier sufficient for the demo. |

---

## System diagram

```
                  ┌──────────────────────────────────┐
                  │       Browser (React SPA)        │
                  │                                  │
                  │  /  /quiz/*  /dashboard          │
                  │  /resources  /resources/:id      │
                  │  /profile    /claim              │
                  │  /directory  /directory/:id      │
                  │                                  │
                  │  Zustand store + localStorage    │
                  └──────┬─────────────────────┬─────┘
                         │                     │
              Supabase JS SDK            fetch /api/concierge
                         │                     │
                         ▼                     ▼
              ┌──────────────────┐   ┌──────────────────────┐
              │     Supabase     │   │   Netlify Function   │
              │   (Postgres)     │   │  /api/concierge      │
              │                  │   │                      │
              │  resources       │   │  Anthropic SDK call  │
              │  businesses      │   │  + question logging  │
              │  feedback        │   └──────────┬───────────┘
              │  concierge_      │              │
              │    questions     │              ▼
              └──────────────────┘   ┌──────────────────────┐
                                     │   Anthropic API      │
                                     │   (Claude Sonnet)    │
                                     └──────────────────────┘
```

---

## Branching strategy

| Branch | Scope | Owner |
|---|---|---|
| `main` | Founder Resources (Quiz → Dashboard → Resources → Concierge) | Cayden + Beau |
| `feat/map` | Utah Startup Map (Directory → Profile → Claim → Phase 2 Mapbox) | Cayden + Beau, side-by-side |

We do **not** merge `feat/map` into `main` until both sides are stable. Both branches deploy to separate Netlify previews. Final merge happens at the polish phase if and only if both are green.

---

## Deployment

| Trigger | Outcome | Owner |
|---|---|---|
| Push to `main` | Auto-deploy → production URL | Burkely (monitors) |
| Push to `feat/map` | Auto-deploy → preview URL | Burkely (monitors) |
| PR opened | Auto-deploy → PR preview URL | Netlify default |

**Production URL:** assigned by Netlify on first deploy. Add to Slack pinned message.

**Rollback:** Netlify dashboard → Deploys → "Publish deploy" on previous version. Burkely has the dashboard pinned.

---

## Environment variables

`.env.example` lives in repo root. Real values in Netlify project settings + each dev's `.env.local`.

```bash
# Supabase (public — safe in client bundle)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Anthropic (server-only — never prefixed with VITE_)
ANTHROPIC_API_KEY=

# Mapbox (Phase 2, public token)
VITE_MAPBOX_TOKEN=
```

**Critical:** the Anthropic key MUST NOT be prefixed `VITE_`. It's only readable by the Netlify Function. Burkely verifies this on first deploy.

---

## Folder structure (proposed — Cayden may adjust)

```
/
├── docs/                       (this folder)
├── public/                     (static assets, favicon)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── index.tsx           (Q1 + skip link)
│   │   ├── quiz/
│   │   │   ├── established.tsx (conditional sub-question)
│   │   │   ├── industry.tsx    (Q2)
│   │   │   └── need.tsx        (Q3)
│   │   ├── dashboard.tsx
│   │   ├── resources/
│   │   │   ├── index.tsx       (browse all)
│   │   │   └── [id].tsx
│   │   ├── profile.tsx         (founder profile create)
│   │   ├── claim.tsx           (business profile create — feat/map)
│   │   └── directory/          (feat/map)
│   │       ├── index.tsx
│   │       └── [id].tsx
│   ├── components/
│   │   ├── ui/                 (shadcn primitives)
│   │   ├── quiz/
│   │   ├── dashboard/
│   │   │   ├── DoThisNowPanel.tsx
│   │   │   ├── YourRelevantResourcesPanel.tsx
│   │   │   ├── PeopleToMeetPanel.tsx
│   │   │   └── ConciergeChat.tsx
│   │   └── shared/
│   ├── lib/
│   │   ├── api.ts              (Supabase wrapper)
│   │   ├── scoring.ts          (Beau's algorithm — front-end mirror for tests)
│   │   ├── roadmaps.ts         (hand-curated stage roadmaps)
│   │   └── supabase.ts         (client init)
│   ├── stores/
│   │   ├── quizStore.ts        (Zustand + persist)
│   │   └── dashboardStore.ts   (checkbox state)
│   ├── types/
│   │   └── index.ts            (Resource, Business, QuizAnswer, etc.)
│   └── styles/
│       └── globals.css
├── supabase/
│   ├── migrations/
│   │   ├── 001_resources.sql
│   │   ├── 002_businesses.sql
│   │   ├── 003_feedback.sql
│   │   └── 004_concierge_questions.sql
│   └── seed/
│       ├── resources.json
│       └── roadmaps.json
├── netlify/
│   └── functions/
│       └── concierge.ts        (Anthropic proxy)
├── netlify.toml
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Performance budget

| Metric | Target |
|---|---|
| Time to interactive on landing | <2s on 3G Fast |
| Quiz Q1 → Q2 transition | <300ms perceived |
| Dashboard render after Q3 submit | <1.5s including API call |
| Concierge first response | <4s (single-shot, no streaming for v1) |

These aren't lighthouse trophies — they're felt latency. Drew's animations should bridge any gap that exceeds the perceived target.
