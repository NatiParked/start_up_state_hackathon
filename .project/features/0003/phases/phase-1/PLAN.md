# Feature Plan: AI Onboarding — Submissions Schema & Shared Helpers

## Objective

Extend `map_startup_submissions` with M3 tracking columns (submitted URL, reviewer audit fields, enriched data, auto-publish status) and ship the four shared Edge Function helper modules (LLM client, logo.dev, Nominatim, Google Places) that every subsequent enricher and pipeline function will import.

**Purpose:** Establish the persistence layer and the four "best-effort" data sources the AI onboarding pipeline depends on, so that Phase 2 (enrichers) and Phase 3 (pipeline orchestration) can be built without re-deriving common helpers.

**Output:**
- `supabase/migrations/0002_submissions.sql` — additive ALTERs, status CHECK update, status index, RLS policies for SELECT/UPDATE
- `supabase/functions/_shared/llm.js` — `callLLM` against OpenCode Zen Anthropic-compatible endpoint
- `supabase/functions/_shared/logo-dev.js` — `fetchLogo(url)` + `normalizeDomain(url)`
- `supabase/functions/_shared/nominatim.js` — `geocodeAddress(address)` + `extractCity(result)`
- `supabase/functions/_shared/google-places.js` — `placesSearch(name, city)`

## Must-Haves (Goal-Backward)

### Observable Truths

When this phase is done, the following must be TRUE:

- A reviewer (or future admin UI) can see **why** a submission was rejected (`rejection_reason`), **who** reviewed it (`reviewed_by`), and **when** (`reviewed_at`).
- A submission can carry both the **raw user input** (existing flat columns + `submitted_url`, `submitted_by_email`) and the **enriched pipeline output** (`extracted_data jsonb`) side-by-side.
- The pipeline can mark a high-quality record as `auto_published` without manual review — the CHECK constraint allows that value.
- Anonymous users (public submission form) can `INSERT` but cannot `SELECT`; authenticated admins can `SELECT` and `UPDATE`.
- Any Edge Function can `import { callLLM } from '../_shared/llm.js'` and call Claude Haiku 4.5 via OpenCode Zen with a system + user prompt and an optional JSON schema.
- Any Edge Function can construct a logo URL for a startup domain by calling `fetchLogo('https://www.zonos.com/pricing')` → `https://img.logo.dev/zonos.com?token=...&size=128`.
- Any Edge Function can geocode a Utah address via Nominatim with the required `User-Agent`, 1 req/sec rate limiting, and 429 backoff.
- Any Edge Function can text-search Google Places for `(name, city)` and gracefully receive `null` when `GOOGLE_PLACES_API_KEY` is not configured.

### Required Artifacts

| Path                                          | Provides                                                              | Key Exports                              |
| --------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `supabase/migrations/0002_submissions.sql`    | M3 tracking columns, expanded status CHECK, status index, admin RLS   | (SQL only)                               |
| `supabase/functions/_shared/llm.js`           | Claude Haiku 4.5 call via OpenCode Zen, structured-output capable     | `callLLM`                                |
| `supabase/functions/_shared/logo-dev.js`      | Build logo.dev image URL from any startup URL; reusable domain helper | `fetchLogo`, `normalizeDomain`           |
| `supabase/functions/_shared/nominatim.js`     | Rate-limited OSM geocoder with retry + city extraction                | `geocodeAddress`, `extractCity`          |
| `supabase/functions/_shared/google-places.js` | Optional Places enricher (rating, phone, photos)                      | `placesSearch`                           |

### Required Wiring

- `_shared/llm.js` reads `OPENCODE_ZEN_API_KEY` and `OPENCODE_ZEN_BASE_URL` via `Deno.env.get(...)`; throws if either is missing when called.
- `_shared/logo-dev.js` reads `LOGO_DEV_TOKEN` via `Deno.env.get(...)`; `fetchLogo` does **not** make an HTTP request — it returns the URL string for the browser to load.
- `_shared/nominatim.js` enforces 1 req/sec via a module-level `lastCallAt` timestamp + `setTimeout`; sets `User-Agent: goed-hackathon` header (Nominatim ToS requirement); on HTTP 429, waits 2s and retries once.
- `_shared/google-places.js` returns `null` (does not throw) when `GOOGLE_PLACES_API_KEY` env var is absent — it is a stretch enricher.
- All four shared modules use plain `.js` (no TypeScript) and include JSDoc on every exported function.
- The migration file uses `ADD COLUMN IF NOT EXISTS` so it is idempotent even if applied to a partially migrated DB.

### Key Links

| From                                       | To                                          | Via                                                  |
| ------------------------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| Future enricher Edge Functions (Phase 2)   | OpenCode Zen / Claude Haiku 4.5             | `import { callLLM } from '../_shared/llm.js'`        |
| Future enricher Edge Functions (Phase 2)   | logo.dev                                    | `import { fetchLogo } from '../_shared/logo-dev.js'` |
| Future enricher Edge Functions (Phase 2)   | Nominatim                                   | `import { geocodeAddress } from '../_shared/nominatim.js'` |
| Future review UI (later phase)             | `map_startup_submissions` SELECT/UPDATE     | RLS policies for `authenticated`                     |
| Public submission form (Feature 0001)      | `map_startup_submissions` INSERT            | Existing RLS policy (must be preserved)              |

## Dependency Graph

```
Task 1 (migration)            → creates: supabase/migrations/0002_submissions.sql
Task 2 (shared helpers)       → creates: supabase/functions/_shared/{llm,logo-dev,nominatim,google-places}.js
```

The two tasks are **independent** — they touch disjoint paths and have no shared code. They can run in parallel.

## Execution Sequences

| Sequence | Tasks   | Parallel | Reason                                                                            |
| -------- | ------- | -------- | --------------------------------------------------------------------------------- |
| 1        | Task 1  | Yes      | Migration file is self-contained SQL; no dependency on JS helpers.                |
| 1        | Task 2  | Yes      | Shared helpers are pure JS modules; no dependency on the migration.               |

## Tasks

### Task 1: Add M3 columns + admin RLS to `map_startup_submissions`

**Type:** auto
**Sequence:** 1
**Status:** Complete
**Completed:** 2026-05-09

<files>
supabase/migrations/0002_submissions.sql
</files>

<action>
Create `supabase/migrations/0002_submissions.sql`. The file must:

1. Add the six M3 tracking columns to `map_startup_submissions` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (idempotent):
   - `submitted_url text` — the URL the user pasted in the public form
   - `submitted_by_email text` — submitter contact (optional)
   - `extracted_data jsonb` — the full enriched company record produced by the pipeline
   - `rejection_reason text` — why a submission was rejected (manual or auto)
   - `reviewed_at timestamptz` — when the decision was made
   - `reviewed_by text` — reviewer email, or the literal string `'auto'` for quality-gate auto-decisions
2. Drop the existing `status` CHECK constraint if any, then add a new one allowing four values:
   `CHECK (status IN ('pending', 'approved', 'rejected', 'auto_published'))`.
   Use a known constraint name (e.g. `map_startup_submissions_status_check`) and `IF EXISTS` for the drop so it is safe to re-run.
3. Add a B-tree index `CREATE INDEX IF NOT EXISTS map_startup_submissions_status_idx ON map_startup_submissions (status);` for fast queue queries (admin "show me all pending").
4. Add two RLS policies (the existing public-INSERT policy from `0001_init.sql` is preserved):
   - SELECT for `authenticated` (admin) using `(true)` — `map_startup_submissions_admin_select`
   - UPDATE for `authenticated` (admin) using `(true)` with check `(true)` — `map_startup_submissions_admin_update`
   Wrap each `CREATE POLICY` in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block (or use a `DROP POLICY IF EXISTS` first) so the migration is re-runnable.
5. Add a header comment matching the style of `0001_init.sql` (apply via `supabase db push` or SQL editor; convention note about `map_` prefix).

Do **not** drop, rename, or modify any existing columns or the existing public-INSERT policy. This migration is purely additive.
</action>

<verify>
1. File exists at `supabase/migrations/0002_submissions.sql` and parses as valid PostgreSQL (no syntax errors).
2. Apply the migration via Supabase MCP `apply_migration` (or `supabase db push` locally). Confirm it succeeds with no errors.
3. Use Supabase MCP `list_tables` (or `\d map_startup_submissions` in SQL editor) and confirm all six new columns are present with the expected types: `submitted_url text`, `submitted_by_email text`, `extracted_data jsonb`, `rejection_reason text`, `reviewed_at timestamptz`, `reviewed_by text`.
4. Run `INSERT INTO map_startup_submissions (name, status) VALUES ('test', 'auto_published');` — must succeed.
5. Run `INSERT INTO map_startup_submissions (name, status) VALUES ('test', 'bogus');` — must fail with a CHECK constraint violation.
6. Run `EXPLAIN SELECT * FROM map_startup_submissions WHERE status = 'pending';` and confirm the planner uses `map_startup_submissions_status_idx` (or at least that the index exists in `pg_indexes`).
7. Re-run the migration a second time — it must succeed without error (idempotency check).
8. Clean up test rows: `DELETE FROM map_startup_submissions WHERE name = 'test';`.
</verify>

<done>
- `supabase/migrations/0002_submissions.sql` is committed.
- All six M3 columns exist on `map_startup_submissions` with correct types.
- `status` CHECK accepts `'pending' | 'approved' | 'rejected' | 'auto_published'` and rejects everything else.
- `map_startup_submissions_status_idx` exists.
- Admin SELECT and UPDATE policies exist for the `authenticated` role; public INSERT policy from `0001_init.sql` is unchanged.
- Migration is idempotent (safe to re-apply).
</done>

---

### Task 2: Build the four shared Edge Function helper modules

**Type:** auto
**Sequence:** 1
**Status:** COMPLETE
**Completed:** 2026-05-09

<files>
supabase/functions/_shared/llm.js
supabase/functions/_shared/logo-dev.js
supabase/functions/_shared/nominatim.js
supabase/functions/_shared/google-places.js
</files>

<action>
Create the `supabase/functions/_shared/` directory and the four modules below. All four are plain JavaScript (`.js`, never `.ts`), use `Deno.env.get(...)` for secrets, and export functions with JSDoc.

**1. `_shared/llm.js`**

Export a single async function:

```
callLLM({ model, systemPrompt, userPrompt, schema })
```

- `model` defaults to `'claude-haiku-4-5'` if not provided.
- Reads `OPENCODE_ZEN_API_KEY` and `OPENCODE_ZEN_BASE_URL` from `Deno.env`. Throw `Error('OPENCODE_ZEN_API_KEY not set')` (or similar) if either is missing.
- POSTs to `${OPENCODE_ZEN_BASE_URL}/v1/messages` (Anthropic-compatible endpoint) with headers `{ 'Content-Type': 'application/json', 'x-api-key': OPENCODE_ZEN_API_KEY, 'anthropic-version': '2023-06-01' }` and a body containing `{ model, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }`. If `schema` is provided, add `tools` / `tool_choice` so the model returns structured JSON matching the schema (Anthropic tool-use pattern: a single tool named `respond` with `input_schema: schema` and `tool_choice: { type: 'tool', name: 'respond' }`).
- Throw on non-2xx HTTP responses including the response body text in the error message.
- Return the parsed structured content: when `schema` is provided, return the tool-use `input` object; otherwise return the concatenated text from `content[].text`.
- JSDoc on the export with `@param`, `@returns`, `@throws`.

**2. `_shared/logo-dev.js`**

Export two synchronous functions:

```
normalizeDomain(url)   // 'https://www.zonos.com/pricing' -> 'zonos.com'
fetchLogo(url)         // builds the img.logo.dev URL string
```

- `normalizeDomain`: strip protocol (`http://`, `https://`), strip leading `www.`, strip everything from the first `/` onward, strip trailing `:port` if any, lowercase. Return the bare domain. If input is falsy or unparseable, return `null`.
- `fetchLogo`: read `LOGO_DEV_TOKEN` from `Deno.env`. If missing, return `null`. Otherwise call `normalizeDomain(url)`; if that returns `null`, return `null`. Build and return `https://img.logo.dev/${domain}?token=${token}&size=128` as a string. Do **not** make an HTTP request — the browser resolves it.
- JSDoc on both exports.

**3. `_shared/nominatim.js`**

Export two functions:

```
async geocodeAddress(address)
extractCity(nominatimResult)
```

- Module-level `let lastCallAt = 0;`
- `geocodeAddress`: enforce ≥1000ms between calls — compute `wait = Math.max(0, 1000 - (Date.now() - lastCallAt))` and `await new Promise(r => setTimeout(r, wait))` before the request, then update `lastCallAt = Date.now()`. URL: `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(address)}`. Headers: `{ 'User-Agent': 'goed-hackathon' }`. On HTTP 429: wait 2000ms and retry exactly once. On any other non-2xx or empty results array, return `null`. On success, return `{ lat: parseFloat(result.lat), lng: parseFloat(result.lon), display_name: result.display_name, address: result.address }`.
- `extractCity`: given a Nominatim result (the object returned from `geocodeAddress`), look at `result.address` and return the first defined value among `address.city`, `address.town`, `address.village`, `address.municipality`, `address.county`. Return `null` if none are present or the input is falsy.
- JSDoc on both exports.

**4. `_shared/google-places.js`**

Export one async function:

```
placesSearch(name, city)
```

- Read `GOOGLE_PLACES_API_KEY` from `Deno.env`. If missing, return `null` immediately (no error — this is a stretch enricher).
- POST to `https://places.googleapis.com/v1/places:searchText` with headers `{ 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.nationalPhoneNumber,places.businessStatus,places.photos' }` and body `{ "textQuery": "${name} ${city}" }`.
- On non-2xx or empty `places` array, return `null`.
- On success, take the first place and return `{ place_id: place.id, rating: place.rating ?? null, phone: place.nationalPhoneNumber ?? null, business_status: place.businessStatus ?? null, photos: (place.photos ?? []).map(p => p.name) }`.
- JSDoc on the export.

Use ES module syntax (`export function ...` / `export async function ...`). No TypeScript. No external npm imports — only `fetch`, `Deno.env`, and built-in globals.
</action>

<verify>
1. All four files exist:
   - `supabase/functions/_shared/llm.js`
   - `supabase/functions/_shared/logo-dev.js`
   - `supabase/functions/_shared/nominatim.js`
   - `supabase/functions/_shared/google-places.js`
2. Run `deno check supabase/functions/_shared/*.js` (or `deno lint`) — no syntax or type errors.
3. `logo-dev.js` unit check (in a Deno REPL or quick test script):
   - `normalizeDomain('https://www.zonos.com/pricing')` returns `'zonos.com'`
   - `normalizeDomain('http://Example.COM/')` returns `'example.com'`
   - `normalizeDomain('')` and `normalizeDomain(null)` return `null`
   - With `LOGO_DEV_TOKEN=test123` set, `fetchLogo('https://www.zonos.com/pricing')` returns `'https://img.logo.dev/zonos.com?token=test123&size=128'`
   - With `LOGO_DEV_TOKEN` unset, `fetchLogo(...)` returns `null`
4. `nominatim.js` integration check (live network OK):
   - `await geocodeAddress('136 S Main St, Salt Lake City, UT')` returns an object with `lat ≈ 40.76` and `lng ≈ -111.89` (within 0.05 tolerance).
   - `extractCity({ address: { city: 'Salt Lake City' } })` returns `'Salt Lake City'`.
   - Two back-to-back calls take ≥1000ms total (rate limiting working).
5. `llm.js` smoke check (only if `OPENCODE_ZEN_API_KEY` and `OPENCODE_ZEN_BASE_URL` are set as Supabase secrets):
   - `await callLLM({ systemPrompt: 'You are a JSON echo.', userPrompt: 'Say hi.' })` returns a non-empty string.
   - With `schema = { type: 'object', properties: { greeting: { type: 'string' } }, required: ['greeting'] }` and a matching prompt, the return value is an object with a `greeting` string.
   - Calling without the API key throws an Error.
6. `google-places.js` smoke check:
   - With `GOOGLE_PLACES_API_KEY` unset, `await placesSearch('Zonos', 'St. George')` returns `null` (no throw).
   - With the key set (if available), the same call returns an object with at least `place_id` populated.
7. Each file has a JSDoc block (`/** ... */`) immediately above every `export` declaration with `@param` and `@returns` tags.
</verify>

<done>
- All four `_shared/*.js` files exist, are valid Deno-compatible JavaScript (no TypeScript), and export the documented functions.
- `normalizeDomain` correctly extracts bare domains; `fetchLogo` returns the expected URL format and `null` when the token is absent.
- `geocodeAddress` returns `{ lat, lng, display_name, address }` for a valid Utah address, enforces 1 req/sec, and retries once on 429.
- `extractCity` returns the city/town/village/municipality from a Nominatim result.
- `callLLM` reaches OpenCode Zen with Claude Haiku 4.5 and returns parsed text or structured JSON depending on whether `schema` is provided; throws when API key/base URL are missing.
- `placesSearch` returns `null` silently when `GOOGLE_PLACES_API_KEY` is unset, and a normalized `{ place_id, rating, phone, business_status, photos }` object on a hit.
- Every exported function has JSDoc with `@param` / `@returns` / `@throws` as appropriate.
</done>

## Verification Checklist

These match the Phase 1 success criteria from the roadmap:

- [x] `supabase db push` (or Supabase MCP `apply_migration`) applies `0002_submissions.sql` without error.
- [x] `map_startup_submissions` has all six M3 columns: `submitted_url`, `submitted_by_email`, `extracted_data`, `rejection_reason`, `reviewed_at`, `reviewed_by`.
- [x] `status` column accepts `'auto_published'` in addition to `'pending'`, `'approved'`, `'rejected'`, and rejects any other value.
- [x] B-tree index `map_startup_submissions_status_idx` exists.
- [x] Anon role can `INSERT` into `map_startup_submissions`; anon cannot `SELECT`. Authenticated role can `SELECT` and `UPDATE`.
- [x] Migration is idempotent (re-running succeeds).
- [ ] Importing `_shared/llm.js` in a Deno context and calling `callLLM` with a test prompt returns a parsed response (requires `OPENCODE_ZEN_API_KEY` in Supabase secrets).
- [ ] `fetchLogo('https://www.zonos.com/pricing')` returns `https://img.logo.dev/zonos.com?token=...&size=128` with the correct domain extracted.
- [ ] `geocodeAddress('136 S Main St, Salt Lake City, UT')` returns `{ lat, lng, ... }` with lat ~40.76 and lng ~-111.89.
- [ ] `placesSearch('Zonos', 'St. George')` returns `null` when `GOOGLE_PLACES_API_KEY` is unset (no throw).
- [ ] All exported functions have JSDoc.

## Success Criteria

Phase 1 is complete when:

1. The migration `0002_submissions.sql` has been applied to the Supabase project and the `map_startup_submissions` table reflects all six M3 columns + the expanded status CHECK + admin RLS.
2. All four `_shared/*.js` modules exist, parse cleanly under `deno check`, and behave as specified by their unit/smoke checks above.
3. A future enricher Edge Function (Phase 2) can simply `import` from `../_shared/*.js` without needing any further plumbing — keys are read from `Deno.env` at call time, and missing optional keys (Google Places) degrade gracefully to `null`.
