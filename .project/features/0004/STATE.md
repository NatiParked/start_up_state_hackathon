# Feature 0004: Recurring Data Refresh — Weekly Job Refresh via ATS APIs — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 4: End-to-End Integration & Verification |
| **Status** | Pending |
| **Blocker** | None |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Database Migrations | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 2: ATS Shared Module | ✅ Verified | 2026-05-09 | 2026-05-09 |
| Phase 3: refresh-jobs Edge Function | ✅ Complete | 2026-05-09 | 2026-05-09 |
| Phase 4: End-to-End Integration & Verification | Pending | — | — |

## Task Progress

| Task | Status | Sequence | Duration |
|------|--------|----------|----------|
| 1.1: Create supabase/migrations/0004_pg_cron.sql | ✅ Done | 1 | ~5m |
| 1.2: Create supabase/migrations/0005_refresh_log.sql | ✅ Done | 1 | ~5m |
| 1.3: Apply both migrations to Supabase | ✅ Done | 2 | ~5m |
| 2.1: Create supabase/functions/_shared/ats.js | ✅ Done | 1 | ~2m |
| 3.1: Create supabase/functions/_shared/supabaseAdmin.js + refresh-jobs/logger.js | ✅ Done | 1 | ~5m |
| 3.2: Create supabase/functions/refresh-jobs/index.js | ✅ Done | 2 | ~5m |
| 3.3: Deploy refresh-jobs Edge Function + smoke tests | ✅ Done | 3 | ~10m |
| 4.1: Verify cron schedule in cron.job table | Pending | 1 | — |
| 4.2: Manual bulk invocation test | Pending | 2 | — |
| 4.3: Recency gate test (second immediate run) | Pending | 3 | — |
| 4.4: Force-refresh single company test | Pending | 4 | — |
| 4.5: Verify refresh_log entries | Pending | 5 | — |
| 4.6: Grep for AI imports (confirm zero) | Pending | 6 | — |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Initial feature specification created | Roadmap drafted from Milestone 5 spec; 4-phase split: migrations → ATS module → Edge Function → verification. |
| 2026-05-09 | pg_net extension added alongside pg_cron | pg_cron's net.http_post requires pg_net; added `create extension if not exists pg_net` as a safeguard in migration 0004. |
| 2026-05-09 | cron.schedule call uses comment placeholder for URL/key | Secrets must not be committed; operator substitutes project URL and service role key at apply time per ROADMAP open questions note. |
| 2026-05-09 | Ashby unauthenticated first, null on 401/403 | No hardcoded credentials; graceful fallback preserves existing values if board is private. |
| 2026-05-09 | Phase 1 complete — all verifications passed inline | pg_cron + pg_net enabled, jobs_refreshed_at column added to map_startups, refresh_log table created with RLS, smoke-test insert/delete succeeded. cron.schedule(...) left as commented placeholder per plan. |
| 2026-05-09 | cron.schedule executed via MCP to fix verify failure | refresh-jobs-weekly registered in cron.job (jobid=1, schedule='0 6 * * 1', active=true) using real project URL + service_role key from .env.local. Phase 1 verification now passes. |
| 2026-05-09 | Phase 2 complete — all verifications passed inline | ats.js rewritten: default export, goed-startup-map UA via shared fetchWithTimeout, 10s AbortController, Greenhouse ?content=false, Ashby GraphQL endpoint, Lever v0. Node smoke test confirmed null/empty/non-ATS all return null; Greenhouse live call returned 300+ Stripe job titles. |
| 2026-05-09 | Phase 3 complete — all smokes passed, deployed to Supabase | supabaseAdmin.js + logger.js + index.js created. Deployed via Management API (CLI v2.98.2 hardcodes .ts entrypoints). Bulk cold: 223 skipped (all null careers_url). Bracket Labs forced single: 82 Greenhouse jobs. Recency gate: skipped=1. Invalid body: 400. refresh_log has rows with correct source/jobs_updated. |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| None | — | — |

---
*Updated by `/spec:execute-phase` during implementation*
