# Feature Plan: AI Onboarding — Phase 3: onboard-company Edge Function

## Objective

Build the public-facing `onboard-company` Edge Function that drives the entire AI submission pipeline. The function accepts a POST `{ url, email? }` from the public Vue frontend, runs `runEnrichmentPipeline` (already shipped in Phase 2), evaluates the result through a Utah-focused quality gate, and writes the company to either `map_startups` (auto-publish) or `map_startup_submissions` (pending human review). All four files for the function (`utah-bounds.js`, `quality-gate.js`, `prompts.js`, `index.js`) live under `supabase/functions/onboard-company/` and are JavaScript Deno modules that import shared logic from `../_shared/`.

**Purpose:** Close the loop on AI-driven onboarding so a founder pasting a URL gets either an auto-published map pin (Utah company with complete data) or a pending submission (incomplete or non-Utah).
**Output:** Four files under `supabase/functions/onboard-company/` plus a deployable Edge Function callable via `supabase functions invoke onboard-company`.

## Must-Haves (Goal-Backward)

### Observable Truths (provable in this phase)

- A POST `{ url, email }` to the deployed function returns a JSON body with `status: 'auto_published'` or `status: 'pending'` (never an unhandled exception).
- A complete Utah company (name + address + sector + description + Utah lat/lng) ends up in `map_startups` with `verified = false`, plus a sibling row in `map_startup_submissions` with `status = 'auto_published'`.
- An incomplete or non-Utah company ends up in `map_startup_submissions` with `status = 'pending'` and a non-null `rejection_reason`.
- Submitting the same URL twice does not duplicate the `map_startups` row; the second call returns the same `startup_id`.
- Malformed input (missing `url`, non-URL string) returns HTTP 400 with `{ error, code }` shape per Edge Function convention.
- The function responds to OPTIONS preflight with appropriate CORS headers so the Vue frontend in `goed/` can call it from the browser.

### Required Artifacts

| Path | Provides | Key Exports |
|---|---|---|
| `supabase/functions/onboard-company/utah-bounds.js` | Utah geographic validation | `isInsideUtah({ lat, lng })`, `verifyUtahState(nominatimResult)` |
| `supabase/functions/onboard-company/quality-gate.js` | Auto-publish vs. pending decision | `runQualityGate(record, supabaseClient)` returning `{ passed, reason }` |
| `supabase/functions/onboard-company/prompts.js` | Claude gap-fill prompt assets (reserved for direct LLM calls if pipeline doesn't fill) | `SYSTEM_PROMPT`, `buildUserPrompt(html, partialRecord)`, `OUTPUT_SCHEMA` |
| `supabase/functions/onboard-company/index.js` | HTTP entry point — orchestrates pipeline + gate + DB writes | `Deno.serve(handler)` (no named exports) |

### Key Links

| From | To | Via |
|---|---|---|
| `index.js` | `runEnrichmentPipeline` | `import { runEnrichmentPipeline } from '../_shared/pipeline.js'` |
| `index.js` | `runQualityGate` | `import { runQualityGate } from './quality-gate.js'` |
| `quality-gate.js` | `isInsideUtah` | `import { isInsideUtah, verifyUtahState } from './utah-bounds.js'` |
| `index.js` | Supabase | `import { createClient } from 'npm:@supabase/supabase-js@2'` using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars |
| `index.js` → `map_startups` | Upsert keyed on normalized domain | Read existing row first; insert if absent, return existing id if present |
| `index.js` → `map_startup_submissions` | Insert audit/queue row | Always inserted, with `status='auto_published'` or `'pending'` |
| `quality-gate.js` → `map_startups` + `map_startup_submissions` | Duplicate detection query | `select` by website domain match (case-insensitive `ilike`) and exact-name match |

## Dependency Graph

```
Task 3.1 (utah-bounds.js + quality-gate.js + prompts.js)
   ↓
Task 3.2 (index.js)  — imports the three files from 3.1
```

## Execution Sequences

| Sequence | Tasks | Parallel |
|---|---|---|
| 1 | Task 3.1 | No (single task creates 3 files) |
| 2 | Task 3.2 | No (single task) |

---

## Tasks

### Task 3.1: Create the three support modules (utah-bounds, quality-gate, prompts)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/onboard-company/utah-bounds.js
supabase/functions/onboard-company/quality-gate.js
supabase/functions/onboard-company/prompts.js
</files>

<action>
Create the three support modules that `index.js` will import. All three are pure-JS Deno modules with JSDoc on every exported function. Use 2-space indentation, single quotes, no trailing semicolons (match existing `_shared/` style).

**1. `utah-bounds.js`** — geographic validation helpers, no external dependencies.
- Export `isInsideUtah({ lat, lng })`: returns `true` only if both numbers are finite AND `lat` is in `[37.0, 42.0]` AND `lng` is in `[-114.05, -109.05]`. Anything missing or out of range returns `false`.
- Export `verifyUtahState(nominatimResult)`: accepts a Nominatim geocode result object (same shape produced by `_shared/nominatim.js` — has an `address` sub-object). Returns `true` if `result.address.state` is exactly `'Utah'` (case-insensitive) or `result.address.state_code === 'UT'`. Returns `false` for any other state, missing `address`, or null input.
- Both functions are defensive: never throw on malformed input.

**2. `quality-gate.js`** — auto-publish decision logic.
- Import `isInsideUtah` from `./utah-bounds.js`.
- Export `async function runQualityGate(record, supabaseClient)` which performs these checks in order, returning `{ passed: false, reason: '<human readable>' }` on the first failure or `{ passed: true, reason: null }` if all pass:
  1. **Required fields:** `record.name`, `record.address`, `record.sector`, `record.description` must all be non-null, non-empty strings (after `.trim()`). Reason on fail: `'Missing required fields: <comma-separated list>'`.
  2. **Utah bounds:** `isInsideUtah({ lat: record.lat, lng: record.lng })` must return `true`. Reason on fail: `'Coordinates are outside Utah bounding box (lat=<x>, lng=<y>)'`.
  3. **Duplicate check:** Compute the normalized domain from `record.website` using `normalizeDomain` imported from `../_shared/logo-dev.js`. Then:
     - Query `map_startups` where `website ilike '%<domain>%'` OR `name ilike <record.name>` (case-insensitive). If any row is returned, reason: `'Duplicate: company already exists in map_startups (id=<existing.id>)'` and attach `existing_id: existing.id` to the returned object so the caller can return the existing id.
     - Query `map_startup_submissions` where `website ilike '%<domain>%'` AND `status in ('pending','auto_published')`. If any rows match, reason: `'Duplicate: pending or auto-published submission already exists for this domain'`.
  4. **Utah DCC active check:** if `record.dcc_status` is non-null AND not equal to `'Active'`, fail with reason `'Utah DCC status is "<dcc_status>" (must be "Active" if present)'`. If `dcc_status` is null, skip this check (DCC simply didn't return data — not a failure).
- The returned object MAY include `existing_id` when a duplicate `map_startups` row was found; callers use it to short-circuit and return the existing record.
- JSDoc on every export. Document the return shape `{ passed: boolean, reason: string | null, existing_id?: string }`.

**3. `prompts.js`** — Claude gap-fill prompt assets. (Note: pipeline already does its own gap-fill; these exports exist so future direct-LLM extraction paths can reuse them and to satisfy roadmap requirements.)
- Export `SYSTEM_PROMPT` (string constant): instructs Claude to extract only fields not already in the partial record from website HTML, return JSON matching the schema, and never invent data not present in the HTML. Mention that for `sector` it must use one of: `fintech, healthtech, edtech, cleantech, enterprise-software, consumer, ecommerce, logistics, biotech, ai-ml, cybersecurity, other`. For `stage`: `idea, pre-seed, seed, series-a, series-b, growth, public, other`.
- Export `function buildUserPrompt(html, partialRecord)`: returns a string that includes (a) the partial record JSON-stringified, (b) a list of which top-level keys are still null/missing in `partialRecord`, (c) the HTML truncated to 8000 characters with a `[truncated]` suffix if longer.
- Export `OUTPUT_SCHEMA` (object constant): a JSON Schema describing the expected response shape — `{ type: 'object', properties: { name, description, sector, stage, founded_year, address }, required: [], additionalProperties: false }`. Each property is a nullable string except `founded_year` which is a nullable integer. JSDoc on `buildUserPrompt`.
</action>

<verify>
1. All three files exist:
   - `supabase/functions/onboard-company/utah-bounds.js`
   - `supabase/functions/onboard-company/quality-gate.js`
   - `supabase/functions/onboard-company/prompts.js`
2. `deno check supabase/functions/onboard-company/utah-bounds.js supabase/functions/onboard-company/quality-gate.js supabase/functions/onboard-company/prompts.js` exits with code 0 (no syntax errors). If `deno` is not installed locally, `node --check` on each file as a fallback (since they are plain ES modules without Deno-specific syntax other than imports).
3. Spot-check exports with grep:
   - `grep -E "^export" supabase/functions/onboard-company/utah-bounds.js` shows `isInsideUtah` and `verifyUtahState`.
   - `grep -E "^export" supabase/functions/onboard-company/quality-gate.js` shows `runQualityGate`.
   - `grep -E "^export" supabase/functions/onboard-company/prompts.js` shows `SYSTEM_PROMPT`, `buildUserPrompt`, `OUTPUT_SCHEMA`.
4. JSDoc present: `grep -c "@param\|@returns" supabase/functions/onboard-company/quality-gate.js` returns >= 2.
5. Bounds smoke check (paste in a Deno REPL or `node --input-type=module`):
   `import { isInsideUtah } from './supabase/functions/onboard-company/utah-bounds.js'; console.log(isInsideUtah({ lat: 40.76, lng: -111.89 }), isInsideUtah({ lat: 37.77, lng: -122.41 }))` prints `true false`.
</verify>

<done>
Three support modules exist, parse cleanly, and export the documented public API. No `index.js` yet — that is Task 3.2.
</done>

---

### Task 3.2: Create the onboard-company Edge Function entry point (`index.js`)

**Type:** auto
**Sequence:** 2

<files>
supabase/functions/onboard-company/index.js
</files>

<action>
Create the HTTP handler that ties the pipeline, quality gate, and database writes together. This is the public-facing Edge Function. Use the Deno runtime (`Deno.serve`), import `createClient` from `npm:@supabase/supabase-js@2`, and follow the same code style as `supabase/functions/_shared/pipeline.js` (2-space indent, single quotes, semicolons match that file's style — pipeline.js uses semicolons, so this file should also use semicolons for consistency with sibling Edge Function code).

**Top-of-file JSDoc:** brief description plus a usage example invoking the function with curl.

**Imports:**
```js
import { createClient } from 'npm:@supabase/supabase-js@2'
import { runEnrichmentPipeline } from '../_shared/pipeline.js'
import { normalizeDomain } from '../_shared/logo-dev.js'
import { runQualityGate } from './quality-gate.js'
```
(`prompts.js` and `utah-bounds.js` are NOT imported here — they are reached transitively via `quality-gate.js` and reserved for direct-LLM extraction.)

**CORS headers constant:**
```js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

**Helper `jsonResponse(body, status = 200)`** that returns a `Response` with `Content-Type: application/json` plus `corsHeaders`.

**Helper `errorResponse(code, message, status)`** that returns `jsonResponse({ error: message, code }, status)`. Use error codes: `INVALID_INPUT` (400), `INTERNAL_ERROR` (500).

**Handler body inside `Deno.serve(async (req) => { ... })`:**

1. **CORS preflight:** if `req.method === 'OPTIONS'`, return `new Response('ok', { headers: corsHeaders })`.
2. **Method guard:** if `req.method !== 'POST'`, return `errorResponse('INVALID_INPUT', 'Only POST is supported', 405)`.
3. **Parse body:** wrap `await req.json()` in try/catch. On JSON parse failure return `errorResponse('INVALID_INPUT', 'Body must be valid JSON', 400)`.
4. **Validate `url`:** must be a non-empty string and parseable by `new URL(url)`. On failure return `errorResponse('INVALID_INPUT', 'Field "url" is required and must be a valid URL', 400)`. `email` is optional (string or undefined; if present and not a string, fail with `INVALID_INPUT`).
5. **Create Supabase client:** `const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))`. If either env var is missing, return `errorResponse('INTERNAL_ERROR', 'Supabase env not configured', 500)`.
6. **Run pipeline:** wrap `const record = await runEnrichmentPipeline({ url, email })` in try/catch; on exception return `errorResponse('INTERNAL_ERROR', 'Enrichment pipeline failed', 500)` and `console.error` the original error.
7. **Run quality gate:** `const gateResult = await runQualityGate(record, supabaseClient)`.
8. **On gate FAIL:**
   - If `gateResult.existing_id` is set (duplicate of existing `map_startups` row), insert a row into `map_startup_submissions` with `status: 'auto_published'`, `submitted_url: url`, `submitted_by_email: email ?? null`, `extracted_data: record`, `rejection_reason: null`, `reviewed_by: 'auto'`, `reviewed_at: new Date().toISOString()`, plus the scalar columns from `record` (name, description, website, address, city, lat, lng, region, sector, stage, employee_range, founded_year, is_hiring, job_titles, careers_url, logo_url, investors, total_raised). Then return `jsonResponse({ status: 'auto_published', startup_id: gateResult.existing_id, company: record, duplicate: true })`.
   - Otherwise insert a row into `map_startup_submissions` with `status: 'pending'`, `submitted_url: url`, `submitted_by_email: email ?? null`, `extracted_data: record`, `rejection_reason: gateResult.reason`, plus the scalar columns from `record` (use `record.name ?? 'Unknown'` since the `name` column is `not null`). Return `jsonResponse({ status: 'pending', reason: gateResult.reason, company: record })`.
9. **On gate PASS:**
   - Build the `map_startups` insert payload from `record` (all scalar columns listed in 0001_init.sql: `name, description, website, address, city, lat, lng, region, stage, sector, employee_range, founded_year, is_hiring, job_titles, careers_url, logo_url, investors, total_raised`) plus `verified: false`.
   - Insert into `map_startups` via `supabaseClient.from('map_startups').insert(payload).select('id').single()`. If the insert errors, return `errorResponse('INTERNAL_ERROR', 'Failed to insert into map_startups', 500)` and log the error.
   - Capture `startup_id = inserted.id`.
   - Insert audit row into `map_startup_submissions` with `status: 'auto_published'`, `submitted_url: url`, `submitted_by_email: email ?? null`, `extracted_data: record`, `rejection_reason: null`, `reviewed_by: 'auto'`, `reviewed_at: new Date().toISOString()`, plus the scalar columns from `record`. If this insert errors, log it but DO NOT fail the request — the `map_startups` write already succeeded.
   - Return `jsonResponse({ status: 'auto_published', startup_id, company: record })`.

10. **Outer try/catch:** wrap steps 5–9 in a try block; the catch logs and returns `errorResponse('INTERNAL_ERROR', 'Unexpected failure', 500)` so no unhandled exception ever leaks.

Use `console.error('[onboard-company] <context>:', err)` for all error logs.
</action>

<verify>
1. File exists: `supabase/functions/onboard-company/index.js`.
2. `deno check supabase/functions/onboard-company/index.js` exits 0 (or `node --check` if Deno is unavailable). Verify no missing imports by `grep "from '" supabase/functions/onboard-company/index.js` — every relative import resolves to a file that exists on disk.
3. Static behavior checks (no deploy required):
   - `grep "Deno.serve" supabase/functions/onboard-company/index.js` returns exactly 1 match.
   - `grep "OPTIONS" supabase/functions/onboard-company/index.js` shows the preflight branch.
   - `grep -E "status: 'auto_published'|status: 'pending'" supabase/functions/onboard-company/index.js` shows both response paths.
   - `grep "createClient" supabase/functions/onboard-company/index.js` is present and uses `SUPABASE_SERVICE_ROLE_KEY` (NOT anon key).
4. Functional check via local Supabase (run from repo root, only if `supabase` CLI is configured for the project — otherwise capture this as a manual deploy-time check):
   - `supabase functions serve onboard-company --no-verify-jwt` starts cleanly with no import errors.
   - `curl -X POST http://127.0.0.1:54321/functions/v1/onboard-company -H 'Content-Type: application/json' -d '{}'` returns HTTP 400 with `{"error":"Field \"url\" is required and must be a valid URL","code":"INVALID_INPUT"}`.
   - `curl -X POST http://127.0.0.1:54321/functions/v1/onboard-company -H 'Content-Type: application/json' -d '{"url":"not-a-url"}'` returns HTTP 400 same shape.
   - `curl -X OPTIONS http://127.0.0.1:54321/functions/v1/onboard-company -i` returns 200 with `Access-Control-Allow-Origin: *`.
   - `curl -X POST http://127.0.0.1:54321/functions/v1/onboard-company -H 'Content-Type: application/json' -d '{"url":"https://zonos.com","email":"demo@test.com"}'` returns HTTP 200 with a JSON body whose `status` is `'auto_published'` or `'pending'` (never throws).
5. Domain-completion check (deployed or local-served):
   - Auto-publish path: a Utah company submission lands a new row in `map_startups` (`select id, name, verified, lat, lng from map_startups order by created_at desc limit 1` shows `verified=false`, lat/lng inside Utah) AND a corresponding `map_startup_submissions` row with `status='auto_published'`.
   - Pending path: a non-Utah URL (e.g., `https://stripe.com`) returns `status='pending'`, no new `map_startups` row is created, and `map_startup_submissions` has `status='pending'` with a non-null `rejection_reason` containing "outside Utah" or "Missing required fields".
   - Duplicate path: invoking with the same Utah URL twice returns the same `startup_id` both times and the second `map_startups` count is unchanged.
</verify>

<done>
`supabase/functions/onboard-company/index.js` is in place. Locally served (or deployed) the function returns the documented JSON shape for valid Utah, non-Utah, malformed, and duplicate inputs; writes the correct rows; and never returns an unhandled exception.
</done>

---

## Tasks Status

- [x] Task 3.1: Create the three support modules (utah-bounds, quality-gate, prompts)
  Completed: 2026-05-09
- [x] Task 3.2: Create the onboard-company Edge Function entry point (index.js)
  Completed: 2026-05-09

## Verification Checklist

Maps directly to phase Success Criteria:

- [ ] `supabase functions invoke onboard-company --body '{"url":"https://zonos.com","email":"demo@test.com"}'` returns JSON whose `status` is `'auto_published'` or `'pending'`.
- [ ] A Utah company that passes the gate appears in `map_startups` with `verified = false` and the `id` is returned in the response.
- [ ] A company that fails the gate appears in `map_startup_submissions` with `status='pending'` and a non-null `rejection_reason`.
- [ ] Submitting the same URL twice does not duplicate `map_startups`; the second response returns the existing `startup_id`.
- [ ] A non-Utah company URL (e.g., `https://stripe.com`) fails the gate with a Utah-bounds reason and goes to pending review.
- [ ] A malformed URL (e.g., `not-a-url`) returns HTTP 400 with `{ error, code: 'INVALID_INPUT' }` — no unhandled exception.
- [ ] OPTIONS preflight returns 200 with `Access-Control-Allow-Origin: *` so the Vue frontend can call it.
- [ ] All exported functions in the four new files have JSDoc with `@param` and `@returns`.

## Success Criteria

The four files exist under `supabase/functions/onboard-company/`, the function deploys (or serves locally) without import errors, and a single end-to-end smoke run covers all four behaviors: auto-publish, pending (missing fields), pending (non-Utah), and duplicate. After this phase, the AI submission pipeline is fully wired from URL submission to row insertion and is ready to be hooked up to a Vue intake form in a later feature.
