# Feature 0007: Engagement — Subscriptions & AI Digest — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 2: Send-Digest Edge Function |
| **Status** | ✅ Verified |
| **Blocker** | None — RESEND_API_KEY guard moved inside subscriber loop |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Database Schema & Migration | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 2: Send-Digest Edge Function | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 3: Subscribe View & Confirmation Flow | ⏳ Pending | — | — |
| Phase 4: Map CTA & Admin Panel Population | ⏳ Pending | — | — |

## Task Progress

| Task | Status | Sequence | Duration |
|------|--------|----------|----------|
| 1.1: Author `0009_subscriptions.sql` migration | ✅ Done | 1 | ~5 min |
| 1.2: Apply migration to Supabase and verify schema + RLS | ✅ Done | 2 | ~5 min |
| 2.1: Create `send-digest/prompts.js` with prompt builders | ✅ Done | 1 | ~2 min |
| 2.2: Create `send-digest/index.js` orchestrator | ✅ Done | 2 | ~2 min |
| 3.1: Create `confirm-subscription/index.js` Edge Function | ⏳ Pending | 1 | — |
| 3.2: Create `send-confirmation/index.js` Edge Function | ⏳ Pending | 1 | — |
| 3.3: Create `SubscribeView.vue` with filter form + opt-in flow | ⏳ Pending | 2 | — |
| 3.4: Update router to wire `/subscribe` to `SubscribeView` | ⏳ Pending | 3 | — |
| 4.1: Create `SubscribeCTA.vue` sticky footer component | ⏳ Pending | 1 | — |
| 4.2: Mount `<SubscribeCTA />` in `MapView.vue` | ⏳ Pending | 2 | — |
| 4.3: Populate `SubscriberPanel.vue` with live queries | ⏳ Pending | 1 | — |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Initial feature specification created | Roadmap drafted from Milestone 9 spec; 4-phase split gives DB, backend, frontend form, and UI/admin each an independently verifiable boundary. |
| 2026-05-09 | Use Google Gemini (not Claude) for digest generation | Locked codebase decision: all AI calls use `callLLM()` / `GOOGLE_AI_API_KEY` / Gemini 2.0 Flash. The milestone spec refers to "Claude" but Gemini is the project's canonical model. |
| 2026-05-09 | Table names `map_subscriptions` / `map_digest_runs` (not `subscriptions` / `digest_runs`) | All Map product tables are prefixed `map_` per project convention. |
| 2026-05-09 | `confirm_token` doubles as unsubscribe identifier | Avoids exposing UUID primary key in URLs; the token is already emailed to the subscriber during opt-in, so reusing it for unsubscribe requires no new column. |
| 2026-05-09 | Confirmation handled by `confirm-subscription` Edge Function (redirect) | The confirm link goes directly to the Edge Function URL which redirects to `/subscribe?confirmed=true`; no client-side token-in-URL parsing needed, simpler UX. |
| 2026-05-09 | `send-confirmation` is a separate Edge Function from `send-digest` | Keeps `send-digest` focused on the weekly batch job; confirmation emails are triggered on-demand from `SubscribeView` via `supabase.functions.invoke`. |
| 2026-05-09 | Phase 1 executed inline (no subagent) | Task 2 requires Supabase MCP tools only available in orchestrator context; single-executor mode used for the whole phase. |
| 2026-05-09 | `send-digest` deployed via MCP `deploy_edge_function` | CLI `invoke` subcommand absent in locally installed Supabase CLI v2.98.2; deployment done directly via Supabase MCP tool instead. Function ID: c2d9348e, status: ACTIVE. |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| `RESEND_API_KEY` must be added before deploying digest/confirm functions | ✅ Resolved | Moved key guard inside subscriber loop — 0-subscriber runs no longer require the key. Key still needed to send actual emails. |

---
*Updated by `/spec:execute-phase` during implementation*
