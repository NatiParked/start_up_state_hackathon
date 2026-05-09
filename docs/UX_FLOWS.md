# UX Flows

Every screen, every state. If you're not sure what to build, this is the answer.

---

## Sitemap

```
/                          Landing = Quiz Q1 (with "Skip" link)
  ├── /quiz/established    (conditional — only if Q1 = Established)
  ├── /quiz/industry       Q2
  └── /quiz/need           Q3 → submit → /dashboard

/dashboard                 3-panel personalized dashboard

/resources                 Browse all (skip target, filterable)
  └── /resources/:id       Resource detail

/profile                   Universal CTA — create founder profile
/claim                     Conditional CTA — claim business profile (feat/map)

/directory                 (feat/map) Business directory
  └── /directory/:id       Public business profile
```

---

## Flow 1: Quiz → Dashboard (the primary path)

```
┌──────────────────────────────────────────────────────────────────┐
│  /                                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Hero: "Find what Utah has for you. 60 seconds."           │  │
│  │                                                            │  │
│  │  Q1: What stage is your company?                           │  │
│  │   ○ Pre-revenue                                            │  │
│  │   ○ Early revenue                                          │  │
│  │   ○ Scaling                                                │  │
│  │   ○ Established                                            │  │
│  │                                                            │  │
│  │  ↳ Skip questions, show me all resources                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                            │
       ┌────────────────────┼─────────────────┐
       │                    │                 │
       ▼                    ▼                 ▼
   Established         Pre/Early/Scaling    Skip
       │                    │                 │
       ▼                    ▼                 ▼
┌───────────────┐    ┌──────────────┐   ┌─────────────┐
│ /quiz/        │    │ /quiz/       │   │ /resources  │
│  established  │    │  industry    │   │ (browse all)│
│               │    │              │   └─────────────┘
│ ○ Utah-based  │    └──────┬───────┘
│ ○ Relocating  │           │
└───────┬───────┘           │
        │                   │
        └────────┬──────────┘
                 │
                 ▼
         ┌──────────────┐
         │ /quiz/       │
         │  industry    │
         │              │
         │ ○ Software/IT│
         │ ○ Healthcare │
         │ ○ Manufact.  │
         │ ○ Agriculture│
         │ ○ Hosp/Food  │
         │ ○ Other      │
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │ /quiz/need   │
         │              │
         │ ○ Funding    │
         │ ○ Talent     │
         │ ○ Community  │
         │ ○ Legal/Comp.│
         │ ○ Marketing  │
         └──────┬───────┘
                ▼ (submit → POST /api/quiz/score)
         ┌──────────────┐
         │ /dashboard   │
         └──────────────┘
```

### Quiz state

- All answers stored in Zustand `quizStore` with `persist` middleware → localStorage key `usn:quiz`.
- Going back/forward in browser preserves answers; refreshing preserves answers.
- "Edit answers" link on dashboard takes user back to `/` with answers pre-filled.

### Quiz UI rules

- One question per screen. Big, scannable buttons. Not radio inputs — full-width clickable cards.
- Progress indicator (1 of 3, 2 of 3, 3 of 3) — top of viewport. Established sub-question is part of step 1, doesn't increment.
- "Back" link in top-left, "Skip questions" link only on Q1.
- On Q3 submit: GSAP scene transition (full-viewport fade + scale) → dashboard reveal. This is the cinematic moment — Drew owns the choreography.

---

## Flow 2: Dashboard (the destination)

```
┌────────────────────────────────────────────────────────────────────┐
│  /dashboard                                                        │
│                                                                    │
│  Header                                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "Hi, [stage] [industry] founder."                           │  │
│  │  [Edit answers]  [Re-take quiz]                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Panel 1: Do This Now (3 hand-curated items for stage)             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ☐  [1] Validate the idea                                    │  │
│  │      Lassonde Founder Friday — free weekly office hours      │  │
│  │      Eligibility: Anyone | Time: 1 hour | Cost: Free         │  │
│  │      Why this: "First-time founders gain the most from       │  │
│  │      structured peer feedback before building."              │  │
│  │      [Apply →]                                               │  │
│  │      👍 👎 [didn't apply because…]                           │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  ☐  [2] Take the Business Idea Challenge                     │  │
│  │      ...                                                     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  ☐  [3] Draft a one-page business plan                       │  │
│  │      ...                                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Panel 2: Your Relevant Resources (top 15, scored, reorderable)    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Filter: [Topic ▼] [Community ▼] [Region ▼]                  │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Pelion Venture Partners                          [score 240]│  │
│  │  Series A+ B2B SaaS investor based in Salt Lake City.        │  │
│  │  Industry · Topic · Location                                 │  │
│  │  [Learn more →]   👍 👎                                      │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  ... (14 more)                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Panel 3: People to Meet This Month                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [photo]  Sarah K. — SBDC Counselor, Salt Lake Region        │  │
│  │           Salt Lake SBDC                                     │  │
│  │           [Book a call →]                                    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  [photo]  Marcus L. — Sector Lead, Manufacturing             │  │
│  │           ...                                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  CTA Block                                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Primary]  Create your founder profile →                    │  │
│  │  [Secondary, conditional]  Claim your business on the map →  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  AI Concierge (pinned bottom)                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Ask the State                                               │  │
│  │  [____________________________________]  [Send]              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Panel rules

#### Panel 1 — Do This Now
- Always exactly 3 items. Pulled from `roadmaps.json` keyed on `stage` (with `established-utah` and `established-relocating` as separate keys).
- Each card: title, one-liner, eligibility, time-to-apply, est. cost, "why this is on your dashboard" microcopy, primary action button.
- Checkbox marks complete → strikethrough + grays. Stored in Zustand `dashboardStore` → localStorage key `usn:checked`.
- When all 3 checked → reveal "You're ready for [next stage] →" banner with re-quiz CTA.
- Per-card thumbs + "didn't apply because" inline. Posts to `/api/feedback`.

#### Panel 2 — Your Relevant Resources
- Top 15 from `/api/quiz/score`, sorted by score DESC, alpha tiebreaker.
- Each card: title, one-liner description, 3 small tag pills (industry / topic / location), "match reasons" pill (e.g. "Matched on industry + topic"), action button.
- Inline filter dropdowns at top of panel: Topic, Community, Region. Filtering is client-side (the 15 are already loaded).
- Reorder via drag handle (lucide `GripVertical`) — saves order to localStorage so return visits respect their preference. Nice-to-have; ship behind a flag if time pressed.
- Per-card thumbs + reason text. Posts to `/api/feedback`.

#### Panel 3 — People to Meet This Month
- 3 people, matched against quiz answers (see `DATA_MODEL.md` "People" section).
- Each card: photo (or initials avatar fallback), name, role, org, "Book a call" → opens calendar link in new tab.
- Stub data is fine for v1. The point is the panel exists and is wired correctly.

#### CTA block
- **Primary CTA (always shown):** "Create your founder profile →" → `/profile`
- **Secondary CTA (conditional):** Shown only if `stage !== 'pre-revenue'`. Pre-revenue founders by definition don't have a business yet.
  - Label: "Claim your business on the Utah Startup Map →" → `/claim`

#### AI Concierge
- Pinned to viewport bottom (sticky), collapsible.
- Single input + send button. No streaming for v1.
- Responses render below with citation pills that link to `/resources/:id`.
- See `AI_CONCIERGE.md` for system prompt and grounding behavior.

---

## Flow 3: Browse all resources (skip target)

`/resources`

- Same card design as Panel 2.
- All ~100 resources, default sort alpha.
- Filter rail (left on desktop, top sheet on mobile): Industry, Topic, Community, Location, free-text search.
- Click card → `/resources/:id` for detail view.

`/resources/:id`

- Hero with title + tags
- Full description
- Eligibility, deadline, cost, contact
- Primary CTA: external apply link
- "Back to dashboard" if user came from there, else "Back to all resources"
- Sidebar (desktop) / footer (mobile): "Related resources" — 3 more from same industry or topic

---

## Flow 4: Create founder profile

`/profile`

Lightweight. Captures:
- Name (required)
- Email (required)
- Stage (pre-filled from quiz)
- Industry (pre-filled from quiz)
- Topics of interest (multi-select, pre-filled from quiz)
- Optional: phone, region

Submission stores anonymously linked to the existing `session_id` (no auth flow, no password). Returns to dashboard with a "We'll send you new matches as they're added" confirmation toast.

> **Storage decision:** for v1, store in a `founder_profiles` Supabase table keyed on `session_id`. No verification. Phase 2 = magic link verification. This is sufficient to demo "create profile" capability without dragging auth into the build.

---

## Flow 5: Claim business profile (feat/map)

`/claim`

The 11-field form. See `MAP_BUILD.md` for full UX spec.

---

## Flow 6: Browse the directory (feat/map)

`/directory`

See `MAP_BUILD.md`.

---

## State diagram

```
                  ┌─────────────────────────┐
                  │   FRESH SESSION         │
                  │   (no quiz data)        │
                  └────────────┬────────────┘
                               │ user lands on /
                               ▼
                  ┌─────────────────────────┐
                  │   QUIZ IN PROGRESS      │
                  │   quizStore: partial    │
                  └────────────┬────────────┘
                               │ Q3 submit
                               ▼
                  ┌─────────────────────────┐
                  │   DASHBOARD READY       │
                  │   quizStore: complete   │
                  │   /api/quiz/score: 200  │
                  └─────┬─────────────────┬─┘
                        │                 │
                        │ check items     │ ask concierge
                        │                 │
                        ▼                 ▼
              ┌───────────────────┐  ┌─────────────────────┐
              │  ROADMAP PROGRESS │  │  CONCIERGE ACTIVE   │
              │  checked: 1..3/3  │  │  history: [...]     │
              └─────────┬─────────┘  └─────────────────────┘
                        │ all 3 checked
                        ▼
              ┌───────────────────────────┐
              │  STAGE GRADUATION         │
              │  prompt re-quiz at next   │
              │  stage                    │
              └───────────────────────────┘
```

---

## Empty / error / loading states

| State | Treatment |
|---|---|
| Quiz score API returns 0 results | Show "We didn't find perfect matches. Browse all 100 resources →" with link to `/resources` |
| Quiz score API errors | Toast "Trouble loading recommendations" + auto-redirect to `/resources` after 5s |
| Concierge API errors | Inline message: "I'm having trouble. Try the search at /resources." |
| Concierge rate limited | Inline message: "Take a breath, we're here all day." |
| Dashboard loading | Skeleton cards (3 in each panel) with subtle pulse — Framer `motion.div` with opacity oscillation |
| Resource detail 404 | Friendly empty state, "Back to all resources" link |
| Map directory loading | Skeleton list of business cards |

---

## Mobile considerations

- Quiz: full-width cards, large tap targets (min 56px height).
- Dashboard: panels stack vertically. Each panel is collapsible (default: Panel 1 open, others collapsed).
- Concierge: bottom sheet that pulls up; auto-collapses after answer.
- Filters in `/resources`: bottom sheet trigger button.
- Drew owns mobile QA in Phase 5. Test at 375px (iPhone SE) and 414px (iPhone 14+).

---

## Animation moments (Drew owns)

| Moment | Tool | What |
|---|---|---|
| Q1 → Q2 / Q2 → Q3 | Framer | Slide left (200ms ease-out) |
| Q3 submit → Dashboard | GSAP | Cinematic fade-up: full viewport overlays with stage label, then panels stagger in (300ms gaps) |
| Roadmap checkbox | Framer | Strike-through animation + opacity dim |
| Stage graduation (all 3 checked) | GSAP | Confetti or subtle gradient sweep + banner reveal |
| Concierge response | Framer | Token-by-token reveal (fake stream) — even without real streaming, this *feels* live |
| Dashboard reveal of new content on filter change | Framer | LayoutGroup with smooth reflow |

Don't over-animate. Every motion should serve clarity, not decoration. Linear-clean = restraint.
