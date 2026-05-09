# Utah GOED Hackathon — Shared Project Context

## Hackathon Overview

- **Event**: Utah GOED AI Builder Day Hackathon
- **Prize**: $10,000 cash + potential live deployment on startup.utah.gov (visible to international investors)
- **Timeline**: 2-day hackathon
- **Goal**: Build tools to help founders discover Utah's startup ecosystem resources

## Two Products (Same Repo)

Both products live in the same Vue 3 app (`goed/`) with shared infrastructure:

1. **Founder's Navigator** — AI-powered resource discovery tool (build first)
2. **Utah Startup Map** — Interactive map of Utah startups (build second)

## Stack Decisions (Locked)

| Technology | Role |
|------------|------|
| Vue 3.5 | Frontend framework |
| Vue Router 5 | Client-side routing |
| Pinia | State management |
| Vite 8 | Build tool |
| Supabase | Database, Edge Functions, pgvector, auth |
| Netlify | Hosting/deploy |
| OpenLayers (vue3-openlayers) | Map rendering (Map product only) |
| GSAP | Animations |
| Tailwind CSS | Styling (to be added) |

## Repo Structure

```
start_up_state_hackathon/
├── goed/                    ← Vue 3 app (the actual product)
│   ├── src/
│   │   ├── App.vue          ← Currently bare scaffold ("You did it!")
│   │   └── main.js
│   ├── package.json         ← Vue 3.5, Vue Router 5, Pinia, Vite 8 installed
│   └── vite.config.js
├── PROJECT_CONTEXT.md       ← This file
├── FOUNDERS_NAVIGATOR.md
└── STARTUP_MAP.md
```

**Still needs to be installed**: Tailwind CSS, Supabase client, GSAP, vue3-openlayers (Map only)

## App Routing

Three routes planned:
- `/` — Landing page (minimal portal, two animated cards)
- `/navigator` — Founder's Navigator
- `/map` — Utah Startup Map

## Landing Page

**Design**: Minimal portal — Utah brand, two animated product cards with GSAP entrance. Clean, fast to build, strong first impression for judges.

**Color palette**: Utah blue `#0065A4` + white (matches startup.utah.gov brand)

## Judging Criteria

| Weight | Criterion |
|--------|-----------|
| 30% | Usability & real-world applicability |
| 25% | Technical execution and scalability |
| 25% | Design and investor-presentation quality |
| 20% | Innovation and creativity |

> **Key note**: "A complete, polished build of one product scores higher than two rushed ones."

## 6 Test Personas

| Name | Age | Location | Stage | Key Need |
|------|-----|----------|-------|----------|
| Jordan | 20 | Salt Lake City | Pre-seed ideation | First steps guidance |
| Maria | 38 | Washington County | Rural, woman-owned agriculture | Scaling support |
| Marcus | 34 | Ogden | Military veteran, custom fabrication | Veteran early-stage resources |
| Priya | 31 | Salt Lake City | B2B SaaS, 18mo, paying customers | Angel/VC connections |
| David | 45 | Provo | Medical device, 12 employees, FDA cleared | International expansion |
| Dr. Amir | 29 | Salt Lake City | PhD, novel technology | Research commercialization |

## Reference Links

- Challenge brief: https://startupstate.netlify.app/
- Reference map: https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN
- Live platform: https://startup.utah.gov/
- Resources sheet: https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing
- Map data sheet: https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing

## Supabase Architecture (Shared)

- **pgvector extension** enabled for semantic search (Navigator)
- **PostGIS or lat/lng columns** for geospatial data (Map)
- **Edge Functions** for AI calls (Claude) and geocoding
- **Table editor** as the content management interface for GOED non-technical staff
- **Auto-embeddings** triggered on resource row updates (keeps semantic search fresh without redeployment)
