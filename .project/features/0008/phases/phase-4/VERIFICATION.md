# VERIFICATION — Feature 0008 Phase 4
# Satori OG Image Edge Function — generate-og-image

**Date:** 2026-05-09
**Phase:** Phase 4 — Satori OG Image Edge Function
**Executor:** Claude Sonnet 4.6 (single executor, simple mode, inline_verify=true)

---

## Task 4.1 Inline Verify Results

All 7 verify checks PASS:

| # | Check | Result |
|---|-------|--------|
| 1 | Imports: `npm:@supabase/supabase-js@2`, `npm:satori@0.10.13`, `npm:@resvg/resvg-wasm@2.6.2`, `../_shared/logo-dev.js` | PASS |
| 2 | `Cache-Control` grep shows BOTH `'public, max-age=86400, s-maxage=86400'` (line 346) AND `'no-cache'` (line 96) | PASS |
| 3 | `1200` / `630` appear as VDOM style values (lines 248–249) and in satori call (lines 327–328) | PASS |
| 4 | `0065A4` appears as `backgroundColor` on outer VDOM div (line 253) and as text `color` on pills/letter fallback | PASS |
| 5 | No TypeScript (no `: any`, `interface`, `type X =`); `console.log` lines are cold-start diagnostics only | PASS |
| 6 | Zero trailing semicolons at line ends (grep returned 0 matches) | PASS |
| 7 | Domain complete: module-top font fetch (cached), UUID-validated path parsing, `maybeSingle()` lookup, Satori→resvg→PNG pipeline, success/fallback cache headers, every error routes to `fallbackResponse()` | PASS |

---

## Task 4.2 Inline Verify Results

`convert` (ImageMagick) not present in sandbox. `pip`/`pip3`/`python3 -m pip` all unavailable; cannot install Pillow.

**Path taken:** SKIP file creation — inline base64 fallback path.

| # | Check | Result |
|---|-------|--------|
| 1 | `fallback.png` does not exist | EXPECTED (tools unavailable) |
| 2 | `MINIMAL_FALLBACK_PNG_BASE64` const defined at line 31, used in `fallbackResponse()` at line 90 | PASS |
| 3 | Error path: `fallbackPng = null` (try/catch at line 62–66), `fallbackResponse()` returns `Uint8Array` decoded from inline base64 — never empty body | PASS |

---

## Task 4.3 — Deploy Result

**Status: DEFERRED**

MCP tools (`mcp__plugin_supabase_supabase__deploy_edge_function`, `mcp__plugin_supabase_supabase__execute_sql`) are available only in the top-level Claude context; they are not directly callable from within a sub-agent executor. This mirrors the documented deferred pattern (STATE.md decisions log lines 52–55).

### MCP Deploy Payload (copy-paste ready)

```json
{
  "name": "generate-og-image",
  "verify_jwt": false,
  "files": [
    {
      "name": "index.js",
      "content": "<contents of supabase/functions/generate-og-image/index.js>"
    },
    {
      "name": "_shared/logo-dev.js",
      "content": "<contents of supabase/functions/_shared/logo-dev.js>"
    }
  ]
}
```

**Note:** No `fallback.png` file to include — the function uses the inline `MINIMAL_FALLBACK_PNG_BASE64` constant as its second-tier fallback.

**Note on `_shared/logo-dev.js` path:** The function imports `'../_shared/logo-dev.js'`. When deploying, pass the file with name `'_shared/logo-dev.js'` — Supabase Edge Function deploy bundles it relative to the function root. Verify this against how `track-view` handles shared imports if the function errors at boot.

### Operator Steps (manual deploy via MCP or CLI)

**Option A — MCP (if authenticated in Claude UI):**
Open Claude with Supabase MCP and call:
```
mcp__plugin_supabase_supabase__deploy_edge_function({
  name: "generate-og-image",
  verify_jwt: false,
  files: [
    { name: "index.js", content: <full contents of supabase/functions/generate-og-image/index.js> },
    { name: "_shared/logo-dev.js", content: <full contents of supabase/functions/_shared/logo-dev.js> }
  ]
})
```

**Option B — Supabase CLI:**
```bash
# From repo root
supabase functions deploy generate-og-image --no-verify-jwt
```

**Option C — curl (REST API deploy):**
```bash
# Requires SUPABASE_ACCESS_TOKEN (personal access token from app.supabase.com/account/tokens)
curl -X POST "https://api.supabase.com/v1/projects/punpjzwxqazqbxvkyemv/functions" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"generate-og-image","name":"generate-og-image","verify_jwt":false}'
```

### Environment Variables Required

Ensure these are set on the project (via Supabase Dashboard > Project Settings > Edge Functions):
- `SUPABASE_URL` — auto-injected by Supabase (no action needed)
- `SUPABASE_ANON_KEY` — auto-injected by Supabase (no action needed)
- `LOGO_DEV_TOKEN` — set to your img.logo.dev public token (function works without it; logos fall back to letter 'U')

---

## Smoke Tests

**Project ref:** `punpjzwxqazqbxvkyemv`
**Base URL:** `https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1`
**Real startup ID (for Smoke A/B):** `026e634b-45bd-4173-8c05-85639aeca08e` (Metrodora Institute)

### Smoke A — Valid id, cold request

**Status: DEFERRED** (function not yet deployed)

Expected:
- HTTP 200
- `content-type: image/png`
- `cache-control: public, max-age=86400, s-maxage=86400`
- PNG body is 1200×630

Copy-paste command (run after deploy):
```bash
# Header check
curl -sI "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/026e634b-45bd-4173-8c05-85639aeca08e.png"

# Body check (verify PNG dimensions)
curl -s "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/026e634b-45bd-4173-8c05-85639aeca08e.png" > /tmp/og.png && file /tmp/og.png
# Expected: /tmp/og.png: PNG image data, 1200 x 630, ...
```

### Smoke B — Valid id, warm request (CDN cache hit)

**Status: DEFERRED** (function not yet deployed)

Run Smoke A command twice within seconds; second response should show:
- `cf-cache-status: HIT` OR `age: <n>` where n > 0

```bash
# Run twice
curl -sI "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/026e634b-45bd-4173-8c05-85639aeca08e.png"
curl -sI "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/026e634b-45bd-4173-8c05-85639aeca08e.png"
```

### Smoke C — Invalid (unknown) UUID

**Status: DEFERRED** (function not yet deployed)

Expected:
- HTTP 200
- `content-type: image/png`
- `cache-control: no-cache`

```bash
curl -sI "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/00000000-0000-0000-0000-000000000000.png"
```

### Smoke D — Malformed path (not a UUID)

**Status: DEFERRED** (function not yet deployed)

Expected:
- HTTP 200
- `content-type: image/png`
- `cache-control: no-cache`

```bash
curl -sI "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/not-a-uuid.png"
```

---

## Manual Social Validator Checks (Operator — Deferred to Phase 5)

Once the function is deployed and Phase 5 wires up `og:image` meta tags:

1. **LinkedIn Post Inspector:**
   https://www.linkedin.com/post-inspector/
   Paste URL: `https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/generate-og-image/og/<valid-id>.png`
   Confirm: branded 1200×630 card renders, shows company name + sector pill + Utah-blue background.

2. **Twitter Card Validator:**
   https://cards-dev.twitter.com/validator
   Paste URL: same as above.
   Confirm: card preview renders without errors.

---

## Decisions During Execution

| Decision | Rationale |
|----------|-----------|
| `fallback.png` skipped — inline base64 used | `convert` (ImageMagick) and `pip`/`pip3`/`python3 -m pip` all absent from sandbox. The inline `MINIMAL_FALLBACK_PNG_BASE64` const (1×1 transparent PNG) in `index.js` is the designated fallback per PLAN.md Task 4.2 spec. |
| MCP deploy deferred | Sub-agent executor does not have direct access to `mcp__plugin_supabase_supabase__deploy_edge_function` — MCP tools only callable from top-level Claude context. Operator can deploy via CLI or MCP from the Claude UI. |
| `_shared/logo-dev.js` in deploy payload | `index.js` uses a relative import `'../_shared/logo-dev.js'`; Supabase Edge Function deploy must bundle all local imports. |
| Project ref confirmed: `punpjzwxqazqbxvkyemv` | Read from `goed/.env.local` VITE_SUPABASE_URL value. |
| Real startup ID from REST API: `026e634b-45bd-4173-8c05-85639aeca08e` (Metrodora Institute) | Fetched via `GET /rest/v1/map_startups?select=id,name&limit=1` with anon key. |

---

## Phase-Level Verification Checklist

(From PLAN.md §Verification Checklist, lines 213–232)

| Item | Type | Status | Notes |
|------|------|--------|-------|
| `index.js` exists and imports all 4 required packages | `[code]` | PASS | Lines 22–25 confirmed |
| Outer VDOM `backgroundColor: '#0065A4'`; sector pill `'#10B981'`; stage pill `'white'` with `'#0065A4'` text | `[code]` | PASS | Lines 253, 215, 233 confirmed |
| Satori called with `{ width: 1200, height: 630, fonts: [...] }` with both Inter weights | `[code]` | PASS | Lines 326–333 confirmed |
| Inter ArrayBuffers fetched once at module top-level in module-scope consts | `[code]` | PASS | Lines 51–59: `interRegular` and `interBold` as top-level awaited consts |
| Success response: `Cache-Control: public, max-age=86400, s-maxage=86400` + `Content-Type: image/png` | `[code]` | PASS | Lines 344–347 confirmed |
| Fallback response: 200 `image/png` with `Cache-Control: no-cache` for all error paths | `[code]` | PASS | Lines 91–98; all 8 error paths call `fallbackResponse()` |
| Either `fallback.png` exists at 1200×630 OR inline `MINIMAL_FALLBACK_PNG_BASE64` defined and used | `[code]` | PASS | Inline const at line 31, used in `fallbackResponse()` at line 90 |
| No TypeScript; single quotes; no trailing semicolons; 2-space indent; trailing commas | `[code]` | PASS | grep confirmed 0 trailing semicolons; style matches `track-view` |
| `console.error` for unhandled errors; `console.log` only for cold-start diagnostics | `[code]` | PASS | Line 351: `console.error('[generate-og-image]', err)` in catch; log lines 45, 54, 59, 65 are bootstrap only |
| MCP `deploy_edge_function` succeeds; function id + version recorded | `[runtime]` | DEFERRED | Sub-agent cannot call MCP tools directly |
| Smoke A: valid UUID → 200 `image/png` `cache-control: public, max-age=86400` | `[runtime]` | DEFERRED | Awaits deploy; curl command ready above |
| Smoke B: warm cache hit on second request | `[runtime]` | DEFERRED | Awaits deploy; curl commands ready above |
| Smoke C: unknown UUID → 200 `image/png` `cache-control: no-cache` | `[runtime]` | DEFERRED | Awaits deploy; curl command ready above |
| Smoke D: malformed path → 200 `image/png` `cache-control: no-cache` | `[runtime]` | DEFERRED | Awaits deploy; curl command ready above |
| LinkedIn Post Inspector renders branded card | `[runtime, manual]` | DEFERRED | Operator check post Phase 5 wiring; URL above |
| Twitter Card Validator renders branded card | `[runtime, manual]` | DEFERRED | Operator check post Phase 5 wiring; URL above |

**Summary:** 9/9 `[code]` checks PASS. 6/6 `[runtime]` checks DEFERRED (deploy pending). Phase is code-complete.
