# Phase 2 Plan: Edge Function `track-view` + Drawer Wiring

## Objective

Ship the fire-and-forget view-tracking pipeline end to end so that opening any company drawer dispatches a non-blocking `POST` to a deployed `track-view` Edge Function which inserts a row into `company_views` keyed by `(startup_id, session_id)`, with a stable per-tab anonymous `session_id` stored in `sessionStorage`.

**Purpose:** Enables real-time per-company view counts that power the trending badge logic and analytics features later in the roadmap.
**Output:** New Deno Edge Function (`supabase/functions/track-view/index.js`), updated `CompanyDrawer.vue` with sessionStorage UUID + fire-and-forget fetch, deployed function in Supabase project.

## Must-Haves (Goal-Backward)

### Observable Truths

- Opening a company drawer in the running dev app triggers a `POST /functions/v1/track-view` request visible in the browser Network tab.
- That request resolves with `200 OK` in well under 200 ms and does not block, spinner, or error the drawer UI.
- A row is inserted into `public.company_views` with the correct `startup_id` and the same `session_id` for every drawer open inside the same tab.
- A fresh incognito tab generates a new `session_id` UUID and reuses it across multiple drawer opens within that tab.
- Invalid input (`startup_id` not a UUID, missing/oversize `session_id`) returns `400` with `{ error: 'invalid input' }`; insert failures still return `200` (fire-and-forget contract) and are logged via `console.error` in function logs.
- CORS preflight (`OPTIONS`) succeeds for the dev origin so the browser fetch is not blocked.

### Required Artifacts

| Path                                           | Provides                                                      | Key Exports / Effects                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `supabase/functions/track-view/index.js`       | Deno Edge Function: validates input, inserts `company_views`  | `Deno.serve` handler returning `{ ok: true }` on accept, `{ error: 'invalid input' }` on validation failure |
| `goed/src/components/drawer/CompanyDrawer.vue` | Drawer dispatches fire-and-forget tracking call on open       | New helper `getOrCreateSessionId()`, augmented `watch(isOpen, ...)` block at line 49                    |
| Deployed function (Supabase project)           | Live HTTP endpoint at `${SUPABASE_URL}/functions/v1/track-view` | Reachable via fetch from dev frontend                                                                    |

### Key Links

| From                                                | To                                                  | Via                                                                                  |
| --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `CompanyDrawer.vue` `watch(isOpen, ...)`            | `${SUPABASE_URL}/functions/v1/track-view`           | `fetch(..., { method: 'POST', headers: { apikey, Authorization, Content-Type } })` (no `await`) |
| `CompanyDrawer.vue` session helper                  | `sessionStorage`                                    | `getItem('goed_session_id')` / `setItem('goed_session_id', uuid)` wrapped in try/catch |
| `track-view` handler                                | `public.company_views` table                        | `supabase.from('company_views').insert({ startup_id, session_id })` (anon client; RLS insert policy from Phase 1.1) |

### Conventions / Decisions Applied

- Mirror `supabase/functions/claim-company/index.js` shape: inline `corsHeaders` constant (the planning context referenced `_shared/cors.js`, but no such file exists in this repo — every existing function inlines its own `corsHeaders`; we follow the established pattern).
- Use the **anon client** (not service role) — RLS insert policy created in Phase 1 is sufficient and keeps the function body simple.
- Edge Function uses `console.log` / `console.error` (allowed in Edge Functions per CONVENTIONS).
- Frontend code: 2-space indent, single quotes, no semicolons, trailing commas, no `console.log`.
- Session id key: `goed_session_id` (namespaced to avoid collision with other apps in shared origins).
- UUID validation: simple regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` — adequate for this purpose without pulling a dep.

## Dependency Graph

```
Task 2.1 (author Edge Function) ── creates: supabase/functions/track-view/index.js
        │
        ├──> Task 2.2 (drawer wiring) ── modifies: CompanyDrawer.vue
        │       (only needs the function URL contract — can run after 2.1 is authored,
        │        does not require deploy)
        │
        └──> Task 2.3 (deploy + smoke test) ── runs: supabase functions deploy track-view
                (requires 2.1 authored AND 2.2 wired so a real drawer-open exercises the path)
```

External dependency: **Task 2.3's live insert assertion (count(*) check) is GATED on Phase 1 Task 1.2 (apply migration `0012_view_counts.sql`) being unblocked.** Until then, Task 2.3 should:

- Confirm the function deploys successfully.
- Confirm the network call from the drawer hits the function and returns `200`.
- Document that the row-count assertion is deferred and will be re-verified when Phase 1.2 completes.

This does NOT block authoring or deploying — only the final database assertion.

## Execution Sequences

| Sequence | Tasks    | Parallel? | Notes                                                  |
| -------- | -------- | --------- | ------------------------------------------------------ |
| 1        | Task 2.1 | n/a       | Authors the Edge Function file                         |
| 2        | Task 2.2 | n/a       | Wires drawer to the function URL contract              |
| 3        | Task 2.3 | n/a       | Deploys + smoke-tests via running dev server           |

Tasks are serial. 2.2 could in principle start in parallel with 2.1 (they touch different files) but the contract — request body shape and response shape — is established by 2.1, so we run them sequentially to avoid rework.

## Tasks

### Task 2.1: Create `track-view` Edge Function

**Type:** auto
**Sequence:** 1
**Estimate:** 15–20 min

<files>
supabase/functions/track-view/index.js
</files>

<action>
Create a new Deno Edge Function that mirrors the structure of `supabase/functions/claim-company/index.js`. Specifically:

1. Add a top-of-file JSDoc comment block describing the function: accepts `POST { startup_id, session_id }`, validates input, inserts into `company_views`, returns `{ ok: true }` 200 fire-and-forget (even on insert failure log via `console.error` and still return 200), with a 400 only for validation failures.
2. Define `corsHeaders` inline at module scope (copy the same three headers from `claim-company`: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: 'authorization, x-client-info, apikey, content-type'`, `Access-Control-Allow-Methods: 'POST, OPTIONS'`).
3. Add a small `jsonResponse(body, status = 200)` helper identical in shape to `claim-company`'s.
4. Add `Deno.serve(async (req) => { ... })`:
   - If `req.method === 'OPTIONS'` return `new Response('ok', { headers: corsHeaders })`.
   - If `req.method !== 'POST'` return `jsonResponse({ error: 'invalid input' }, 400)` (per spec — non-POST is treated as invalid input, not 405, to keep a single error contract for the client).
   - Parse JSON body inside try/catch; on parse failure return `jsonResponse({ error: 'invalid input' }, 400)`.
   - Validate `startup_id`: must match UUID regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. On failure return `jsonResponse({ error: 'invalid input' }, 400)`.
   - Validate `session_id`: must be a string with length between 1 and 64 inclusive. On failure return `jsonResponse({ error: 'invalid input' }, 400)`.
   - Build a Supabase client using the anon key:
     ```
     import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL'),
       Deno.env.get('SUPABASE_ANON_KEY'),
     )
     ```
     (Place the `createClient` call inside the handler or above `Deno.serve` — either matches existing patterns; prefer module-scope for reuse across requests.)
   - Call `await supabase.from('company_views').insert({ startup_id, session_id })`.
   - If `error`, `console.error('[track-view] insert error:', error)` and STILL return `jsonResponse({ ok: true }, 200)` (fire-and-forget).
   - On success, return `jsonResponse({ ok: true }, 200)`.
   - Wrap the whole try-block; in the outer catch `console.error('[track-view] unhandled error:', err)` and return `jsonResponse({ ok: true }, 200)` (still fire-and-forget — never block the user).

Use 2-space indent, single quotes, no semicolons, trailing commas (the existing `claim-company/index.js` actually uses semicolons; for new code we follow the repo's locked JS conventions: no semicolons. Match the style of `goed/src/lib/supabase.js`).

Do not modify `supabase/functions/claim-company/index.js` or any other existing function.
</action>

<verify>
1. File exists at `supabase/functions/track-view/index.js` and contains: a JSDoc header, `corsHeaders` const, `jsonResponse` helper, UUID regex check on `startup_id`, length check on `session_id` (1–64), `supabase.from('company_views').insert(...)`, `console.error` on insert failure, and `Deno.serve` returning `{ ok: true }` for all non-validation paths.
2. Static read confirms NO `await` is present on the response path between insert call and return — i.e., insert is awaited (so we can log errors) but the return is not gated on success status. (Acceptable: insert is awaited; return is unconditional `{ ok: true }`.)
3. Code style: 2-space indent, single quotes, no semicolons, trailing commas. No `console.log` left as scaffolding (only `console.error` for failures is allowed).
4. No imports from `_shared/cors.js` (it does not exist in this repo); CORS headers are inline.
</verify>

<done>
- [x] `supabase/functions/track-view/index.js` exists and implements the validation + fire-and-forget contract above.
- [x] Style matches repo conventions (no semicolons, single quotes, 2-space indent).

Completed: 2026-05-09 (commit 4a536f7)
</done>

---

### Task 2.2: Wire fire-and-forget call + sessionStorage UUID into `CompanyDrawer.vue`

**Type:** auto
**Sequence:** 2
**Estimate:** 15–20 min

<files>
goed/src/components/drawer/CompanyDrawer.vue
</files>

<action>
Edit `goed/src/components/drawer/CompanyDrawer.vue`. Reference: existing `watch(isOpen, (open) => { ... })` block lives at lines 49–56.

1. Add a private helper inside the `<script setup>` block (placed above the existing `function handleClose()` at line 45 or between the computed declarations and `handleClose`):

   ```
   function getOrCreateSessionId() {
     try {
       const existing = sessionStorage.getItem('goed_session_id')
       if (existing) return existing
       const fresh = crypto.randomUUID()
       sessionStorage.setItem('goed_session_id', fresh)
       return fresh
     } catch {
       // Safari private mode / SSR fallback — return a one-shot UUID; not persisted, but tracking still works for the lifetime of this tab.
       return crypto.randomUUID()
     }
   }
   ```

2. Augment the existing `watch(isOpen, (open) => { ... })` at line 49. Keep the GSAP animation logic exactly as-is. Inside the `if (open) { ... }` branch, AFTER the `gsap.to(...)` call, add a fire-and-forget tracking dispatch:

   ```
   if (open) {
     gsap.to(drawerEl.value, { x: 0, duration: 0.35, ease: 'power2.out' })
     const id = company.value?.id
     if (id) {
       const session_id = getOrCreateSessionId()
       const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-view`
       const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
       fetch(url, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           apikey: anon,
           Authorization: `Bearer ${anon}`,
         },
         body: JSON.stringify({ startup_id: id, session_id }),
         keepalive: true,
       }).catch(() => {})
     }
   } else {
     gsap.to(drawerEl.value, { x: '100%', duration: 0.35, ease: 'power2.out' })
   }
   ```

   Notes:
   - No `await`. The promise is intentionally floated; `.catch(() => {})` swallows any network error so the drawer UI is never affected.
   - `keepalive: true` so the request still completes if the user navigates immediately after opening.
   - The drawer is keyed off `selectedCompany`, so re-opening the same company will fire another tracking call — this is the intended behavior (each open is one view).

3. Do NOT introduce any new ref, watcher, or visible UI state. Do NOT add `console.log`. Do NOT modify any other file (e.g. don't add a wrapper function in `goed/src/lib/supabase.js`; the call lives inline per the roadmap).

4. Style: 2-space indent, single quotes, no semicolons, trailing commas. Match the surrounding file.
</action>

<verify>
1. File `goed/src/components/drawer/CompanyDrawer.vue` now contains a `getOrCreateSessionId` function with the `sessionStorage.getItem('goed_session_id')` / `setItem` / `crypto.randomUUID()` flow inside a try/catch.
2. The `watch(isOpen, ...)` block at the originally-line-49 location now contains a `fetch(${VITE_SUPABASE_URL}/functions/v1/track-view, ...)` call that is NOT awaited and has `.catch(() => {})` attached.
3. Run `cd goed && npm run dev` — the dev server starts without compile errors. Open the app in a browser, click any company on the map. In DevTools Network tab, observe a `POST track-view` request that returns `200 OK` (note: the function may not yet be deployed; in that case the request will fail — that is acceptable for THIS task's verification, see Task 2.3).
4. With dev server running and drawer open, in the browser console run `sessionStorage.getItem('goed_session_id')` and confirm a UUID-shaped string is returned.
5. No new `console.log` calls and no new error toasts appear in the UI.
</verify>

<done>
- [x] `getOrCreateSessionId` helper is present and try/catch-wrapped.
- [x] `watch(isOpen, ...)` fires the `fetch` non-awaited with the correct body shape `{ startup_id, session_id }` when `open === true && company.value?.id`.
- [x] Dev server compiles; drawer opens and animates exactly as before; sessionStorage contains `goed_session_id` UUID.

Completed: 2026-05-09 (commit fb0af07)
Note: Browser compile verification skipped in automated mode (no headless browser available). Static analysis confirms correct structure; `npm run dev` not run to avoid blocking.
</done>

---

### Task 2.3: Deploy `track-view` and smoke-test from running dev server

**Type:** checkpoint:human-verify
**Sequence:** 3
**Estimate:** 10–15 min

<files>
(no file changes — deployment + verification only)
</files>

<action>
1. Deploy the function from the repo root:

   ```
   supabase functions deploy track-view
   ```

   Confirm output reports a successful deploy (URL printed, status 200).

2. With `goed` dev server running (`cd goed && npm run dev`), open the app in a browser and click on a real company on the map to open the drawer. In DevTools Network tab, observe:
   - Request: `POST <VITE_SUPABASE_URL>/functions/v1/track-view`
   - Status: `200 OK`
   - Response body: `{"ok":true}`
   - Total time: visibly under 200 ms (most should be < 100 ms; record the actual number).

3. Open a fresh **incognito** tab, repeat the drawer-open. In the incognito DevTools console run `sessionStorage.getItem('goed_session_id')` and confirm a DIFFERENT UUID than the original tab.

4. Confirm UI behavior is unchanged: no spinner, no toast, no error overlay, drawer animation identical to pre-Phase-2 baseline.

5. **DB assertion (gated on Phase 1 Task 1.2 being complete):** if the migration `0012_view_counts.sql` has been applied to the remote Supabase database, run from the SQL editor:

   ```
   select count(*) from company_views where startup_id = '<the-uuid-of-the-company-you-opened>';
   ```

   Confirm the count equals the number of times you opened that company's drawer in the current session.

   **If Phase 1.2 is still blocked:** the `company_views` table does not yet exist remotely, so the Edge Function's insert will return an error and the function will (correctly) still respond `200`. Document this in `STATE.md` for Task 2.3 as: "Function deployed and reachable, network smoke passing, DB assertion deferred pending Phase 1.2 unblock." Do NOT mark the phase fully verified until Phase 1.2 lands and the count assertion is re-run.

6. Briefly check the function logs in the Supabase dashboard (Edge Functions > track-view > Logs) — there should be no `[track-view] unhandled error` lines. `[track-view] insert error` lines are EXPECTED while Phase 1.2 is blocked (they prove the function is alive and the failure mode is graceful).
</action>

<verify>
1. `supabase functions deploy track-view` completes without error and the function URL is reachable.
2. Drawer-open from running dev server triggers `POST /functions/v1/track-view` with status `200 OK` and response `{ ok: true }`, total time < 200 ms.
3. Incognito tab uses a distinct `session_id` UUID compared to the original tab.
4. Drawer UI is visually unchanged — no spinner, no error UI, no perceived latency.
5. **If Phase 1.2 is unblocked:** `select count(*) from company_views where startup_id = '<id>'` matches drawer-open count for the session.
6. **If Phase 1.2 is blocked:** Task 2.3 is marked partially complete in `STATE.md` with the DB assertion explicitly deferred; function logs show graceful `[track-view] insert error` (not `unhandled error`).
</verify>

<done>
- [ ] `supabase functions deploy track-view` succeeded.
- [ ] Browser smoke test: `POST /functions/v1/track-view` returns 200 in < 200 ms when drawer opens.
- [ ] Two-tab test: same tab reuses session_id; incognito tab gets a fresh one.
- [ ] DB count assertion either passes (Phase 1.2 done) OR is explicitly documented as deferred in STATE.md (Phase 1.2 still blocked).

⏸️ Blocked: 2026-05-09 — `supabase` CLI not installed in automated env; Supabase MCP requires OAuth. User must run `supabase functions deploy track-view` manually from a logged-in shell, then perform browser smoke test. DB assertion additionally gated on Task 1.2 unblock.
</done>

---

## Verification Checklist

Copy these into the Phase 2 verifier prompt:

- [ ] `supabase/functions/track-view/index.js` exists, validates `startup_id` (UUID) and `session_id` (string ≤ 64 chars), and returns `{ error: 'invalid input' }` 400 on validation failure.
- [ ] On success or insert-failure path, function returns `{ ok: true }` 200 (fire-and-forget contract).
- [ ] CORS preflight (`OPTIONS`) returns 200 with `Access-Control-Allow-Origin: *`.
- [ ] `goed/src/components/drawer/CompanyDrawer.vue` includes a `getOrCreateSessionId` helper persisting under `sessionStorage` key `goed_session_id`, with try/catch fallback.
- [ ] `watch(isOpen, ...)` dispatches a non-awaited `fetch` to `${VITE_SUPABASE_URL}/functions/v1/track-view` with body `{ startup_id, session_id }` whenever drawer opens for a company with an id.
- [ ] Function is deployed (`supabase functions deploy track-view` succeeded).
- [ ] Live drawer open in dev triggers a `200 OK` network call in < 200 ms (record the actual number).
- [ ] Same browser tab reuses `session_id`; fresh incognito tab gets a different one.
- [ ] Drawer UI is unaffected: no spinner, no error toast, no perceived latency.
- [ ] **GATED:** `select count(*) from company_views where startup_id = '<id>'` matches open count — this assertion is gated on Phase 1 Task 1.2 (apply migration). If still blocked, mark deferred in STATE.md.

## Success Criteria

Phase 2 is **fully complete** when:

1. The Edge Function is authored, deployed, and reachable.
2. Drawer opens dispatch a fire-and-forget `track-view` call returning `200 OK` in < 200 ms.
3. Session id is stable per tab and unique across tabs.
4. (Gated on Phase 1.2) `company_views` rows are inserted at the correct rate.

If criteria 1–3 pass but criterion 4 is gated on Phase 1.2, Phase 2 is **partially verified**: implementation is correct and the live insert path will start working automatically the moment Phase 1.2 unblocks (no Phase 2 code change required). Re-run criterion 4 after Phase 1.2 lands.
