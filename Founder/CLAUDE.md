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

## Quiz Questions

1. **Stage** — Idea / Early Stage / Growing / Not sure
2. **Industry** — 9 options mapped to tag values above
3. **Goal** — multi-select up to 2, 9 options mapped to tag values above
4. **Region** — dropdown of 9 Utah regions

## Results Page

Show: name, summary, tags (resource_type), link. Paginated. Filter chips by `resource_type` after results load.
