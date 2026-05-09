# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Founder's Navigator** — a quiz-driven tool that matches Utah founders to state startup resources from startup.utah.gov. The user answers 4 questions (stage, industry, goal, region), and the app scores all resources and returns the top matches.

## Data

`tagged_resources.json` is the single source of truth for all resources. Each resource has:
- `id`, `name`, `summary`, `eligibility`, `url`, `email`
- `tags.stage`: `idea` | `early_stage` | `growth` | `any`
- `tags.industry`: `tech_software` | `life_sciences` | `agriculture_food` | `consumer_brands` | `manufacturing` | `hospitality_tourism` | `arts_media` | `aerospace_defense` | `general`
- `tags.goal`: `raise_capital` | `start_business` | `validate_idea` | `hire_workforce` | `grow_sales_marketing` | `network_community` | `find_workspace` | `government_contracting` | `export_internationally` | `relocate_to_utah`
- `tags.resource_type`: `grant_program` | `vc_fund` | `angel_group` | `microloan_cdfi` | `incubator_accelerator` | `coworking_space` | `makerspace` | `training_education` | `university_center` | `government_program` | `industry_association` | `chamber_econ_dev` | `event`
- `tags.region`: `statewide` | `salt_lake_metro` | `silicon_slopes` | `northern_utah` | `park_city_heber` | `southern_utah` | `central_utah` | `eastern_utah` | `uinta_basin`

To update resources: edit `tagged_resources.json` directly or re-run the Python script that generated it.

## Scoring Algorithm

See `quiz_scoring_algorithm.html` for the full spec. Summary:

| Signal | Points |
|---|---|
| Industry exact match | +100 |
| Goal match (per goal, multi-select allowed) | +80 each |
| Stage match (`any` matches all) | +40 |
| Region match (`statewide` matches all) | +20 |
| Diversity resource type bonus | +5 |

Return top 15 results sorted by score DESC, alpha by name on ties. Skip logic: null answers simply skip that signal (no penalty).

## Tech Stack (decided)

**React + Vite, plain CSS, deploy to Vercel or Netlify.**
- No backend — `tagged_resources.json` imported as a JS module at build time
- No router library — `App.jsx` owns a single `view` state (`'landing' | 'quiz' | 'results'`)
- No CSS framework — plain CSS custom properties
- See `PLAN.md` for full file structure and `TASKS.md` for build progress

## Quiz Questions

1. **Stage** — 3 options only: Idea / Early Stage / Scaling (`any` is a resource attribute, not a user answer — no "Established" option)
2. **Industry** — 9 options mapped to tag values above
3. **Goal** — multi-select up to 2, 9 options mapped to tag values above
4. **Region** — dropdown of 9 Utah regions

Each question has a Skip button (null answer, no scoring penalty).

## Key Implementation Decisions

- **Filter out `needs_review: true` resources** in `scoring.js` before scoring
- **`quiz_scoring_algorithm.html` uses an older schema** (pipe-delimited `Industries`, `Topics`, `Communities` fields) — ignore those field names, use the actual JSON `tags` object
- **Diversity bonus (+5)** applies to `grant_program` and `microloan_cdfi` resource types (JSON has no explicit diversity community field like the old spec)
- **Goal multi-select:** `answers.goal` is an array passed directly into scoring loop

## Results Page

- 5 results per page, paginated
- Filter chips show only `resource_type` values present in the top-15 results (no dead chips)
- Each card: name (link), resource_type badge(s), summary (~120 chars expandable), eligibility, email if present, score
- "Retake Quiz" resets all App state back to Landing
