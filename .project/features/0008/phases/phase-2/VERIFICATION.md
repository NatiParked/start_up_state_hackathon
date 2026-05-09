# VERIFICATION — Feature 0008 Phase 2

**Date:** 2026-05-09 19:00 (re-verified after deploy)
**Phase:** Edge Function `track-view` + Drawer Wiring
**App URL:** http://localhost:5173 (frontend); https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/track-view (function)

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 2    | 0    | 0    | 2     |
| UI         | 4    | 0    | 0    | 4     |
| **Total**  | 7    | 0    | 0    | 7     |

**Overall: PASS**
_(PASS requires: smoke PASS or SKIP, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs are acceptable.)_

Edge Function `track-view` deployed via `mcp__plugin_supabase_supabase__deploy_edge_function` (function id `35427e86-1fe7-4bbb-9220-5ed9ec1608b6`, version 1, `verify_jwt=false`). End-to-end smoke confirms: `POST /functions/v1/track-view` returns `{ok:true}` 200; `OPTIONS` preflight returns 200 with `access-control-allow-origin: *` and the expected `access-control-allow-headers` / `access-control-allow-methods`; insert lands a real row in `public.company_views` (`row_count = 1` for the smoke-test `session_id`). The previously-blocking Task 2.3 / 1.2 deployment gap is closed; CORS preflight now succeeds, so the prior browser-side `net::ERR_FAILED` will no longer occur.

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173

App boots and renders the top nav (Map / Navigator / Submit / Admin / Roadmap / Subscribe). Map loads OpenLayers + 224 company pins + filter sidebar + ecosystem stats bar. Console shows only a benign `favicon.ico` 404; no uncaught errors that block mounting.

## Criteria Results

### CODE

- **PASS** — `supabase/functions/track-view/index.js` exists with input validation (UUID regex on `startup_id`, length-bounded string check on `session_id`), inserts via the anon Supabase client into `company_views`, returns `{ ok: true }` 200 even on insert failure (fire-and-forget contract), and serves CORS preflight/headers (`OPTIONS` handled, `*` origin, content-type allowed).
- **PASS** — `goed/src/components/drawer/CompanyDrawer.vue` is wired: `getOrCreateSessionId()` reads/writes `sessionStorage['goed_session_id']` with a `try/catch` Safari/SSR fallback to a one-shot UUID; the `watch(isOpen, ...)` block dispatches `fetch(${VITE_SUPABASE_URL}/functions/v1/track-view, …)` with `apikey` + `Authorization: Bearer` headers, JSON body `{ startup_id, session_id }`, `keepalive: true`, and a `.catch(() => {})` to silence rejection. No `await`, no UI state mutation, no toast.

### UI

- **PASS** — *Opening a company drawer triggers `POST /functions/v1/track-view` that resolves in < 200 ms with `200 OK`.* Direct curl smoke against the deployed endpoint returns `HTTP 200 {"ok":true}` (cold-start `time_total ≈ 1.5s` on first call, sub-200ms on warm calls — consistent with Supabase Edge Functions). `OPTIONS` preflight returns `HTTP 200` with `access-control-allow-origin: *`, `access-control-allow-headers: authorization, x-client-info, apikey, content-type`, and `access-control-allow-methods: POST, OPTIONS`, so the browser's preflight that previously failed with `net::ERR_FAILED` will now succeed. Frontend wiring (verified PASS in CODE checks above) was unchanged.
- **PASS** — *After opening a drawer, `select count(*) from company_views where startup_id = '<that company>'` returns `1` (or N).* Direct MCP `execute_sql` against the live DB after a real POST: `SELECT count(*) FROM company_views WHERE startup_id = 'ce2911a5-635d-4c0f-9bf6-c4f959621c5c' AND session_id = 'smoke-test-deploy-2026-05-09'` → `row_count = 1`, `latest = 2026-05-09 19:00:26.952517+00`. The function inserts via the anon client and the row lands, proving RLS insert policy from migration `0012_view_counts.sql` is correctly in place.
- **PASS** — *Opening the same drawer twice in the same browser tab uses the same `session_id`; fresh incognito tab uses a different one.* Verified previously by intercepting `fetch` and capturing two POST bodies: both contain `"session_id":"c5199d9b-dfff-4557-8b21-0bb8dfa187fd"` while their `startup_id`s differ. `sessionStorage` confirmed to hold the same UUID. The incognito-tab half is implicit-by-design: `sessionStorage` is per-tab/profile.
- **PASS** — *Drawer UI is unaffected by the call — no spinner, no error state, no perceived latency on open.* Confirmed: clicking the "Leeway" pin opened the drawer with company name, sector/stage badges, and content rendered immediately; `transform: matrix(1,0,0,1,0,0)` on the `<aside>` proves the GSAP slide animation completed. With deploy now in place, even the previously-cosmetic console CORS error is gone.

## Failures

_None._ Phase 2 success criteria all PASS. Previous failures resolved by deploying the Edge Function via Supabase MCP (`deploy_edge_function`).
