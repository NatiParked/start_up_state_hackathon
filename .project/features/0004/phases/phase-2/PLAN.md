# Feature Plan: Recurring Data Refresh — Phase 2 (ATS Shared Module)

## Objective

Bring `supabase/functions/_shared/ats.js` into compliance with the Feature 0004 spec so it serves as the canonical, dependency-free ATS poller used by both `refresh-jobs` (Phase 3) and `onboard-company` (M3).

**Purpose:** A single, AI-free helper that maps a `careers_url` → `{ job_titles, is_hiring, careers_url }` for Greenhouse, Lever, and Ashby — gracefully returning `null` on every error path so callers can preserve existing values.

**Output:** Updated `supabase/functions/_shared/ats.js` aligned with spec requirements (User-Agent `goed-startup-map`, 10-second `AbortController` timeout on every fetch, default-exported `pollAts`, Greenhouse `?content=false`, Ashby GraphQL endpoint).

## Must-Haves (Goal-Backward)

### Observable Truths (provable in this phase)

- Calling `pollAts('https://boards.greenhouse.io/stripe')` returns an object with `job_titles: string[]`, `is_hiring: boolean`, `careers_url: string` (or `null` if the network is unreachable in the test env — graceful, never throws).
- Calling `pollAts(null)` returns `null` synchronously without throwing.
- Calling `pollAts('')` and `pollAts(undefined)` return `null` without throwing.
- Calling `pollAts('https://example.com/careers')` (non-ATS host) returns `null`.
- Calling `pollAts('not a url')` returns `null` without throwing.
- The module is importable from a sibling Edge Function via `import pollAts from '../_shared/ats.js'` (default import) without syntax errors under Deno.
- `grep -E "gemini|claude|anthropic|openai|llm" supabase/functions/_shared/ats.js` returns zero matches (no AI imports or calls).
- Every outbound `fetch` call carries `User-Agent: goed-startup-map` and is wrapped in an `AbortController` with a 10-second timeout.

### Required Artifacts

| Path                                  | Provides                              | Key Exports                         |
| ------------------------------------- | ------------------------------------- | ----------------------------------- |
| `supabase/functions/_shared/ats.js`   | ATS detection + polling for GH/Lever/Ashby | `export default async function pollAts(careersUrl)` |

### Key Links

| From                            | To                                            | Via                                          |
| ------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `pollAts(careersUrl)`           | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=false` | hostname includes `greenhouse.io` → fetch    |
| `pollAts(careersUrl)`           | `api.lever.co/v0/postings/{slug}?mode=json`   | hostname includes `lever.co` → fetch         |
| `pollAts(careersUrl)`           | `jobs.ashbyhq.com/api/non-user-graphql`       | hostname includes `ashbyhq.com` → POST GraphQL |
| Every `fetch`                   | `AbortController` (10s)                       | `signal: controller.signal` + `setTimeout(() => controller.abort(), 10_000)` |
| Every `fetch`                   | request headers                               | `User-Agent: goed-startup-map`               |
| Phase 3 `refresh-jobs/index.js` | `pollAts`                                     | `import pollAts from '../_shared/ats.js'` (default) |

## Dependency Graph

```
Task 1 (rewrite ats.js to spec)
  needs: nothing (file already exists from Feature 0005; rewrite for compliance)
  creates: supabase/functions/_shared/ats.js (spec-compliant version)
  ↓
Task 2 (verify import + behavior)
  needs: Task 1
  creates: VERIFICATION.md notes (smoke test outputs)
```

## Execution Sequences

| Sequence | Tasks  | Parallel |
| -------- | ------ | -------- |
| 1        | Task 1 | No       |
| 2        | Task 2 | No (depends on 1) |

## Tasks

### Task 1: Rewrite ats.js to match Feature 0004 spec

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/ats.js
</files>

<action>
Rewrite `supabase/functions/_shared/ats.js` so it exports `pollAts` as the **default export** (`export default async function pollAts(careersUrl) { ... }`) and conforms to every Feature 0004 requirement:

1. **Guard input:** Return `null` immediately if `careersUrl` is null/undefined/empty/non-string, or if `new URL(careersUrl)` throws.
2. **Detect platform** by hostname (lowercased), in this order:
   - `greenhouse.io` (matches `boards.greenhouse.io`, `boards-api.greenhouse.io`) → Greenhouse branch
   - `lever.co` (matches `jobs.lever.co`) → Lever branch
   - `ashbyhq.com` (matches `jobs.ashbyhq.com`) → Ashby branch
   - Otherwise return `null`.
3. **Extract slug / board token:** First non-empty path segment of the URL (e.g., `/stripe/...` → `stripe`). If no segment, return `null`.
4. **Greenhouse:** `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=false`. Parse `jobs[]`; return `{ job_titles: jobs.map(j => j.title).filter(Boolean), is_hiring: job_titles.length > 0, careers_url: careersUrl }`.
5. **Lever:** `GET https://api.lever.co/v0/postings/{slug}?mode=json`. Response is a top-level array; map `p.text` → titles.
6. **Ashby (GraphQL):** `POST https://jobs.ashbyhq.com/api/non-user-graphql` with JSON body `{ operationName: 'ApiJobBoardWithTeams', variables: { organizationHostedJobsPageName: slug }, query: '{ jobBoard { jobPostings { title } } }' }` and `Content-Type: application/json`. Map `data.jobBoard.jobPostings[].title` → titles. On 401/403 (unauthenticated rejection) return `null`.
7. **Every fetch call** uses a single helper that:
   - Sets header `User-Agent: goed-startup-map`
   - Wraps the call in an `AbortController` with `setTimeout(() => controller.abort(), 10_000)` and clears the timeout in a `finally` block
   - Returns `null` on thrown errors, non-OK status, or JSON parse failure
8. **No AI imports**, no Gemini, no Claude, no LLM calls — pure `fetch` + URL parsing only.
9. **JSDoc** on the exported `pollAts` documenting `@param {string|null|undefined} careersUrl` and `@returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string} | null>}`. Note in the JSDoc that the function never throws.
10. Keep code style consistent with sibling `_shared/nominatim.js` (2-space indent, single quotes, semicolons used in this Edge Function file already — match the existing file).
</action>

<verify>
1. File exists: `supabase/functions/_shared/ats.js` and contains `export default async function pollAts`.
2. AI-free: `grep -iE "gemini|claude|anthropic|openai|@google/generative-ai" supabase/functions/_shared/ats.js` returns no matches.
3. UA + timeout present: `grep -c "goed-startup-map" supabase/functions/_shared/ats.js` returns ≥ 3 (one per platform branch, or one in a shared helper); `grep -c "AbortController" supabase/functions/_shared/ats.js` returns ≥ 1; `grep -c "10_000\|10000" supabase/functions/_shared/ats.js` returns ≥ 1.
4. Endpoints correct: `grep "boards-api.greenhouse.io/v1/boards/" supabase/functions/_shared/ats.js | grep -q "content=false"` (Greenhouse uses `?content=false`); `grep -q "api.lever.co/v0/postings/" supabase/functions/_shared/ats.js`; `grep -q "jobs.ashbyhq.com/api/non-user-graphql" supabase/functions/_shared/ats.js`.
5. Default export: `grep -q "export default" supabase/functions/_shared/ats.js` returns true.
</verify>

<done>
- [x] `supabase/functions/_shared/ats.js` rewritten with `export default async function pollAts`.
- [x] Greenhouse, Lever, and Ashby (GraphQL) branches present with correct endpoints.
- [x] Every fetch sets `User-Agent: goed-startup-map` and uses a 10-second `AbortController`.
- [x] Module contains zero AI imports.
- [x] JSDoc on the default export describes the return shape and the never-throws contract.

Completed: 2026-05-09
</done>

---

### Task 2: Smoke-test the module from a Deno one-shot

**Type:** auto
**Sequence:** 2

<files>
.project/features/0004/phases/phase-2/VERIFICATION.md
</files>

<action>
Prove the rewritten module imports cleanly under Deno (the Edge Function runtime) and behaves correctly for the four success-criteria inputs. From the repo root:

1. Run a Deno syntax/type check on the file:
   `deno check supabase/functions/_shared/ats.js`
2. Run a one-shot Deno script that imports the module as the default export and exercises the contract. Use `deno eval` (or a temp file under `/tmp/`):
   ```js
   import pollAts from './supabase/functions/_shared/ats.js'
   console.log('null →', await pollAts(null))
   console.log('empty →', await pollAts(''))
   console.log('non-ATS →', await pollAts('https://example.com/careers'))
   console.log('greenhouse →', JSON.stringify(await pollAts('https://boards.greenhouse.io/stripe')))
   ```
   Run with `deno run --allow-net /tmp/ats-smoke.js` (network allowed only for the live Greenhouse hit).
3. Capture each line of output verbatim into `.project/features/0004/phases/phase-2/VERIFICATION.md` under headings: "Deno check", "null/empty inputs", "non-ATS host", "Greenhouse live call". Note in the VERIFICATION.md whether the Greenhouse call returned a real object (network reachable) or `null` (network blocked) — both are acceptable; the contract is "graceful, never throws".
4. If `deno` is not on PATH, fall back to a Node 20+ run (`node --input-type=module -e "..."`) and document the fallback in VERIFICATION.md. Either runtime proves the module is syntactically valid ESM with a default export.
</action>

<verify>
1. `deno check supabase/functions/_shared/ats.js` exits 0 (or the documented Node fallback succeeds).
2. The smoke script runs to completion without throwing — the four `console.log` lines all print.
3. `pollAts(null)` prints `null`; `pollAts('')` prints `null`; `pollAts('https://example.com/careers')` prints `null`.
4. `pollAts('https://boards.greenhouse.io/stripe')` prints either a JSON object containing `job_titles`, `is_hiring`, `careers_url` keys, OR the literal `null` — never an error or rejected promise.
5. `.project/features/0004/phases/phase-2/VERIFICATION.md` exists and records the four outputs and the runtime used.
</verify>

<done>
- [x] Deno (or Node fallback) check passes on the file.
- [x] Smoke script imports the default export without error.
- [x] All four inputs (null, empty, non-ATS, Greenhouse live) behave per contract.
- [x] VERIFICATION.md committed with the recorded outputs.

Completed: 2026-05-09
</done>

## Verification Checklist

- [x] `pollAts('https://boards.greenhouse.io/stripe')` returns either `{ job_titles, is_hiring, careers_url }` or `null` (graceful when API unreachable) — no throw.
- [x] `pollAts(null)` returns `null` without throwing.
- [x] `pollAts('https://example.com/careers')` returns `null`.
- [x] `grep -iE "gemini|claude|anthropic|openai" supabase/functions/_shared/ats.js` finds zero matches.
- [x] Module imports successfully via `import pollAts from '../_shared/ats.js'` (default import) under Deno (or `deno check` passes).
- [x] Every `fetch` in the module sends `User-Agent: goed-startup-map` and is bounded by a 10-second `AbortController` timeout.
- [x] Greenhouse endpoint uses `?content=false`; Ashby uses the GraphQL endpoint `jobs.ashbyhq.com/api/non-user-graphql`; Lever uses `api.lever.co/v0/postings/{slug}?mode=json`.

## Success Criteria

Phase 2 is complete when (a) `supabase/functions/_shared/ats.js` is the spec-compliant default-exporting module above, (b) all five verification-checklist greps and behavior probes pass, and (c) Phase 3 can write `import pollAts from '../_shared/ats.js'` and call it without any further changes to this file.
