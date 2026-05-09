# Feature 0003: AI Onboarding — Submission Pipeline — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 2: Core Enrichers & Pipeline Orchestrator |
| **Status** | Pending |
| **Blocker** | None |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Submissions Schema & Shared Helpers | ✅ Complete | 2026-05-09 | 2026-05-09 |
| Phase 2: Core Enrichers & Pipeline Orchestrator | Pending | — | — |
| Phase 3: onboard-company Edge Function | Pending | — | — |
| Phase 4: Frontend Submission UI | Pending | — | — |

## Task Progress

| Task | Status | Sequence | Duration |
|------|--------|----------|----------|
| 1.1: Create `supabase/migrations/0002_submissions.sql` | ✅ Done | 1 | ~4 min |
| 1.2: Create `_shared/llm.js` | ✅ Done | 1 | ~2 min |
| 1.3: Create `_shared/logo-dev.js` | ✅ Done | 1 | ~2 min |
| 1.4: Create `_shared/nominatim.js` | ✅ Done | 1 | ~2 min |
| 1.5: Create `_shared/google-places.js` | ✅ Done | 1 | ~2 min |
| 2.1: Create `_shared/ats.js` | Pending | 1 | — |
| 2.2: Create `_shared/enrichers/crunchbase.js` | Pending | 1 | — |
| 2.3: Create `_shared/enrichers/utah-dcc.js` | Pending | 1 | — |
| 2.4: Create `_shared/enrichers/github.js` | Pending | 1 | — |
| 2.5: Create `_shared/enrichers/wappalyzer.js` | Pending | 1 | — |
| 2.6: Create `_shared/enrichers/producthunt.js` | Pending | 1 | — |
| 2.7: Create `_shared/enrichers/news.js` | Pending | 1 | — |
| 2.8: Create `_shared/pipeline.js` | Pending | 2 | — |
| 3.1: Create `onboard-company/utah-bounds.js` | Pending | 1 | — |
| 3.2: Create `onboard-company/quality-gate.js` | Pending | 1 | — |
| 3.3: Create `onboard-company/prompts.js` | Pending | 1 | — |
| 3.4: Create `onboard-company/index.js` | Pending | 2 | — |
| 4.1: Create `useOnboarding.js` composable | Pending | 1 | — |
| 4.2: Create `SubmitForm.vue` | Pending | 1 | — |
| 4.3: Create `SubmitProgress.vue` | Pending | 1 | — |
| 4.4: Create `SubmitResult.vue` | Pending | 1 | — |
| 4.5: Create `SubmitView.vue` | Pending | 2 | — |
| 4.6: Update router `/submit` route to `SubmitView` | Pending | 3 | — |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Migration `0002_submissions.sql` uses ALTER TABLE, not CREATE TABLE | `map_startup_submissions` already exists from Feature 0001 Phase 2; adding M3 columns as incremental migration avoids data loss and table rename |
| 2026-05-09 | `_shared/ats.js` located at `supabase/functions/_shared/ats.js` (not `enrichers/`) | Per MILESTONES.md M5 dependency note: M5 imports this module directly; keeping it at `_shared/` root ensures M5 can reference it without path changes |
| 2026-05-09 | Roadmap enrichers (Wappalyzer, ProductHunt, News) included as stubs that return `{}` when their API key is absent | Keeps pipeline extensible for post-Tier-1 activation without breaking the core flow; no key = silent skip, not error |
| 2026-05-09 | SubmitProgress stage advancement is client-side simulated on a timer | Edge Function is synchronous and does not stream stage events; simulated animation provides UX feedback during the ~30–90s execution window |
| 2026-05-09 | Quality gate auto-publishes with `verified = false` on `map_startups` | Allows the pin to appear on the map immediately (satisfying the <90s demo) while flagging for GOED review; distinguishes AI-submitted from manually-verified seed data |
| 2026-05-09 | `callLLM` uses Anthropic tool-use pattern (single `respond` tool) for structured JSON output | Forces deterministic JSON rather than parsing free-text; consistent with the Anthropic SDK's structured output pattern |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| None | — | — |

---
*Updated by `/spec:execute-phase` during implementation*
