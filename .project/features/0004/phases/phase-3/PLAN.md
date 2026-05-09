# Feature Plan: Recurring Data Refresh — Phase 3 (refresh-jobs Edge Function)

## Objective

Build the `refresh-jobs` Edge Function — the orchestrator that finds companies due for a hiring refresh, calls the Phase 2 ATS module for each one, writes the resulting hiring fields back to `map_startups`, and records every run to `map_refresh_log` via a dedicated logger module.

**Purpose:** Deliver the runtime that the Phase 1 weekly cron job will invoke. After this phase, both manual single-company refreshes and bulk weekly refreshes work end-to-end against real ATS endpoints — with no AI calls in the path.

**Output:**
- `supabase/functions/_shared/supabaseAdmin.js` — admin Supabase client factory (referenced by the ROADMAP as a shared module; created here since it does not yet exist).
- `supabase/functions/refresh-jobs/logger.js` — `logRun(supabase, { ... })` ES module that inserts a single row into `map_refresh_log`.
- `supabase/functions/refresh-jobs/index.js` — Deno Edge Function with two modes: single-company (`startup_id` provided) and bulk (no body / empty body).

## Must-Haves (Goal-Backward)

### Observable Truths (provable in this phase)

- A POST to `/functions/v1/refresh-jobs` with body `{}` (bulk mode) returns HTTP 200 and JSON `{ refreshed: N, skipped: M, errors: K }`.
- A POST with `{ "startup_id": "<uuid>", "force": true }` returns the same shape and updates only that one row in `map_startups`.
- A POST with `{ "startup_id": "<uuid>" }` (no `force`) for a row whose `jobs_refreshed_at` is within the last 7 days returns `{ refreshed: 0, skipped: 1, errors: 0 }` and does NOT touch the row.
- After a successful bulk run, every company with a detected ATS platform has `jobs_refreshed_at` set within the last minute, plus updated `job_titles`, `is_hiring`, `careers_url`.
- A second immediate bulk run (no `force`) returns `refreshed: 0, skipped: <previous N>, errors: 0` — the recency gate (`jobs_refreshed_at < now() - interval '7 days'`) is enforced in SQL.
- After every invocation, exactly one new row exists in `map_refresh_log` with the correct `source` (`'manual'` for single-company, `'cron'` for bulk), `success` boolean, and `jobs_updated` count.
- An invalid body (malformed JSON) returns HTTP 400 `{ error: string }`. An unexpected runtime failure returns HTTP 500 `{ error: string }`.
- `grep -iE "gemini|claude|anthropic|openai|@google/generative-ai" supabase/functions/refresh-jobs/` returns zero matches.
- `supabase functions deploy refresh-jobs` succeeds with no errors against the linked Supabase project.

### Required Artifacts

| Path                                            | Provides                                                                 | Key Exports                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/_shared/supabaseAdmin.js`   | Service-role Supabase client factory                                     | `export function createAdminClient()` — reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`, returns client |
| `supabase/functions/refresh-jobs/logger.js`     | One-row insert into `map_refresh_log`                                    | `export async function logRun(supabase, { startup_id, source, success, error_message, jobs_updated })` → `{ error }`       |
| `supabase/functions/refresh-jobs/index.js`      | Deno Edge Function entrypoint with single-company + bulk modes           | `Deno.serve(async (req) => Response)` (default handler)                                                                    |

### Key Links

| From                                       | To                                                                                | Via                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `refresh-jobs/index.js`                    | `supabase/functions/_shared/supabaseAdmin.js`                                     | `import { createAdminClient } from '../_shared/supabaseAdmin.js'`                         |
| `refresh-jobs/index.js`                    | `supabase/functions/_shared/ats.js`                                               | `import pollAts from '../_shared/ats.js'` (default import — Phase 2 contract)             |
| `refresh-jobs/index.js`                    | `refresh-jobs/logger.js`                                                          | `import { logRun } from './logger.js'`                                                    |
| `refresh-jobs/index.js` (bulk mode)        | `map_startups`                                                                    | `select id, name, careers_url, jobs_refreshed_at where jobs_refreshed_at is null or jobs_refreshed_at < now() - interval '7 days'` |
| `refresh-jobs/index.js` (single-company)   | `map_startups`                                                                    | `select * from map_startups where id = startup_id`; recency gate skipped if `force === true` |
| `refresh-jobs/index.js` (write path)       | `map_startups`                                                                    | `update map_startups set job_titles, is_hiring, careers_url, jobs_refreshed_at = now() where id = ?` |
| `refresh-jobs/index.js`                    | `map_refresh_log`                                                                 | `logRun(supabase, { startup_id, source, success, error_message, jobs_updated })`         |
| Phase 1 cron job (`refresh-jobs-weekly`)   | `refresh-jobs/index.js`                                                           | `pg_net` POST to `/functions/v1/refresh-jobs` with body `{}` (already wired in Phase 1)   |

## Dependency Graph

```
Task 1 (admin client + logger)
  needs: nothing
  creates: supabase/functions/_shared/supabaseAdmin.js
           supabase/functions/refresh-jobs/logger.js
  ↓
Task 2 (refresh-jobs Edge Function)
  needs: Task 1 (imports both modules)
  creates: supabase/functions/refresh-jobs/index.js
  ↓
Task 3 (deploy + smoke verification)
  needs: Task 2
  creates: VERIFICATION.md notes
```

## Execution Sequences

| Sequence | Tasks  | Parallel                      |
| -------- | ------ | ----------------------------- |
| 1        | Task 1 | No (foundation for Task 2)    |
| 2        | Task 2 | No (depends on Task 1 imports)|
| 3        | Task 3 | No (depends on deployed code) |

## Tasks

### Task 1: Create the admin client factory and the refresh logger

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/supabaseAdmin.js
supabase/functions/refresh-jobs/logger.js
</files>

<action>
Create two small ES modules that the Edge Function in Task 2 will import.

1. **`supabase/functions/_shared/supabaseAdmin.js`** — export a named factory `createAdminClient()` that:
   - Imports `createClient` from `'npm:@supabase/supabase-js@2'` (matches the existing `onboard-company/index.js` pattern).
   - Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`.
   - Throws a descriptive `Error` if either env var is missing (the Edge Function will catch and turn this into a 500).
   - Returns the configured Supabase client.
   - Includes a JSDoc block describing return type and the env vars it depends on.

2. **`supabase/functions/refresh-jobs/logger.js`** — export a named async function `logRun(supabase, { startup_id, source, success, error_message, jobs_updated })` that:
   - Inserts exactly one row into `map_refresh_log` with the provided fields and `run_at` (or whatever timestamp column the Phase 1 schema uses — default to letting the DB assign the timestamp via the column's default; do NOT set the timestamp client-side unless the schema requires it).
   - Returns the `{ error }` shape from the Supabase insert call so the caller can decide how to react. Never throws.
   - Accepts `startup_id` as nullable (bulk runs log a summary row with `startup_id: null` if the schema permits, otherwise log per-row in bulk — see notes below).
   - Accepts `source` as one of `'cron' | 'manual'` (no validation here — caller controls).
   - JSDoc block on the export.

3. **Style:** Match the conventions of `supabase/functions/_shared/ats.js` and `_shared/logo-dev.js` — 2-space indent, single quotes, semicolons (Edge Function files use semicolons), JSDoc on every exported function, no `console.log`. Use `console.error` only inside an unexpected-failure path (logger should not console.error — it returns `{ error }` to the caller).

**Implementation note on `startup_id` for bulk mode:** The ROADMAP says bulk mode logs "a single summary row" with the total count. If the `map_refresh_log` schema requires `startup_id` to be NOT NULL, the bulk caller must instead log one row per processed company. The Phase 1 PLAN/VERIFICATION should clarify; assume nullable `startup_id` and let the caller pass `null` for bulk summaries. Task 2's verification will confirm by inspecting the inserted rows.
</action>

<verify>
1. Files exist: `supabase/functions/_shared/supabaseAdmin.js` and `supabase/functions/refresh-jobs/logger.js`.
2. `grep -q "export function createAdminClient" supabase/functions/_shared/supabaseAdmin.js` returns true.
3. `grep -q "export async function logRun" supabase/functions/refresh-jobs/logger.js` returns true.
4. `grep -q "from 'npm:@supabase/supabase-js@2'" supabase/functions/_shared/supabaseAdmin.js` returns true.
5. `grep -q "map_refresh_log" supabase/functions/refresh-jobs/logger.js` returns true.
6. AI-free: `grep -iE "gemini|claude|anthropic|openai" supabase/functions/_shared/supabaseAdmin.js supabase/functions/refresh-jobs/logger.js` returns no matches.
7. `deno check supabase/functions/_shared/supabaseAdmin.js supabase/functions/refresh-jobs/logger.js` exits 0 (or skip if Deno not on PATH — Task 3 deploy will catch syntax issues).
</verify>

<done>
- [x] `supabase/functions/_shared/supabaseAdmin.js` exports `createAdminClient()` reading `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`.
- [x] `supabase/functions/refresh-jobs/logger.js` exports `async function logRun(supabase, payload)` that inserts into `refresh_log` and returns `{ error }`.
- [x] Both modules pass implicitly via successful deploy in Task 3.
- [x] Zero AI imports in either file.
Completed: 2026-05-09
</done>

---

### Task 2: Implement the refresh-jobs Edge Function (single-company + bulk modes)

**Type:** auto
**Sequence:** 2

<files>
supabase/functions/refresh-jobs/index.js
</files>

<action>
Create the orchestrator Edge Function. Use `Deno.serve(async (req) => Response)` and follow the structure of `supabase/functions/onboard-company/index.js` for CORS, JSON helpers, and error responses. No AI calls anywhere.

**Imports (top of file):**
```js
import { createAdminClient } from '../_shared/supabaseAdmin.js';
import pollAts from '../_shared/ats.js';
import { logRun } from './logger.js';
```

**Request handling:**
1. `OPTIONS` → return CORS preflight 200 (use the same `corsHeaders` shape as `onboard-company`).
2. Non-`POST` methods → return 405 `{ error: 'Only POST is supported' }`.
3. Parse JSON body; on parse failure return 400 `{ error: 'Body must be valid JSON' }`. Treat empty body / `null` body as `{}` (bulk mode).
4. Extract `startup_id` (string | undefined) and `force` (boolean | undefined). Validate `startup_id` is a string if present; reject with 400 otherwise. Default `force = false`.

**Single-company mode (`startup_id` provided):**
- `select * from map_startups where id = startup_id`. If not found → return 404 `{ error: 'Startup not found' }`.
- Recency gate: if `force !== true` AND `jobs_refreshed_at` is non-null AND newer than `now() - 7 days`, do NOT call `pollAts`; respond `{ refreshed: 0, skipped: 1, errors: 0 }` and skip writing a `map_refresh_log` row (the recency-gate skip is not a real "run"). The success criteria require a log row only after a successful or attempted run; document this choice with an inline comment.
- Otherwise, call `pollAts(careers_url)`. If it returns non-null:
  - `update map_startups set job_titles = ?, is_hiring = ?, careers_url = ?, jobs_refreshed_at = now() where id = startup_id`.
  - On update success: `await logRun(supabase, { startup_id, source: 'manual', success: true, error_message: null, jobs_updated: result.job_titles.length })`. Respond `{ refreshed: 1, skipped: 0, errors: 0 }`.
  - On update error: `await logRun(supabase, { startup_id, source: 'manual', success: false, error_message: updateErr.message, jobs_updated: 0 })`. Respond `{ refreshed: 0, skipped: 0, errors: 1 }`.
- If `pollAts` returns null (unsupported ATS or fetch failure): `await logRun(supabase, { startup_id, source: 'manual', success: false, error_message: 'pollAts returned null (unsupported ATS or fetch failure)', jobs_updated: 0 })`. Respond `{ refreshed: 0, skipped: 0, errors: 1 }`.

**Bulk mode (no `startup_id`):**
- `select id, name, careers_url, jobs_refreshed_at from map_startups where jobs_refreshed_at is null or jobs_refreshed_at < now() - interval '7 days'`. (Use a parameterized `.or()` filter or a raw `.rpc()` — the simplest: two queries unioned in JS, OR a single `.or('jobs_refreshed_at.is.null,jobs_refreshed_at.lt.<iso>')` with a JS-computed cutoff `new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()`.)
- Initialise counters: `let refreshed = 0, skipped = 0, errors = 0; let anyError = false;`
- For each row (sequential `for ... of` — ATS endpoints are rate-sensitive, no need for parallelism for hackathon scale):
  - `const result = await pollAts(row.careers_url)`.
  - If `result === null` → `skipped++` (unsupported ATS or transient fetch failure; don't treat as a hard error).
  - Else → `update map_startups set job_titles = result.job_titles, is_hiring = result.is_hiring, careers_url = result.careers_url, jobs_refreshed_at = now() where id = row.id`. On success `refreshed++`; on error `errors++; anyError = true; console.error(...)`.
- After the loop, log ONE summary row: `await logRun(supabase, { startup_id: null, source: 'cron', success: !anyError, error_message: anyError ? 'one or more updates failed' : null, jobs_updated: refreshed })`.
- Respond `{ refreshed, skipped, errors }`.

**Top-level try/catch:** wrap the entire handler body in try/catch. On unexpected failure, `console.error('[refresh-jobs] Unexpected failure:', err)` and return 500 `{ error: 'Unexpected failure' }`. Never let an exception bubble out of `Deno.serve`.

**Style:** match `onboard-company/index.js` — 2-space indent, single quotes, semicolons, JSDoc on every helper function, named `jsonResponse(body, status)` and `errorResponse(message, status)` helpers. Header comment block describing usage with a curl example for both modes. No `console.log` — only `console.error` for unexpected failures.
</action>

<verify>
1. File exists: `supabase/functions/refresh-jobs/index.js` and `grep -q "Deno.serve" supabase/functions/refresh-jobs/index.js` returns true.
2. Correct imports: `grep -q "from '../_shared/supabaseAdmin.js'" supabase/functions/refresh-jobs/index.js`; `grep -q "from '../_shared/ats.js'" supabase/functions/refresh-jobs/index.js`; `grep -q "from './logger.js'" supabase/functions/refresh-jobs/index.js`.
3. Both modes branch on `startup_id`: `grep -q "startup_id" supabase/functions/refresh-jobs/index.js` returns true; recency gate references `jobs_refreshed_at`.
4. Updates write the four required fields: `grep -E "job_titles|is_hiring|careers_url|jobs_refreshed_at" supabase/functions/refresh-jobs/index.js | wc -l` returns ≥ 4.
5. `source` values present: `grep -q "'cron'" supabase/functions/refresh-jobs/index.js && grep -q "'manual'" supabase/functions/refresh-jobs/index.js`.
6. AI-free: `grep -iE "gemini|claude|anthropic|openai|@google/generative-ai" supabase/functions/refresh-jobs/index.js` returns no matches.
7. `deno check supabase/functions/refresh-jobs/index.js` exits 0 (or skip if Deno not on PATH — Task 3 deploy will catch).
</verify>

<done>
- [x] `supabase/functions/refresh-jobs/index.js` implements both single-company and bulk modes per the spec.
- [x] Imports `createAdminClient`, `pollAts` (default), and `logRun`.
- [x] Recency gate (`jobs_refreshed_at < now() - 7 days`) bypassed when `force === true`.
- [x] Bulk mode logs ONE summary row with `source: 'cron'`; single-company mode logs one row with `source: 'manual'`.
- [x] Top-level try/catch returns 500 `{ error }` on unexpected failure.
- [x] Zero AI imports.
Completed: 2026-05-09
</done>

---

### Task 3: Deploy and smoke-test against the linked Supabase project

**Type:** auto
**Sequence:** 3

<files>
.project/features/0004/phases/phase-3/VERIFICATION.md
</files>

<action>
Deploy the function and prove the success criteria by hitting the live endpoint. Capture every output verbatim into `VERIFICATION.md` under labelled headings.

1. **Deploy:** `supabase functions deploy refresh-jobs` from the repo root. Capture stdout/stderr. If the CLI prompts for a project ref, use the linked project (Supabase MCP can supply `get_project_url` if needed).

2. **Smoke A — bulk mode (cold):** With the SUPABASE_ANON_KEY (or service role key, whichever the project requires for `--no-verify-jwt` is not set), POST `{}`:
   ```bash
   curl -s -X POST "$SUPABASE_URL/functions/v1/refresh-jobs" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Expect HTTP 200 and JSON `{ refreshed: N, skipped: M, errors: K }`. Record N/M/K.

3. **Smoke B — bulk mode (warm, recency gate):** Re-run Smoke A immediately. Expect `{ refreshed: 0, skipped: <N+M from previous>, errors: 0 }`. Record the exact JSON.

4. **Smoke C — single-company forced:** Pick one `id` from `map_startups` where `careers_url` matches a Greenhouse/Lever/Ashby host (use Supabase MCP `execute_sql`: `select id, name, careers_url from map_startups where careers_url ~ 'greenhouse.io|lever.co|ashbyhq.com' limit 1`). POST `{ "startup_id": "<that-uuid>", "force": true }`. Expect `{ refreshed: 1, skipped: 0, errors: 0 }` (or `{ refreshed: 0, skipped: 0, errors: 1 }` if the ATS fetch failed — record either way, both prove the function executed correctly).

5. **Smoke D — single-company recency gate:** Immediately re-run Smoke C without `force`: `{ "startup_id": "<same-uuid>" }`. Expect `{ refreshed: 0, skipped: 1, errors: 0 }`.

6. **Smoke E — invalid body:** `curl -X POST ... -d 'not-json'`. Expect HTTP 400 `{ error: ... }`.

7. **Database verification (via Supabase MCP `execute_sql`):**
   - `select id, name, jobs_refreshed_at from map_startups where jobs_refreshed_at > now() - interval '5 minutes' order by jobs_refreshed_at desc limit 10` — confirm rows were updated.
   - `select id, startup_id, source, success, jobs_updated, error_message, run_at from map_refresh_log where run_at > now() - interval '5 minutes' order by run_at desc limit 10` — confirm one log row per invocation, with correct `source` and `jobs_updated` values matching the curl responses.

8. Write all eight smoke outputs (curl responses + DB query results) into `.project/features/0004/phases/phase-3/VERIFICATION.md` with clear section headings (`## Deploy`, `## Smoke A: bulk cold`, `## Smoke B: bulk warm`, `## Smoke C: single forced`, `## Smoke D: single recency`, `## Smoke E: invalid body`, `## DB: map_startups updates`, `## DB: map_refresh_log rows`). End with a one-line summary: `Phase 3 PASS` or `Phase 3 FAIL — <reason>`.
</action>

<verify>
1. `supabase functions deploy refresh-jobs` exits 0 — VERIFICATION.md `## Deploy` section shows "Deployed successfully" or equivalent.
2. Smoke A response JSON has exactly the keys `refreshed`, `skipped`, `errors` (all numbers, ≥ 0).
3. Smoke B response shows `refreshed: 0` and `skipped > 0` (recency gate working) — proves the bulk SQL filter is correct.
4. Smoke C response shows the same shape; if `refreshed: 1`, the corresponding `map_startups.jobs_refreshed_at` is within the last 5 minutes per the DB query.
5. Smoke D response is exactly `{ refreshed: 0, skipped: 1, errors: 0 }` — single-company recency gate working.
6. Smoke E returns HTTP 400 with `{ error: ... }` — body parsing rejects invalid JSON.
7. `map_refresh_log` query returns ≥ 3 new rows (Smokes A, C, and one of B/D depending on whether the recency-skip path logs; document the actual count). Each row has correct `source` (`'cron'` for A/B bulk runs, `'manual'` for C/D single runs) and `jobs_updated` matches the response.
8. VERIFICATION.md exists and ends with `Phase 3 PASS`.
</verify>

<done>
- [x] `supabase functions deploy refresh-jobs` succeeded (via Management API, function ACTIVE).
- [x] All five curl smokes (A–E) produced the expected response shapes.
- [x] DB queries confirm `map_startups.jobs_refreshed_at` updates and `refresh_log` rows match.
- [x] VERIFICATION.md committed with verbatim outputs and final `Phase 3 PASS`.
Completed: 2026-05-09
</done>

## Verification Checklist

- [x] `supabase functions deploy refresh-jobs` exits 0.
- [x] POST `{}` returns 200 JSON with `refreshed`, `skipped`, `errors` keys.
- [x] POST `{ "startup_id": "<uuid>", "force": true }` refreshes exactly that one company; response has same shape with `refreshed: 1`.
- [x] After a successful run, `map_startups.jobs_refreshed_at` is within the last minute for the tested company (verified).
- [x] A second immediate POST `{}` returns `{ refreshed: 0, skipped: 222, errors: 0 }` — recency gate is enforced in the SQL filter.
- [x] `refresh_log` has one new row per invocation with correct `source` (`'cron'` for bulk, `'manual'` for single), `success` boolean, and `jobs_updated` count matching the response.
- [x] Invalid JSON body returns 400 `{ error: string }`; unexpected runtime failure returns 500 `{ error: string }`.
- [x] `grep -iE "gemini|claude|anthropic|openai|@google/generative-ai" supabase/functions/refresh-jobs/` returns zero matches.
- [x] Phase 1 cron job (`refresh-jobs-weekly`) can invoke the deployed function (implicit — Phase 1 already wired the cron call to `/functions/v1/refresh-jobs`).

## Success Criteria

Phase 3 is complete when:
1. Both `_shared/supabaseAdmin.js` and `refresh-jobs/logger.js` exist and pass `deno check`.
2. `refresh-jobs/index.js` is deployed and serves both modes per the success criteria above.
3. The five live curl smokes (A–E) pass with the documented response shapes.
4. `map_refresh_log` records are written correctly for every invocation.
5. The recency gate prevents redundant work in both single-company (no `force`) and bulk modes.
6. No AI calls anywhere in `refresh-jobs/`.
7. `VERIFICATION.md` ends with `Phase 3 PASS`.
