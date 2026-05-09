# Feature 0008: Engagement — Analytics & Share Cards — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 1: Database & View Tracking Migration |
| **Status** | 🚧 In Progress (Task 1.2 blocked) |
| **Blocker** | Task 1.2: Supabase MCP not authenticated; no `supabase` CLI or `psql` available in automated env |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Database & View Tracking Migration | 🚧 In Progress | 2026-05-09 | — |
| Phase 2: Edge Function `track-view` + Drawer Wiring | ⏳ Pending | — | — |
| Phase 3: Live `CompanyAnalytics` + Digest Backfill | ⏳ Pending | — | — |
| Phase 4: Satori OG Image Edge Function | ⏳ Pending | — | — |
| Phase 5: `useShareCard` Composable + Drawer Share Button | ⏳ Pending | — | — |

## Task Progress

| Task | Status | Sequence | Duration |
|------|--------|----------|----------|
| 1.1: Author `0012_view_counts.sql` (table, RLS, index, RPC) | ✅ Complete (2026-05-09, commit 5154366) | 1 | — |
| 1.2: Apply migration via Supabase MCP and verify RPC | ⏸️ Blocked | 2 | — |
| 2.1: Create `track-view` Edge Function (input validation, insert, CORS) | ⏳ Pending | 1 | — |
| 2.2: Wire fire-and-forget call + sessionStorage UUID into `CompanyDrawer.vue` | ⏳ Pending | 2 | — |
| 2.3: Deploy `track-view` and smoke-test from running dev server | ⏳ Pending | 3 | — |
| 3.1: Create `CompanyAnalytics.vue` component (RPC call, stat cards, error state) | ⏳ Pending | 1 | — |
| 3.2: Replace `CompanyEditView.vue` placeholder with live `<CompanyAnalytics />` | ⏳ Pending | 2 | — |
| 3.3: Update `send-digest` to query real `company_views` for "most-viewed this week" | ⏳ Pending | 1 | — |
| 4.1: Author `generate-og-image` Edge Function (Satori VDOM, font fetch, PNG encode) | ⏳ Pending | 1 | — |
| 4.2: Add static fallback PNG and error path | ⏳ Pending | 2 | — |
| 4.3: Deploy and smoke-test on LinkedIn Post Inspector + Twitter Card Validator | ⏳ Pending | 3 | — |
| 5.1: Create `useShareCard.js` composable (URL builder, meta tag upsert, copyLink) | ⏳ Pending | 1 | — |
| 5.2: Add Share button + "Copied!" pill to `CompanyDrawer.vue` | ⏳ Pending | 2 | — |
| 5.3: Wire `?company=<id>` query-param auto-open in `MapView.vue` | ⏳ Pending | 2 | — |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Migration renumbered from spec's `0010_view_counts.sql` to `0012_view_counts.sql` | `0010` and `0011` already exist in `supabase/migrations/`; sequential numbering preserved. |
| 2026-05-09 | `CompanyAnalytics.vue` created from scratch (not enhanced from M4 stub) | Spec implied a stub existed from M4; verification of `goed/src/components/map/` shows no such file. Treating this as a new-component task. |
| 2026-05-09 | Share URL uses query param (`/?company=<id>`) rather than path (`/company/<id>`) | Avoids router restructuring; one-line read on `MapView` mount auto-opens drawer. |
| 2026-05-09 | OG image function exposed at `/generate-og-image/og/<id>.png` rather than `/og/<id>.png` | Supabase Edge Function URL prefix is fixed; spec's bare `/og/...` shape would require a Netlify rewrite that is deferred. |
| 2026-05-09 | View tracking does not dedupe by `session_id` within a time window | Founders should see the raw open count for v1; revisit only if spam appears in production traffic. |

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| Task 1.2: Cannot apply migration — Supabase MCP requires OAuth (no user present in automated run); `supabase` CLI and `psql` are not installed in this environment. | 🔴 Open | User needs to either (a) authenticate Supabase MCP via `mcp__plugin_supabase_supabase__authenticate` then re-run `/spec:execute-phase 0008:1 --gaps-only --commit`, or (b) manually apply `supabase/migrations/0012_view_counts.sql` via the Supabase SQL editor and mark Task 1.2 complete. |

---
*Updated by `/spec:execute-phase` during implementation*
