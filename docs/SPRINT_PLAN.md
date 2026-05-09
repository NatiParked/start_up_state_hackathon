# Sprint Plan

The 6-hour budget. 1 hour tonight + 5 hours tomorrow morning. Judging at 2:00 PM.

---

## Time budget

```
TONIGHT (1:30–2:30 PM):  setup only — 60 min
TOMORROW:
  08:00–09:00  design system + scoring algorithm   (60 min)
  09:00–11:00  parallel front-end / back-end build (120 min)
  11:00–11:50  business profiles + optional chat   (50 min)
  11:50–12:40  testing & bug fixes                 (50 min)
  12:40–01:00  deploy & demo prep                  (20 min)
  01:00–02:00  buffer / rest / final rehearsal     (60 min)
  02:00        JUDGING
```

Total build time: **6 hours.** Buffer included by design — if the build runs hot, the buffer becomes more polish; if the build runs cold, the buffer is debugging insurance.

---

## TONIGHT (1:30–2:30 PM) — the only hour you have today

⚠️ **Critical path.** Do not perfect anything. Do the smallest thing that unblocks tomorrow.

| Owner | Task | Duration | Output |
|---|---|---|---|
| Beau | Parse Resources Sheet → JSON | 15m | `/data/resources.json`, normalized |
| Cayden | Init Supabase project + GitHub repo + scaffold | 20m | Repo cloned, framework chosen, `pnpm dev` runs locally |
| Drew | Sketch 5 key screens | 15m | Pencil/Figma: Landing, Q1, Q2, Q3, Dashboard, Resource detail |
| Burkely | Wire deploy pipeline | 10m | GitHub → Netlify → Supabase env vars verified, push goes live |

**Output at 2:30 PM:**
- Repo up, deploy pipeline live
- Resources JSON exists locally
- Wireframes done
- Cayden has posted the framework decision in Slack (Vite vs Next, pnpm/npm, Node version, TS yes/no)

**Then go home and rest.** Cognitive performance tomorrow > extra 30 minutes of work tonight.

---

## TOMORROW

### Phase 1 — 8:00–9:00 AM: Foundations (60 min)

| Owner | Task | Duration |
|---|---|---|
| Drew + Cayden | Build component library (QuizCard, ResourceCard, RoadmapItem, PersonCard) | 25m |
| Drew | Tailwind config + color tokens + Inter font | 15m |
| Drew | GSAP + Framer setup, define transition patterns | 15m |
| Beau + Cayden | Lock scoring algorithm in code (`lib/scoring.ts`) | 5m |

**Output:** Reusable components, design system locked, scoring code merged.

**Standup at 9:00:** "API contract frozen?" If not, freeze it now. Cayden builds against `lib/mockApi.ts` if Beau is behind.

---

### Phase 2 — 9:00–11:00 AM: Parallel build (120 min)

#### Front-end track (Cayden + Drew)

| Owner | Task | Duration |
|---|---|---|
| Cayden | Quiz flow: Q1 + Established sub-question + Q2 + Q3 with state | 40m |
| Cayden | Dashboard: 3 panels with real data (Roadmap, Resources, People) | 50m |
| Cayden | Resource detail page + browse-all `/resources` | 20m |
| Drew | Landing page + nav + footer + routing | 20m |
| Drew | GSAP polish on Q3 → dashboard transition | 10m |

#### Back-end track (Beau + Cayden integration)

| Owner | Task | Duration |
|---|---|---|
| Beau | Supabase schema (resources, businesses, feedback, concierge_questions) | 15m |
| Beau | Load resources JSON into Supabase | 10m |
| Beau | `/api/quiz/score` endpoint with scoring algorithm | 30m |
| Beau | `/api/resources` (list + detail) + `/api/feedback` | 25m |
| Beau | Seed `roadmaps.json` content for all 5 stage variants | 20m |
| Beau | Seed `people.json` (12 stub entries covering stages × topics) | 10m |
| Cayden | Wire front-end to real API (replace mocks) | 10m |

**Standup at 10:00:** "Are we connected?" Front-end calling real API, real data flowing through real screens. If not, that's the only work for the next hour.

**Output at 11:00:** Quiz → Dashboard → Resources flow complete and working live. Demo backbone ready.

---

### Phase 3 — 11:00–11:50 AM: Profiles + optional Concierge (50 min)

#### Resources branch (`main`)

| Owner | Task | Duration |
|---|---|---|
| Cayden | Founder profile form `/profile` | 20m |
| Cayden | AI Concierge UI (bottom sheet, history, fake stream) | 20m |
| Beau | Concierge Netlify Function + Anthropic integration | 30m |
| Beau | Concierge question logging to Supabase | 10m |

#### Map branch (`feat/map`) — parallel

| Owner | Task | Duration |
|---|---|---|
| Cayden | 11-field claim form `/claim` (react-hook-form + zod) | 25m |
| Cayden | Directory list + filters `/directory` | 20m |
| Cayden | Business profile page `/directory/:id` | 15m |
| Beau | `/api/businesses` POST + GET (list + detail) | 20m |
| Beau | Photo upload to Supabase Storage | 10m |

> **Realistic note:** Cayden cannot do all of the above alone in 50 minutes. Pick. The cutlines (below) decide which.

**Output:** Map directory live on `feat/map`, concierge live on `main` if time allowed.

---

### Phase 4 — 11:50–12:40 PM: Testing (50 min)

All hands. No new features.

| Owner | Task | Duration |
|---|---|---|
| Drew + Cayden | E2E quiz → dashboard test for all 6 personas | 15m |
| Beau + Cayden | Verify scoring accuracy, especially Maria + Priya | 10m |
| Cayden + Beau | Form validation pass (founder profile + business claim) | 10m |
| Drew | Mobile QA at 375px and 414px | 10m |
| All | Critical bug fixes (broken links, console errors, layout breaks) | 5m |

**Output:** Zero blocking bugs. Demo personas verified.

---

### Phase 5 — 12:40–1:00 PM: Deploy & demo prep (20 min)

| Owner | Task | Duration |
|---|---|---|
| Burkely | Final merge to `main`, deploy to production | 3m |
| All | Smoke test live URL (every route, demo personas) | 5m |
| Beau | Seed 3–5 demo businesses on `feat/map` so directory looks alive | 5m |
| Drew + Burkely | Rehearse demo + pitch (2-min walkthrough, Maria → Priya) | 7m |

**Output:** Live URL stable. Demo script tight. Pitch rehearsed.

---

### Buffer (1:00–2:00 PM)

Use it for:
- Final rehearsal pass (3 dry runs of the full demo)
- Last-minute polish on the moment that matters most (Q3 → dashboard reveal)
- Snack and water — your brain needs both
- Reset the demo data so the live demo starts from a clean state

**Do not introduce new features in the buffer.** That's how demos break at 1:55 PM.

---

## Cutlines

If you fall behind, cut in this order. **Stop when you've cut enough to make the next phase's deadline.**

### By 10:00 AM — must-have
- ✅ Quiz flow (Q1 → Q2 → Q3, including Established sub-question)
- ✅ Dashboard with all 3 panels
- ✅ Resource detail pages
- ✅ Live deploy pipeline working

### By 11:00 AM — nice-to-have
- 🟡 Founder profile form (cut to a single email-capture if needed)
- 🟡 Per-card feedback widget (cut entirely if needed; mention as "Phase 2")
- 🟡 Drag-to-reorder on resources panel (cut entirely)
- 🟡 People to Meet panel — keep stub data, never cut the panel itself

### By 11:50 AM — defer
- ⚪ AI Concierge (cut entirely if behind; mention as "Phase 2 — architecture is ready")
- ⚪ Map Phase 2 (Mapbox view)
- ⚪ Stage graduation reveal animation
- ⚪ Filter dropdowns inside dashboard panels (filters on `/resources` are enough)

### Never cut
- ❌ Quiz → Dashboard core flow
- ❌ Live deploy
- ❌ The Q3 → Dashboard transition animation (this is the demo's heart)
- ❌ At least one stage's roadmap fully populated (the one you're demoing)

---

## Risk register

| Risk | Trigger | Mitigation |
|---|---|---|
| Sheet parse takes >15m | Sheet is messy | Beau falls back to manual cleanup → JSON. Don't perfect the parser. |
| Supabase auth fails tomorrow morning | Service issue or misconfig | Cayden has `mockApi.ts` as fallback. Demo still works against in-memory data. |
| Front-end and back-end out of sync | API contract drifts | API contract is frozen at 9:00 AM. Cayden builds against the doc, not against Beau's implementation. |
| Concierge eats time with no payoff | Anthropic API issue, prompt tuning rabbit hole | Hard stop at 11:50 AM. Drop entirely if not working by then. The dashboard is the demo, not the chatbot. |
| Scope creep ("just one more feature") | Adrenaline, judges' expectations in head | Enforce cutlines verbally at every phase boundary. Burkely has the authority to say no. |
| Critical bug found at 12:30 | Inevitable in any 6-hour build | Triage: fix only if <10 min. Otherwise demo around it. *"We're aware of this edge case, will fix in v1.1."* |
| Demo persona reveals weak match | Algorithm produces irrelevant results for Maria or Priya | Hand-tune their results in seed data if needed. The brief judges UX and personalization, not the score function's purity. |

---

## Communication

- **Slack channel:** all blockers, all decisions, all updates. No Discord, no DMs that fork the conversation.
- **Standup beats:** 9:00, 10:00, 11:00, 11:50, 12:40. Each is 60 seconds: status / blocker / next step.
- **Burkely is the unblocker.** If you can't make a decision yourself, escalate to Burkely. Don't wait.

---

## Definition of done (for judging at 2:00 PM)

A judge clicks the live URL and:
1. Lands on a clean Q1 page in <2 seconds
2. Answers 3 questions in under 60 seconds
3. Sees a personalized dashboard differentiated by their answers
4. Can complete a roadmap item, browse resources, see people to meet
5. Can browse the directory at `/directory` and see real businesses
6. Can claim a profile at `/claim` and see it appear in the directory
7. Encounters zero broken links, zero console errors, zero crashes

If all 7 are true at 2:00 PM, we've shipped what we promised.
