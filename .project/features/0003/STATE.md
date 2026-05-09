# Feature 0003: AI Onboarding — Submission Pipeline — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 4: Frontend Submission UI |
| **Status** | ✅ Complete — C2 fix applied |
| **Blocker** | None |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Submissions Schema & Shared Helpers | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 2: Core Enrichers & Pipeline Orchestrator | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 3: onboard-company Edge Function | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 4: Frontend Submission UI | ✅ Complete | 2026-05-09 | 2026-05-09 |

## Task Progress

| Task | Status | Sequence | Duration |
|------|--------|----------|----------|
| 1.1: Create `supabase/migrations/0002_submissions.sql` | ✅ Done | 1 | ~4 min |
| 1.2: Create `_shared/llm.js` | ✅ Done | 1 | ~2 min |
| 1.3: Create `_shared/logo-dev.js` | ✅ Done | 1 | ~2 min |
| 1.4: Create `_shared/nominatim.js` | ✅ Done | 1 | ~2 min |
| 1.5: Create `_shared/google-places.js` | ✅ Done | 1 | ~2 min |
| 2.1: Create `_shared/ats.js` | ✅ Done | 1 | ~2 min |
| 2.2: Create `_shared/enrichers/crunchbase.js` | ✅ Done | 1 | ~2 min |
| 2.3: Create `_shared/enrichers/utah-dcc.js` | ✅ Done | 1 | ~2 min |
| 2.4: Create `_shared/enrichers/github.js` | ✅ Done | 1 | ~1 min |
| 2.5: Create `_shared/enrichers/wappalyzer.js` | ✅ Done | 1 | ~1 min |
| 2.6: Create `_shared/enrichers/producthunt.js` | ✅ Done | 1 | ~2 min |
| 2.7: Create `_shared/enrichers/news.js` | ✅ Done | 1 | ~1 min |
| 2.8: Create `_shared/pipeline.js` | ✅ Done | 2 | ~2 min |
| 3.1: Create `onboard-company/utah-bounds.js` | ✅ Done | 1 | ~2 min |
| 3.2: Create `onboard-company/quality-gate.js` | ✅ Done | 1 | ~2 min |
| 3.3: Create `onboard-company/prompts.js` | ✅ Done | 1 | ~2 min |
| 3.4: Create `onboard-company/index.js` | ✅ Done | 2 | ~3 min |
| 4.1: Create `useOnboarding.js` composable | ✅ Done | 1 | ~1 min |
| 4.2: Create `SubmitForm.vue` | ✅ Done | 1 | ~1 min |
| 4.3: Create `SubmitProgress.vue` | ✅ Done | 1 | ~1 min |
| 4.4: Create `SubmitResult.vue` | ✅ Done | 1 | ~1 min |
| 4.5: Create `SubmitView.vue` | ✅ Done | 2 | ~1 min |
| 4.6: Update router `/submit` route to `SubmitView` | ✅ Done | 3 | ~1 min |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Migration `0002_submissions.sql` uses ALTER TABLE, not CREATE TABLE | `map_startup_submissions` already exists from Feature 0001 Phase 2; adding M3 columns as incremental migration avoids data loss and table rename |
| 2026-05-09 | `_shared/ats.js` located at `supabase/functions/_shared/ats.js` (not `enrichers/`) | Per MILESTONES.md M5 dependency note: M5 imports this module directly; keeping it at `_shared/` root ensures M5 can reference it without path changes |
| 2026-05-09 | Roadmap enrichers (Wappalyzer, ProductHunt, News) included as stubs that return `{}` when their API key is absent | Keeps pipeline extensible for post-Tier-1 activation without breaking the core flow; no key = silent skip, not error |
| 2026-05-09 | SubmitProgress stage advancement is client-side simulated on a timer | Edge Function is synchronous and does not stream stage events; simulated animation provides UX feedback during the ~30–90s execution window |
| 2026-05-09 | Quality gate auto-publishes with `verified = false` on `map_startups` | Allows the pin to appear on the map immediately (satisfying the <90s demo) while flagging for GOED review; distinguishes AI-submitted from manually-verified seed data |
| 2026-05-09 | `callLLM` uses Anthropic tool-use pattern (single `respond` tool) for structured JSON output | Forces deterministic JSON rather than parsing free-text; consistent with the Anthropic SDK's structured output pattern |
| 2026-05-09 | `useOnboarding.submit()` enforces 1500ms minimum display time before leaving `running` state | CORS preflight failures were instant, causing `SubmitProgress` to flash and unmount before Playwright could snapshot it. `ensureMinDelay()` guarantees the progress view stays visible. |
| 2026-05-09 | `onboard-company` Edge Function deployed to Supabase project `punpjzwxqazqbxvkyemv` | CORS headers were present in code but function was never deployed; Supabase returned no-endpoint CORS rejection on every preflight. Deployed with `verify_jwt: false` (public form, anon key sent by client). |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| None | — | — |

---
*Updated by `/spec:execute-phase` during implementation*
