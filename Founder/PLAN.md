# Founder's Navigator — Implementation Plan

## What We're Building
A 4-question quiz that scores Utah startup resources against a founder's answers and returns a ranked, filterable list of the most relevant programs, grants, and communities.

**Goal:** Landing to results in under 2 minutes. No login. No backend.

---

## Tech Stack
- **React + Vite** — static build, instant dev server, zero server required
- **Plain CSS** — CSS custom properties, mobile-first, no framework overhead
- **Deploy:** Vercel or Netlify — drag `dist/` folder or `git push`
- **Data:** `tagged_resources.json` imported at build time — edit file = content updated

---

## Quiz Flow
1. **Stage** — Idea / Early Stage / Scaling *(3 options, no "Established" — `any` is a resource attribute)*
2. **Industry** — 9 options mapped to tag values
3. **Goal** — multi-select up to 2, 9 options
4. **Region** — dropdown of 9 Utah regions

Each step has a **Skip** button (null answer = skip that signal, no penalty).

---

## Scoring Algorithm (`src/lib/scoring.js`)

| Signal | Points |
|---|---|
| Industry exact match (`tags.industry`) | +100 |
| Goal match, per goal (`tags.goal`) | +80 each (max +160) |
| Stage match (`tags.stage`, `any` matches all) | +40 |
| Region match (`tags.region`, `statewide` matches all) | +20 |
| Diversity bonus (`grant_program` or `microloan_cdfi`) | +5 |

- Filter out `needs_review: true` resources before scoring
- Return top 15, sorted score DESC, name ASC on ties
- If all answers skipped → return top 15 alphabetically

---

## File Structure
```
founder-navigator/
├── public/
│   └── favicon.ico
├── src/
│   ├── data/
│   │   └── tagged_resources.json       ← source of truth, the CMS
│   ├── lib/
│   │   └── scoring.js                  ← pure function, no React
│   ├── components/
│   │   ├── QuizStep.jsx                ← reusable question card (used 4x)
│   │   ├── ProgressBar.jsx             ← 3-dot / 4-dot step indicator
│   │   ├── ResultCard.jsx              ← single resource card
│   │   ├── FilterChips.jsx             ← resource_type toggle chips
│   │   └── Pagination.jsx              ← prev/next, X of Y
│   ├── pages/
│   │   ├── Landing.jsx                 ← hero + "Find My Resources" CTA
│   │   ├── Quiz.jsx                    ← step state machine, calls scoring on finish
│   │   └── Results.jsx                 ← filter + pagination derived state
│   ├── styles/
│   │   └── main.css                    ← all styles, CSS variables
│   ├── App.jsx                         ← view: 'landing' | 'quiz' | 'results'
│   └── main.jsx
├── index.html
├── vite.config.js
└── package.json
```

---

## State Design

### App-level (`App.jsx`)
```js
view: 'landing' | 'quiz' | 'results'
quizAnswers: { stage, industry, goal[], region }
scoredResults: Resource[]
```

### Quiz-local (`Quiz.jsx`)
```js
step: 0–3
answers: { stage: null, industry: null, goal: [], region: null }
```

### Results-local (`Results.jsx`)
```js
activeFilters: Set<string>   // resource_type chips
page: number                 // current page, reset on filter change
```

---

## Results Page
- **5 cards per page**, paginated
- Filter chips show only `resource_type` values present in top-15 (no dead chips)
- Each card: name (link), resource_type badge(s), summary (~120 chars, expandable), eligibility, email if present, score (shows confidence, good for demo)
- "Retake Quiz" resets all App state → Landing

---

## Tag → UI Label Mapping

### Stage
| Tag | Label |
|---|---|
| `idea` | Just an idea |
| `early_stage` | Early stage |
| `growth` | Scaling |

### Industry
| Tag | Label |
|---|---|
| `tech_software` | Software / Tech |
| `life_sciences` | Healthcare / Life Sciences |
| `agriculture_food` | Agriculture & Food |
| `consumer_brands` | Consumer Goods & Retail |
| `manufacturing` | Manufacturing |
| `hospitality_tourism` | Hospitality & Tourism |
| `arts_media` | Arts & Media |
| `aerospace_defense` | Aerospace & Defense |
| `general` | Other |

### Goal
| Tag | Label |
|---|---|
| `raise_capital` | Raise funding |
| `start_business` | Start my business |
| `validate_idea` | Validate my idea |
| `hire_workforce` | Hire & build a team |
| `grow_sales_marketing` | Grow sales & marketing |
| `network_community` | Find community & mentors |
| `find_workspace` | Find a workspace |
| `government_contracting` | Government contracting |
| `export_internationally` | Export internationally |

### Region
| Tag | Label |
|---|---|
| `salt_lake_metro` | Salt Lake Metro |
| `silicon_slopes` | Silicon Slopes (Lehi/Provo) |
| `northern_utah` | Northern Utah (Ogden/Logan) |
| `park_city_heber` | Park City / Heber |
| `southern_utah` | Southern Utah (St. George) |
| `central_utah` | Central Utah |
| `eastern_utah` | Eastern Utah |
| `uinta_basin` | Uinta Basin |

---

## Build Order

### Phase 1 — Data & Scoring (30 min)
1. Scaffold Vite + React project
2. Copy `tagged_resources.json` into `src/data/`
3. Write `scoring.js` — verify in console before any UI

### Phase 2 — Quiz UI (45 min)
4. `main.css` — variables, base styles, button styles, mobile-first grid
5. `QuizStep.jsx` — the core component, single + multi-select modes
6. `ProgressBar.jsx`
7. `Quiz.jsx` — step state machine, skip logic
8. `Landing.jsx`
9. Wire `App.jsx` navigation

### Phase 3 — Results (45 min)
10. `ResultCard.jsx`
11. `FilterChips.jsx`
12. `Pagination.jsx`
13. `Results.jsx` — derived state, no useEffect needed

### Phase 4 — Polish (20 min)
14. Mobile responsive pass (375px breakpoint)
15. CSS transitions between quiz steps
16. Retake quiz reset flow
17. Meta title, OG image if time

**Total: ~2.5 hours to demo-ready**

---

## Deploy
```bash
npm run build
# drag dist/ to netlify.com/drop  OR
npx vercel
```
