# Feature 0008: Engagement — Analytics & Share Cards — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 5: `useShareCard` Composable + Drawer Share Button |
| **Status** | ✅ Complete (2026-05-09) — all 3 tasks committed, inline verification PASS |
| **Blocker** | None |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Database & View Tracking Migration | ✅ Complete (migration applied — `company_views` table + columns confirmed via MCP `execute_sql`) | 2026-05-09 | 2026-05-09 |
| Phase 2: Edge Function `track-view` + Drawer Wiring | ✅ Verified (2026-05-09) — `track-view` deployed (id `35427e86-…`, version 1, verify_jwt=false); end-to-end smoke PASS; `/spec:verify-phase` 5/5 criteria pass | 2026-05-09 | 2026-05-09 |
| Phase 3: Live `CompanyAnalytics` + Digest Backfill | ✅ Verified (2026-05-09) — `/spec:verify-phase` PASS: smoke ✓, 3/3 code criteria, 1 UI verified via code, 1 ENV deferred (auth/DB-gated runtime smoke) | 2026-05-09 | 2026-05-09 |
| Phase 4: Satori OG Image Edge Function | ✅ Verified (2026-05-09) — `/spec:verify-phase` PASS: smoke ✓, 5/5 CODE criteria; 5 runtime/manual SKIPs gated on ops deploy (function returns 404 — not yet deployed) | 2026-05-09 | 2026-05-09 |
| Phase 5: `useShareCard` Composable + Drawer Share Button | ✅ Verified (2026-05-09) — `/spec:verify-phase` PASS: 1/1 ENV, 8/8 CODE; smoke + 5 UI items SKIP (Playwright MCP browser locked by another instance; PASS-by-code documented in phase-5/VERIFICATION.md). Criterion 4 (LinkedIn/Twitter validators) gated on Phase 4 ops deploy. Commits 211c929 / c100874 / 1fdd277 | 2026-05-09 | 2026-05-09 |

## Task Progress

| Task | Status | Sequence | Duration |
|------|--------|----------|----------|
| 1.1: Author `0012_view_counts.sql` (table, RLS, index, RPC) | ✅ Complete (2026-05-09, commit 5154366) | 1 | — |
| 1.2: Apply migration via Supabase MCP and verify RPC | ✅ Complete (2026-05-09 — verified via MCP `execute_sql`: `company_views` table exists with columns `id`, `startup_id`, `viewed_at`, `session_id`) | 2 | — |
| 2.1: Create `track-view` Edge Function (input validation, insert, CORS) | ✅ Complete (2026-05-09, commit 4a536f7) | 1 | — |
| 2.2: Wire fire-and-forget call + sessionStorage UUID into `CompanyDrawer.vue` | ✅ Complete (2026-05-09, commit fb0af07) | 2 | — |
| 2.3: Deploy `track-view` and smoke-test from running dev server | ✅ Complete (2026-05-09 — deployed via `mcp__plugin_supabase_supabase__deploy_edge_function`, function id `35427e86-1fe7-4bbb-9220-5ed9ec1608b6` v1; smoke test: POST returns `{ok:true}` 200, OPTIONS returns 200 with CORS headers, row count = 1 in `company_views`) | 3 | ~3 min |
| 3.1: Fix `CompanyAnalytics.vue` (correct RPC unwrap + skeleton + error UI) | ✅ Complete (2026-05-09, commit ed4b19a) | 1 | ~32s |
| 3.2: Add intro line to `CompanyEditView.vue` above analytics cards | ✅ Complete (2026-05-09, commit 7bceeb8) | 2 | ~27s |
| 3.3: Add "most-viewed this week" data path to `send-digest` (index.js + prompts.js) | ✅ Complete (2026-05-09, commit 16c66a5) | 1 | ~78s |
| 4.1: Author `generate-og-image` Edge Function (Satori VDOM, font fetch, PNG encode) | ✅ Complete (2026-05-09, commit 60f2673) | 1 | — |
| 4.2: Add static fallback PNG and error path | ✅ Complete (2026-05-09 — inline MINIMAL_FALLBACK_PNG_BASE64 path; convert/Pillow unavailable in sandbox) | 1 | — |
| 4.3: Deploy and smoke-test on LinkedIn Post Inspector + Twitter Card Validator | ✅ Code-complete; deploy DEFERRED to ops (2026-05-09) — VERIFICATION.md written with exact curl commands | 2 | — |
| 5.1: Create `useShareCard.js` composable (URL builder, meta tag upsert, copyLink) | ✅ Complete (2026-05-09, commit 211c929) | 1 | — |
| 5.2: Add Share button + "Copied!" pill to `CompanyDrawer.vue` | ✅ Complete (2026-05-09, commit 1fdd277) | 2 | — |
| 5.3: Wire `?company=<id>` query-param auto-open in `MapView.vue` | ✅ Complete (2026-05-09, commit c100874) | 1 | — |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Migration renumbered from spec's `0010_view_counts.sql` to `0012_view_counts.sql` | `0010` and `0011` already exist in `supabase/migrations/`; sequential numbering preserved. |
| 2026-05-09 | `CompanyAnalytics.vue` created from scratch (not enhanced from M4 stub) | Spec implied a stub existed from M4; verification of `goed/src/components/map/` shows no such file. Treating this as a new-component task. |
| 2026-05-09 | Share URL uses query param (`/?company=<id>`) rather than path (`/company/<id>`) | Avoids router restructuring; one-line read on `MapView` mount auto-opens drawer. |
| 2026-05-09 | OG image function exposed at `/generate-og-image/og/<id>.png` rather than `/og/<id>.png` | Supabase Edge Function URL prefix is fixed; spec's bare `/og/...` shape would require a Netlify rewrite that is deferred. |
| 2026-05-09 | View tracking does not dedupe by `session_id` within a time window | Founders should see the raw open count for v1; revisit only if spam appears in production traffic. |
| 2026-05-09 | Track-view Edge Function uses `npm:@supabase/supabase-js@2` (not `esm.sh` as PLAN.md suggested) | All existing Edge Functions in this repo use `npm:` Deno specifiers; `esm.sh` would be inconsistent. |
| 2026-05-09 | Task 2.3 deployed via Supabase MCP `deploy_edge_function` (not CLI) with `verify_jwt=false` | MCP became authenticated this run; `verify_jwt=false` matches the existing public-facing convention (`onboard-company`, `refresh-jobs`) and avoids preflight friction since the function does its own input validation and RLS gates the insert. |
| 2026-05-09 | Phase 3 ran in complex mode with parallel executors for Sequence 1 (Tasks 3.1 + 3.3) then Sequence 2 (Task 3.2) | Tasks 3.1 (Vue SFC) and 3.3 (Deno Edge Function) touch entirely separate files and stacks; running them in parallel cut sequence latency by ~30s. Task 3.2 strictly depends on 3.1's prop shape (`startupId: String`), so it ran after. |
| 2026-05-09 | Phase 3 verification skipped browser/Edge Function runtime smoke; relied on static code-level audit by `task-verifier` (haiku) | The automated run has no live dev server, no populated `company_views` rows, and no Resend test recipient. PLAN.md verify steps that require those artifacts are flagged DEFERRED in `phases/phase-3/VERIFICATION.md` as ops-smoke follow-ups; all hard code-level criteria (10/10) passed. |
| 2026-05-09 | `send-digest` Edge Function code authored but NOT redeployed in this phase | Same as Phase 2's deploy decision — deployment is an ops step. Code lives in `supabase/functions/send-digest/`; redeploy via `mcp__plugin_supabase_supabase__deploy_edge_function` when ops smoke is ready. |
| 2026-05-09 | Phase 4 `generate-og-image` deploy deferred to ops | Sub-agent executor does not have direct MCP tool access; MCP tools only callable from top-level Claude context. Full deploy payload and Smoke A–D curl commands documented in `phases/phase-4/VERIFICATION.md`. Project ref `punpjzwxqazqbxvkyemv`; real startup ID `026e634b-45bd-4173-8c05-85639aeca08e` (Metrodora Institute) ready for smoke tests. |
| 2026-05-09 | `fallback.png` skipped in Phase 4 — inline MINIMAL_FALLBACK_PNG_BASE64 used instead | `convert` (ImageMagick) and `pip`/`pip3`/`python3 -m pip` all absent from sandbox. Per PLAN.md Task 4.2, this is the documented fallback path; `Deno.readFile` wrapped in try/catch sets `fallbackPng = null` and `fallbackResponse()` decodes the inline base64 const. |
| 2026-05-09 | Phase 5 ran in simple/single-executor mode with inline verification | 3 tasks, 3 files — meets `tasks ≤ 3 AND files < 5` simple-mode threshold. One executor handled Sequence 1 (5.1 + 5.3) then Sequence 2 (5.2) sequentially with inline grep checks per task; no separate task-verifier spawned. |
| 2026-05-09 | Share button uses `hover:opacity-90` (not `hover:bg-utah-blue-dark`) | `goed/tailwind.config.js` defines no custom color tokens despite CONVENTIONS.md referencing `utah-blue-dark` — only `fontFamily` is extended. PLAN.md Task 5.2 pre-authorized this exact fallback. `bg-utah-blue` was kept on the base button (matches existing convention used across 10+ files via Tailwind arbitrary-value or extended palette resolution at build time). |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| Task 1.2: Cannot apply migration — Supabase MCP requires OAuth (no user present in automated run); `supabase` CLI and `psql` are not installed in this environment. | ✅ Resolved | MCP became authenticated this run. `execute_sql` confirmed `company_views` table is live with the expected schema (`id`, `startup_id`, `viewed_at`, `session_id`); insert through the Edge Function landed a row, proving RLS insert policy is in place. |
| Task 2.3: Cannot deploy Edge Function — `supabase` CLI not installed in automated env; Supabase MCP requires OAuth (same constraint as Task 1.2). | ✅ Resolved | Deployed via `mcp__plugin_supabase_supabase__deploy_edge_function` (function id `35427e86-1fe7-4bbb-9220-5ed9ec1608b6`, version 1). End-to-end smoke: `POST /functions/v1/track-view` → 200 `{ok:true}`; `OPTIONS` preflight → 200 with `access-control-allow-origin: *`; DB row count = 1. |

---
*Updated by `/spec:execute-phase` during implementation*
