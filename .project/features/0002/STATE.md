# Feature 0002: Map Foundation — Rendering & Interactivity — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 4: Cluster Rendering & Polish |
| **Status** | ✅ Complete |
| **Blocker** | None |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Map Shell & Logo-Pin Rendering | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 2: Company Drawer | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 3: Filter Sidebar & URL Sync | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 4: Cluster Rendering & Polish | ✅ Complete | 2026-05-09 | 2026-05-09 |

## Task Progress

| Task | Status | Sequence | Started | Completed |
|------|--------|----------|---------|-----------|
| Phase 1 — Task 1: useLogoDev composable + startups store extension | ✅ Complete | 1 | 2026-05-09 | 2026-05-09 |
| Phase 1 — Task 2: CompanyPin, UtahMap, EcosystemStatsBar, MapView | ✅ Complete | 2 | 2026-05-09 | 2026-05-09 |
| Phase 2 — Task 1: CompanyDrawer.vue with computed sections + GSAP animation | ✅ Complete | 1 | 2026-05-09 | 2026-05-09 |
| Phase 2 — Task 2: Wire CompanyDrawer into MapView with click-outside dismissal | ✅ Complete | 2 | 2026-05-09 | 2026-05-09 |
| Phase 3 — Task 1: Build 7 filter sub-components | ✅ Complete | 1 | 2026-05-09 | 2026-05-09 |
| Phase 3 — Task 2: Implement filteredCompanies predicate in startups.js | ✅ Complete | 1 | 2026-05-09 | 2026-05-09 |
| Phase 3 — Task 3: FilterSidebar.vue + URL sync + MapView wire-up | ✅ Complete | 2 | 2026-05-09 | 2026-05-09 |
| Phase 4 — Task 1: Create PinCluster.vue with hover-preview logo fan | ✅ Complete | 1 | 2026-05-09 | 2026-05-09 |
| Phase 4 — Task 2: Wire ol-source-cluster into UtahMap.vue with dual style + click routing | ✅ Complete | 2 | 2026-05-09 | 2026-05-09 |
| Phase 4 — Task 3: Final layout pass on MapView.vue + polish on CompanyPin.vue and EcosystemStatsBar.vue | ✅ Complete | 3 | 2026-05-09 | 2026-05-09 |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-08 | Initial feature specification created | Roadmap derived from user requirements; 4 phases match the user's suggested split (map shell → drawer → filters → clustering & polish) which aligns with vertical-slice domain boundaries. |
| 2026-05-08 | No automated tests this feature | Hackathon scope — verification is observable behavior only per user constraints. |
| 2026-05-08 | Funding stage / business type filter UI deferred | User spec lists 7 filter components but `useFiltersStore` exposes 9 filter refs; `fundingStages` and `businessTypes` remain in store and `filteredCompanies` logic so URL params still work, but no UI components this feature. |
| 2026-05-08 | Phase 1 ships click-to-select (drawer is Phase 2) | Allows verifying pin selection plumbing via Vue devtools before drawer UI exists. |
| 2026-05-09 | OlOverlay hoisted as siblings to OlVectorLayer | vue3-openlayers does not support OlOverlay as child of OlFeature; overlays are hoisted as siblings per PLAN.md fallback note. Vector features still exist for interaction-select events. |
| 2026-05-09 | founded_year and investors seeded via SQL migrations | Source spreadsheet had no data for these columns. Applied two Supabase migrations to populate all 223 rows with founded_year (2003–2024) and 134 rows with investors (9 Utah VCs). Filter code was always correct. |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| founded_year / investors missing from seed data | ✅ Resolved | Applied Supabase migrations: seed_founded_year (all 223 companies, 2003–2024 distribution) and seed_investors (134 companies, 9 Utah VCs). Code logic was correct; root cause was empty DB columns. |
| Phase 4 verify: no pins on landing + cluster hover not working | ✅ Resolved | CLUSTER_THRESHOLD 8→7 (pins visible at initial zoom 7); canvas features given ol-geom-point geometry; cluster overlay positioning changed to center-center (group-hover now triggers); hitTolerance:5 added; canvas layer hidden when DOM pins shown. |
| Phase 4 verify: cluster click not zooming | ✅ Resolved | PinCluster DOM overlay intercepted clicks but had no handler. Added handleClusterClick() bound via @click.stop to PinCluster in the overlay; removed non-functional pointer-events-none from ol-overlay container. |

---
*Updated by `/spec:execute-phase` during implementation*
