# Feature Plan: 0008 Phase 4 — Satori OG Image Edge Function

## Objective

Ship a Deno Edge Function `generate-og-image` that, given a company id in the URL path, renders a 1200×630 PNG Open Graph card (Utah-blue `#0065A4` background, company name, sector pill, stage pill, logo from logo.dev with graceful fallback) using Satori for VDOM-to-SVG and `@resvg/resvg-wasm` for SVG-to-PNG, served at `https://<project>.functions.supabase.co/generate-og-image/og/<id>.png` with a 24-hour CDN cache. On any error or unknown id, return a static fallback PNG with `Cache-Control: no-cache` so the cache is not poisoned. Deploy via Supabase MCP (`deploy_edge_function`, `verify_jwt=false`) and smoke-test from a real URL.

**Purpose:** Deep-link share URLs (Phase 5) must unfurl as branded cards on LinkedIn and Twitter; this phase is the highest-risk piece of that pipeline. Phase 5 is blocked on a working URL.

**Output:**
- `supabase/functions/generate-og-image/index.js` (Deno Edge Function — Satori + resvg-wasm)
- `supabase/functions/generate-og-image/fallback.png` (1200×630 static placeholder served on error)
- Deployed function reachable at `https://<project>.functions.supabase.co/generate-og-image/og/<id>.png`

## Must-Haves (Goal-Backward)

### Observable Truths

- Hitting `/<function-url>/og/<valid-uuid>.png` returns a 1200×630 PNG with `Content-Type: image/png` and `Cache-Control: public, max-age=86400, s-maxage=86400`.
- The rendered card visibly contains the correct company `name`, a sector pill (sector text on `hiring-green` `#10B981`), a stage pill (stage text on white with Utah-blue text), and either the company logo (from `https://img.logo.dev/{domain}?token=...`) or a graceful fallback shape when logo fetch fails or the company has no website.
- Hitting the URL with an invalid/unknown id returns the static fallback PNG, HTTP 200, `Cache-Control: no-cache`. The function never returns 5xx for routine bad inputs.
- Re-hitting the same valid id within 24 hours is served from CDN cache (verifiable via `cf-cache-status: HIT` or `age` header).
- Inter Regular and Inter Bold are fetched once at module top-level (cached in module scope across invocations) — no per-request font fetch.
- Function is deployed with `verify_jwt=false` (mirrors `track-view`, `onboard-company`); the URL is publicly reachable without an auth header.
- LinkedIn Post Inspector and Twitter Card Validator both render a valid preview when given a deep-link URL whose `og:image` points at this function (manual end-of-phase check).

### Required Artifacts

| Path                                                  | Provides                                                                | Key Exports / Behavior                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `supabase/functions/generate-og-image/index.js`       | Deno Edge Function: route, DB lookup, Satori VDOM, PNG encode, caching  | `Deno.serve` handler at module level                         |
| `supabase/functions/generate-og-image/fallback.png`   | Static 1200×630 PNG used on error / unknown id                          | Read at module top-level via `Deno.readFile(new URL('./fallback.png', import.meta.url))` |

### Key Links

| From                                        | To                                                  | Via                                                                                       |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Incoming `GET /generate-og-image/og/<id>.png` | `map_startups` row                                  | `supabase.from('map_startups').select('id, name, sector, stage, website').eq('id', id).maybeSingle()` |
| `map_startups.website`                      | logo PNG bytes                                      | `normalizeDomain(website)` → `fetch('https://img.logo.dev/{domain}?token=...&size=128')` → ArrayBuffer → base64 data URI in Satori VDOM `<img>` |
| Satori VDOM                                 | SVG string                                          | `satori(vdom, { width: 1200, height: 630, fonts: [interRegular, interBold] })`            |
| SVG string                                  | PNG bytes                                           | `new Resvg(svg).render().asPng()` (from `@resvg/resvg-wasm`)                              |
| Inter font URLs                             | Module-scope `ArrayBuffer` cache                    | Top-level `await fetch(...).then(r => r.arrayBuffer())` — runs once per cold start        |

## Dependency Graph

```
Task 4.1 (author index.js)        creates: supabase/functions/generate-og-image/index.js
Task 4.2 (add fallback.png)       creates: supabase/functions/generate-og-image/fallback.png
   ↓ both feed into ↓
Task 4.3 (deploy + smoke test)    needs: 4.1 + 4.2 ; produces: deployed function + smoke results
```

Tasks 4.1 and 4.2 are independent file creations that can run in parallel. Task 4.3 strictly depends on both.

## Execution Sequences

| Sequence | Tasks                | Parallel |
| -------- | -------------------- | -------- |
| 1        | Task 4.1, Task 4.2   | Yes      |
| 2        | Task 4.3             | No       |

## Tasks

### Task 4.1: Author `generate-og-image/index.js` (Satori VDOM + PNG encode + caching)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/generate-og-image/index.js
</files>

<action>
Create the Deno Edge Function. Follow the conventions of `supabase/functions/track-view/index.js` and `supabase/functions/onboard-company/index.js` exactly: JS only, 2-space indent, single quotes, no semicolons, trailing commas, JSDoc on the file header, inline `corsHeaders` (do NOT import `_shared/cors.js` — it does not exist in this repo; every existing function inlines).

Imports (use `npm:` Deno specifiers — this repo standardised on npm: not esm.sh):
- `import { createClient } from 'npm:@supabase/supabase-js@2'`
- `import satori from 'npm:satori@0.10.13'`
- `import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2'`
- Reuse `import { normalizeDomain } from '../_shared/logo-dev.js'` for the logo domain extraction.

Module-level top of file (cold-start only, all `await`ed at top level):
1. Initialize the resvg WASM: fetch `https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm` as ArrayBuffer and pass to `initWasm()`. Wrap in `try/catch`; if init fails, set a module-level `wasmReady = false` flag.
2. Fetch Inter Regular: `https://rsms.me/inter/font-files/Inter-Regular.woff` (Note: Satori needs TTF/OTF — use `https://github.com/rsms/inter/raw/v4.0/docs/font-files/Inter-Regular.otf` instead, or specifically `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf` which is TTF). Pick `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf` for Regular.
3. Fetch Inter Bold from `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf`. Both as ArrayBuffer, stored in module-scope consts `interRegular` and `interBold`.
4. Read the fallback PNG bytes once: `const fallbackPng = await Deno.readFile(new URL('./fallback.png', import.meta.url))`. Wrap in try/catch — if missing, `fallbackPng = null` and the error path will instead return a 1×1 transparent PNG inline (provide a tiny base64 const `MINIMAL_FALLBACK_PNG_BASE64` of a 1×1 PNG as last-resort).
5. Construct the Supabase client: `createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'))`.

Define `corsHeaders` (mirror `track-view`):
```
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
```

Helper `function fallbackResponse()`: returns a `Response` with body = `fallbackPng` (or the inline minimal PNG), `status: 200`, headers `{ ...corsHeaders, 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }`.

`Deno.serve(async (req) => { ... })`:
1. Handle `OPTIONS` → return `new Response('ok', { headers: corsHeaders })`.
2. If method is not `GET`, return `fallbackResponse()`.
3. Parse the URL path. The function URL shape is `/generate-og-image/og/<id>.png`. Extract the trailing path segment after `/og/` and strip `.png`. Validate it matches the UUID regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. On miss → `fallbackResponse()`.
4. Query: `supabase.from('map_startups').select('id, name, sector, stage, website').eq('id', id).maybeSingle()`. On null/error → `fallbackResponse()`.
5. Build the logo data URI: if `company.website` is set, call `normalizeDomain(company.website)`, then `fetch('https://img.logo.dev/{domain}?token=' + Deno.env.get('LOGO_DEV_TOKEN') + '&size=256')`. Convert response to ArrayBuffer, then to base64 with `btoa(String.fromCharCode(...new Uint8Array(buf)))` (chunk if needed for large buffers — chunk size 8192). Build `data:image/png;base64,<...>`. On any failure (no token, fetch failure, non-2xx, normalizeDomain returns null) set `logoDataUri = null` and the VDOM will skip the `<img>` and render a Utah-shape SVG fallback shape instead.
6. Build the Satori VDOM (plain JS objects of shape `{ type, props: { children, style, ... } }` — no JSX). Spec:
   - Outer: 1200×630, `display: 'flex'`, `flexDirection: 'column'`, `padding: 64`, `backgroundColor: '#0065A4'`, `color: 'white'`, `fontFamily: 'Inter'`, `justifyContent: 'space-between'`.
   - Top row: logo (96×96, `borderRadius: 16`, white background) — either `<img src={logoDataUri} />` or a fallback `<div>` with the letter `U` centered in Utah-blue.
   - Middle: company name as `<div>` with `fontSize: 72`, `fontWeight: 700`, max 2 lines (Satori auto-wraps; truncate company.name to 60 chars before passing).
   - Bottom row: two pills, `display: 'flex'`, `gap: 16`. Sector pill: `backgroundColor: '#10B981'`, `color: 'white'`, `padding: '8px 20px'`, `borderRadius: 999`, `fontSize: 24`, `fontWeight: 600`, text = `company.sector || 'Startup'`. Stage pill: `backgroundColor: 'white'`, `color: '#0065A4'`, same padding/radius/size, text = `company.stage || ''` (skip pill entirely if empty).
   - Footer-right: small text `utahstartups.com` at `fontSize: 18`, `opacity: 0.8`.
7. Render: `const svg = await satori(vdom, { width: 1200, height: 630, fonts: [{ name: 'Inter', data: interRegular, weight: 400, style: 'normal' }, { name: 'Inter', data: interBold, weight: 700, style: 'normal' }] })`.
8. Encode: if `wasmReady !== false`: `const png = new Resvg(svg).render().asPng()`. Otherwise → `fallbackResponse()`.
9. Return `new Response(png, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } })`.
10. Wrap the entire request body in `try/catch`; on any thrown error, `console.error('[generate-og-image]', err)` and return `fallbackResponse()`.

JSDoc the file header with: purpose, public URL shape, env vars consumed (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOGO_DEV_TOKEN`), and an example curl.
</action>

<verify>
1. File exists at `supabase/functions/generate-og-image/index.js` with the exact imports listed (`npm:@supabase/supabase-js@2`, `npm:satori@0.10.13`, `npm:@resvg/resvg-wasm@2.6.2`, `../_shared/logo-dev.js`).
2. `grep -n "Cache-Control" supabase/functions/generate-og-image/index.js` shows BOTH `'public, max-age=86400, s-maxage=86400'` (success path) AND `'no-cache'` (fallback path).
3. `grep -n "1200\|630" supabase/functions/generate-og-image/index.js` shows the 1200×630 dimensions are passed to Satori.
4. `grep -n "0065A4" supabase/functions/generate-og-image/index.js` shows the Utah-blue background hex is set on the outer VDOM div.
5. `grep -n "verify_jwt\|console\.log\|: any" supabase/functions/generate-og-image/index.js` — no TypeScript syntax (`: any`, `interface`, `type X =`).
6. No semicolons at line ends (matches repo convention): `grep -n "[a-zA-Z0-9'\"\\)]\\;$" supabase/functions/generate-og-image/index.js` should return 0 matches (allow `;` only inside JSDoc URL examples).
7. Domain complete: code review confirms — module-top font fetch (cached across invocations), UUID-validated path parsing, `maybeSingle()` lookup, Satori → resvg → PNG pipeline, success cache headers, fallback `no-cache`, all error paths route to `fallbackResponse()` (no 5xx ever returned for routine errors).
</verify>

<done>
`generate-og-image/index.js` exists, follows repo conventions (JS-only, npm: specifiers, inline corsHeaders, no semicolons), implements the full Satori → resvg → PNG pipeline with the exact cache headers, and routes every error path to a fallback PNG response with `Cache-Control: no-cache`.
</done>

---

### Task 4.2: Add static fallback PNG asset

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/generate-og-image/fallback.png
</files>

<action>
Create a 1200×630 static PNG to serve as the error/unknown-id fallback. Generate it with ImageMagick (already common on dev boxes; if unavailable, fall back to embedding a base64 minimal PNG as documented in Task 4.1's MINIMAL_FALLBACK_PNG_BASE64 const and skip this file — Task 4.1's file-read is already wrapped in try/catch).

Preferred command (one-liner; produces a Utah-blue card with white "Utah Startup Map" text):
```
convert -size 1200x630 xc:'#0065A4' -gravity center -fill white -font 'DejaVu-Sans-Bold' -pointsize 72 -annotate 0 'Utah Startup Map' supabase/functions/generate-og-image/fallback.png
```

Acceptable alternative if `convert` is not installed: use Python's Pillow (`pip install pillow`) with a 6-line script writing solid `#0065A4` background and centered "Utah Startup Map" text. If neither is available in the env, skip creating this file — Task 4.1's `Deno.readFile` will throw, the try/catch will set `fallbackPng = null`, and the inline `MINIMAL_FALLBACK_PNG_BASE64` will be used. Document the chosen path in the executor's task summary.

Do NOT commit a giant binary blob (>200KB). The flat-color PNG should be ~5–20 KB.
</action>

<verify>
1. EITHER: file exists at `supabase/functions/generate-og-image/fallback.png` AND `file supabase/functions/generate-og-image/fallback.png` reports `PNG image data, 1200 x 630` AND size < 200 KB.
2. OR: file does not exist AND `grep -n "MINIMAL_FALLBACK_PNG_BASE64" supabase/functions/generate-og-image/index.js` shows the inline base64 constant is defined and used in the `fallbackResponse()` helper as the second-tier fallback.
3. Domain complete: error path of the function has a non-empty PNG to return (either file-based or inline base64), confirmed by code path inspection.
</verify>

<done>
A 1200×630 fallback PNG is reachable from the Edge Function at runtime, either via colocated file or via inline base64 constant. The function's `fallbackResponse()` will never return an empty body.
</done>

---

### Task 4.3: Deploy via Supabase MCP and smoke-test the live URL

**Type:** auto
**Sequence:** 2

<files>
(no file changes — this is a deploy + observe task; record findings in `.project/features/0008/phases/phase-4/VERIFICATION.md`)
</files>

<action>
1. Deploy via the Supabase MCP tool `mcp__plugin_supabase_supabase__deploy_edge_function` with arguments:
   - `name: 'generate-og-image'`
   - `verify_jwt: false` (mirrors `track-view`, `onboard-company` — public-facing function)
   - `files`: array of `{ name: 'index.js', content: <file contents> }` AND, if `fallback.png` was created in Task 4.2, also include `{ name: 'fallback.png', content: <base64 contents> }` (binary asset; the MCP `deploy_edge_function` accepts raw file content — confirm format from the existing `track-view` deployment metadata; if MCP only accepts text, omit the PNG and rely on the inline `MINIMAL_FALLBACK_PNG_BASE64` constant from Task 4.1).
   - Also include `'_shared/logo-dev.js'` in the files payload (relative import from `../_shared/logo-dev.js` — Edge Function deploys must include all imported local modules).

2. If the MCP deploy is not authenticated in this run (mirrors Phase 3's pattern documented in `STATE.md` decisions log lines 52, 54, 55), DO NOT fail the task. Instead:
   - Mark deploy as **DEFERRED to ops smoke**.
   - Record the MCP error verbatim in `.project/features/0008/phases/phase-4/VERIFICATION.md`.
   - Document the exact command/payload the operator should run manually.
   - Continue to step 3 (the smoke test will be deferred too, but the test cases must still be written down).

3. Once deployed (or as a deferred ops checklist), run these smoke checks against `https://<project-ref>.functions.supabase.co/generate-og-image/og/<id>.png` (project ref is in `.env` or via MCP `get_project_url`):
   - **Smoke A (valid id, cold):** pick a real `map_startups.id` via MCP `execute_sql` (`select id, name from map_startups limit 1`). `curl -sI https://<...>/generate-og-image/og/<that-id>.png` — verify status 200, `content-type: image/png`, `cache-control: public, max-age=86400, s-maxage=86400`. Then `curl -s https://<...>/generate-og-image/og/<that-id>.png > /tmp/og.png && file /tmp/og.png` — verify `PNG image data, 1200 x 630`.
   - **Smoke B (valid id, warm):** repeat the same curl within seconds; verify `cf-cache-status: HIT` or `age: <n>` header (CDN cache active). Note: first request after cold deploy may not show HIT — re-run twice.
   - **Smoke C (invalid id):** `curl -sI https://<...>/generate-og-image/og/00000000-0000-0000-0000-000000000000.png` — verify status 200, `content-type: image/png`, `cache-control: no-cache`.
   - **Smoke D (malformed path):** `curl -sI https://<...>/generate-og-image/og/not-a-uuid.png` — verify status 200, `cache-control: no-cache` (fallback path).
   - **Manual social-validator checks (operator-only, not automatable):** paste `https://<...>/generate-og-image/og/<valid-id>.png` directly into LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/) and Twitter Card Validator (https://cards-dev.twitter.com/validator); confirm the preview shows the branded 1200×630 PNG. Note these as DEFERRED-MANUAL in VERIFICATION.md.

4. Write `.project/features/0008/phases/phase-4/VERIFICATION.md` with sections: deploy result (success or DEFERRED), Smoke A–D results (PASS / FAIL / DEFERRED), and a "manual ops follow-ups" list with the LinkedIn + Twitter validator URLs.
</action>

<verify>
1. EITHER: MCP `deploy_edge_function` returned a function id and version, AND Smoke A returned `200 image/png` with `cache-control: public, max-age=86400, s-maxage=86400`, AND Smoke C returned `200 image/png cache-control: no-cache`.
2. OR: MCP was unauthenticated; `phase-4/VERIFICATION.md` documents the deferred deploy with the exact MCP payload an operator can fire, and lists Smokes A–D as DEFERRED with the curl commands ready to copy-paste.
3. Domain complete: the function is either live and proven to return 1200×630 PNGs with the right cache headers for both success and fallback paths, OR every step is captured in VERIFICATION.md as a runnable ops checklist mirroring Phase 3's deferred pattern.
</verify>

<done>
`generate-og-image` is deployed and smoke-tested with all four curl checks recorded; OR a complete deferred-ops checklist is written to `phase-4/VERIFICATION.md` with copy-paste-ready commands and the MCP error logged.
</done>

---

## Verification Checklist

Phase-level checks (lift directly from ROADMAP success criteria, lines 173–177). Items marked **[runtime]** require a deployed function and may be DEFERRED to ops smoke if MCP auth is unavailable, mirroring the Phase 3 pattern documented in `STATE.md` decisions log.

- [ ] **[code]** `supabase/functions/generate-og-image/index.js` exists, imports `npm:satori@0.10.13`, `npm:@resvg/resvg-wasm@2.6.2`, `npm:@supabase/supabase-js@2`, and `../_shared/logo-dev.js`.
- [ ] **[code]** Outer VDOM `style.backgroundColor` is the literal string `'#0065A4'`; sector pill is `'#10B981'`; stage pill is `'white'` with `'#0065A4'` text.
- [ ] **[code]** Satori is called with `{ width: 1200, height: 630, fonts: [...] }` and both Inter Regular (weight 400) and Inter Bold (weight 700) are passed.
- [ ] **[code]** Inter font ArrayBuffers are fetched once at module top-level and held in module-scope constants (cached across invocations).
- [ ] **[code]** Success response has `Cache-Control: public, max-age=86400, s-maxage=86400` and `Content-Type: image/png`.
- [ ] **[code]** Fallback response (used for: invalid UUID, unknown id, DB error, logo fetch failure not handled inline, satori/resvg throw, any unhandled exception) returns 200 `image/png` with `Cache-Control: no-cache`.
- [ ] **[code]** Either `supabase/functions/generate-og-image/fallback.png` exists at 1200×630, OR the inline `MINIMAL_FALLBACK_PNG_BASE64` constant is defined and used as a second-tier fallback.
- [ ] **[code]** No TypeScript (`: any`, `interface`, `type X =`); single quotes; no trailing semicolons; 2-space indent; trailing commas — matches `track-view/index.js` style.
- [ ] **[code]** `console.error` (not `console.log` for normal flow) is used for the unhandled-error catch — `console.log` is acceptable for cold-start font/wasm bootstrap diagnostics.
- [ ] **[runtime]** MCP `deploy_edge_function` succeeds with `verify_jwt=false`; function id + version recorded in VERIFICATION.md.
- [ ] **[runtime]** Smoke A: `GET /generate-og-image/og/<valid-uuid>.png` → 200, `image/png`, `cache-control: public, max-age=86400, s-maxage=86400`, body is a valid 1200×630 PNG.
- [ ] **[runtime]** Smoke B: warm-cache hit on second request (verifiable via `cf-cache-status: HIT` or `age` header).
- [ ] **[runtime]** Smoke C: `GET /generate-og-image/og/<unknown-uuid>.png` → 200, `image/png`, `cache-control: no-cache`.
- [ ] **[runtime]** Smoke D: `GET /generate-og-image/og/not-a-uuid.png` → 200, `image/png`, `cache-control: no-cache` (path validation rejects, fallback served).
- [ ] **[runtime, manual]** LinkedIn Post Inspector renders the branded card preview when given a URL whose `og:image` points at the function (deferred to Phase 5 wiring; operator manual check).
- [ ] **[runtime, manual]** Twitter Card Validator renders the branded card preview (same caveat).

## Success Criteria

Phase 4 is complete when:
1. `supabase/functions/generate-og-image/index.js` and (preferably) `fallback.png` exist on disk and pass every **[code]** check above.
2. EITHER the MCP deploy succeeded and Smokes A–D returned the expected status/headers/PNG dimensions, OR a deferred-ops checklist is written to `.project/features/0008/phases/phase-4/VERIFICATION.md` mirroring Phase 3's deferred pattern.
3. STATE.md is updated to mark Phase 4 complete (or "code-complete; deploy deferred") with the function id from MCP if available.
4. Phase 5 (`useShareCard` composable + drawer Share button) is unblocked: the `ogImageUrl` it constructs has a real, reachable URL shape to point at.
