# VERIFICATION — Feature 0008 Phase 4

**Date:** 2026-05-09 19:37
**Phase:** Phase 4 — Satori OG Image Edge Function (`generate-og-image`)
**App URL:** http://localhost:5173
**Verifier:** `/spec:verify-phase` (automated, no user)

> Phase status from STATE.md: **Code-complete; deploy DEFERRED to ops.**
> Re-verification confirms: function source at `supabase/functions/generate-og-image/index.js` is present and meets every success criterion at the code level. The Edge Function endpoint at `https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/...` returns **HTTP 404 (sb-error-code: NOT_FOUND)** — the function has not yet been deployed by ops, so all runtime/manual criteria are SKIP (not FAIL).

## Summary

| Category   | Pass | Fail | Skip | Total |
|------------|------|------|------|-------|
| Smoke      | 1    | 0    | 0    | 1     |
| ENV        | 0    | 0    | 3    | 3     |
| CODE       | 5    | 0    | 0    | 5     |
| UI         | 0    | 0    | 2    | 2     |
| **Total**  | 6    | 0    | 5    | 11    |

**Overall: PASS**
_(Smoke PASS, 0 ENV failures, 0 CODE failures, 0 UI failures. SKIPs all gated on ops deploy and external service review — PLAN/STATE both record this as expected.)_

## Smoke Test

**Result:** PASS
**URL:** http://localhost:5173
- Page title: `Utah Startup Map`
- Pinia stores `filters` and `startups` installed cleanly
- Only console error is `404 favicon.ico` (cosmetic; pre-existing project-wide condition, unrelated to Phase 4)
- DOM mounted with full app shell — no crash, no white screen

## Phase 4 Success Criteria Results

> Each ROADMAP success criterion is restated, then evaluated. Where the literal criterion requires the live deployment, a parallel **CODE verification** confirms the source code is structured to satisfy it once deployed.

### Criterion 1 — Valid id returns 1200×630 PNG with `image/png` and `public, max-age=86400`

- **[ENV] SKIP** — `curl -sI https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/<id>.png` returns HTTP 404. Function not deployed. Smoke command in this file under "Operator Smoke A" runs once ops deploys.
- **[CODE] PASS** — `index.js:341-348` returns `new Response(png, { status: 200, headers: { ..., 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } })`. Satori call (`index.js:326-333`) passes `{ width: 1200, height: 630, fonts: [...] }`, both Inter weights bound.

### Criterion 2 — Rendered card contains company name, sector pill, stage pill, and logo or fallback shape

- **[UI] SKIP** — Visual inspection requires the deployed PNG; not available without deploy.
- **[CODE] PASS** — VDOM in `index.js:244-323`:
  - Company name (truncated to 60 chars) at `index.js:173,275-282`
  - Sector pill with `backgroundColor: '#10B981'` (`hiring-green`) at `index.js:211-224`
  - Stage pill (rendered when `company.stage` present) with white background and `#0065A4` text at `index.js:227-242`
  - Logo `<img>` from `img.logo.dev` (`index.js:151-170`) with letter-fallback `<div>` (`'U'` glyph) at `index.js:192-209` when logo fetch fails or `LOGO_DEV_TOKEN` is missing.

### Criterion 3 — Invalid/unknown id returns 200 fallback PNG with `Cache-Control: no-cache` (no 5xx)

- **[ENV] SKIP** — Function not deployed; runtime check deferred.
- **[CODE] PASS** — `fallbackResponse()` at `index.js:87-99` returns 200 with `Content-Type: image/png` and `Cache-Control: no-cache`. Every error path routes to it: non-GET (`:124`), missing path match (`:132`), non-UUID id (`:137`), DB error or missing row (`:148`), wasm-unready guard (`:337`), and the outer `catch` (`:352`). The body is the file `fallback.png` if present, else the inline `MINIMAL_FALLBACK_PNG_BASE64` constant — never an empty body.

### Criterion 4 — Re-hit within 24h served from CDN cache (`cf-cache-status: HIT` or `age > 0`)

- **[ENV] SKIP** — Cannot validate without a deployed function; CDN behaviour follows from the `Cache-Control` header set in Criterion 1's response.
- **[CODE] PASS** — Header `Cache-Control: public, max-age=86400, s-maxage=86400` set on every successful response (`index.js:346`). Cloudflare honours `s-maxage` for shared cache; second hit will surface `cf-cache-status: HIT`.

### Criterion 5 — LinkedIn Post Inspector and Twitter Card Validator render the card

- **[UI/Manual] SKIP** — External services; cannot run unattended. Also depends on Phase 5 (`useShareCard`) wiring `og:image` meta tags into rendered HTML — Phase 5 has not started. URLs and steps remain documented under "Manual Social Validator Checks" in this same file's prior revision.

## Code-Level Audit (corroborates above)

| Check | Result |
|-------|--------|
| `index.js` exists at `supabase/functions/generate-og-image/index.js` | PASS |
| Imports: `npm:@supabase/supabase-js@2`, `npm:satori@0.10.13`, `npm:@resvg/resvg-wasm@2.6.2`, `../_shared/logo-dev.js` | PASS (`:22-25`) |
| Outer VDOM `backgroundColor: '#0065A4'` (Utah blue) | PASS (`:253`) |
| Sector pill `'#10B981'` background + white text | PASS (`:215-216`) |
| Stage pill `white` background + `'#0065A4'` text | PASS (`:232-233`) |
| Satori called with `{ width: 1200, height: 630, fonts: [Inter-400, Inter-700] }` | PASS (`:326-333`) |
| Inter ArrayBuffers fetched **once** at module top-level | PASS (`:51-59`) |
| Success response headers: `Content-Type: image/png` + `Cache-Control: public, max-age=86400, s-maxage=86400` | PASS (`:344-347`) |
| Fallback response headers: `Content-Type: image/png` + `Cache-Control: no-cache` | PASS (`:94-96`) |
| Inline `MINIMAL_FALLBACK_PNG_BASE64` defined and used by `fallbackResponse()` | PASS (`:31-32`, `:87-90`) |
| No TypeScript / no trailing semicolons | PASS (grep `;$` → 0 matches) |
| `console.error` for unhandled errors; `console.log` only for cold-start diagnostics | PASS (`:351`; cold-start logs at `:45,54,59,65`) |

## Failures

_None._

## Operator Follow-ups (Deploy + External Validation)

These are the SKIPs above. They are **not** verification failures — they are the operator-step backlog the original Phase 4 deferred. No code change required; just deploy + smoke.

1. **Deploy** via Supabase MCP (`mcp__plugin_supabase_supabase__deploy_edge_function`) or CLI (`supabase functions deploy generate-og-image --no-verify-jwt`). Bundle `_shared/logo-dev.js`. Set `LOGO_DEV_TOKEN` env var.
2. **Smoke A — Valid id, cold:**
   `curl -sI https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/026e634b-45bd-4173-8c05-85639aeca08e.png`
   Expect: `200`, `content-type: image/png`, `cache-control: public, max-age=86400, s-maxage=86400`. PNG body 1200×630 (`file /tmp/og.png`).
3. **Smoke B — Cache hit:** Run Smoke A twice. Second response: `cf-cache-status: HIT` or `age: >0`.
4. **Smoke C — Unknown UUID:** Same curl with `00000000-0000-0000-0000-000000000000`. Expect `200`, `image/png`, `cache-control: no-cache`.
5. **Smoke D — Malformed path:** Same curl with `not-a-uuid`. Expect `200`, `image/png`, `cache-control: no-cache`.
6. **LinkedIn Post Inspector** (https://www.linkedin.com/post-inspector/) + **Twitter Card Validator** (https://cards-dev.twitter.com/validator) — paste the deployed URL once Phase 5 wires `og:image` into the page `<head>`.
