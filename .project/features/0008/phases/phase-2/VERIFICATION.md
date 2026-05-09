# VERIFICATION — Feature 0008 Phase 2

**Date:** 2026-05-09 19:08
**Phase:** Edge Function `track-view` + Drawer Wiring
**App URL:** http://localhost:5173/

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 0    | 0     |
| CODE       | 1    | 0    | 0    | 1     |
| UI         | 3    | 0    | 0    | 3     |
| **Total**  | 5    | 0    | 0    | 5     |

**Overall: PASS**

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173/
Snapshot showed the full `<UtahMap>` with 145+ company pins, the filter sidebar, and the ecosystem stats bar (225 companies / 55 hiring / 134 with investors). Only console error was a 404 for `/favicon.ico` — non-blocking, app mounts and renders fully.

## Criteria Results

### CODE
- **PASS** — DB row written for each drawer open. Baseline `select count(*) from company_views` = 1 before testing; after 3 controlled drawer opens (Leeway, Monovo, Metrodora Institute) plus prior agent opens, count = 7 with 5 distinct `session_id` values. Insert path through `track-view` Edge Function works end-to-end.

### UI
- **PASS** — Criterion 1: Opening a company drawer triggers `POST https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/track-view` with status `200 OK`. All three controlled drawer opens produced exactly one POST 200 each (network requests 265, 266, 267). Response includes valid CORS headers (`access-control-allow-origin: *`) and `x-deno-execution-id`, served by `supabase-edge-runtime` from `us-west-1`.

- **PASS** — Criterion 3 (same-tab session reuse): Two consecutive drawer opens in the same tab (Leeway then Monovo) sent identical `session_id="3272189c-d2aa-4d9e-9bf7-7294c749105e"` in both POST bodies, with different `startup_id` values (`4dc96265-…` vs `18939a22-…`). After `sessionStorage.removeItem('goed_session_id')` and a third drawer open (Metrodora Institute), the new POST body carried a fresh `session_id="516f789b-0b2b-4bd4-b5fc-5fb4f9091d33"` — different from the prior session. Confirms `getOrCreateSessionId()` reads from `sessionStorage` first and only generates a new UUID when missing.

- **PASS** — Criterion 4 (drawer UI unaffected): Snapshots after each drawer open showed company name, logo, sector/stage badges, description, and Claim CTA with no loading spinner, no error toast, no perceived latency. Drawer slid in cleanly via the existing GSAP animation.

## Failures

None.

## Notes

- ENV checks: no port-listening / build-artifact criteria for this phase, so ENV total is 0. Smoke test (which requires the server to be live) covers the implicit "dev server must be running" assumption.
- Track-view `fetch` is non-awaited with `keepalive: true` (see `goed/src/components/drawer/CompanyDrawer.vue:71-80`), confirming the fire-and-forget contract; observed roundtrip per network log was sub-second on every request.
- Per-criterion source: `.project/features/0008/ROADMAP.md` Phase 2 Success Criteria.
