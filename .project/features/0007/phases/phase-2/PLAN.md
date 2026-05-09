# Feature Plan: 0007 Phase 2 — Send-Digest Edge Function

## Objective

Build the complete `send-digest` Edge Function — a prompt-builder module (`prompts.js`) plus an orchestrator (`index.js`) that queries confirmed subscribers, generates Gemini-written email content per subscriber, sends via Resend, and logs the run to `map_digest_runs`.

**Purpose:** Deliver the AI-written weekly digest pipeline so confirmed subscribers receive personalized or ecosystem-wide updates about Utah's startup activity.

**Output:** Two new files under `supabase/functions/send-digest/` ready to be invoked locally with `supabase functions invoke send-digest --no-verify-jwt`.

---

## Must-Haves (Goal-Backward)

### Observable Truths (what must be TRUE for this phase to be verifiable)

- `supabase/functions/send-digest/prompts.js` exists and exports three named symbols: `SYSTEM_PROMPT` (string), `buildPersonalizedPrompt(subscriber, updates)`, `buildEcosystemPrompt(subscriber, highlights)`.
- Calling `buildPersonalizedPrompt({}, [])` returns a non-empty string (no throws on empty inputs).
- Calling `buildEcosystemPrompt({}, { hiringCount: 0, newestCompany: null, totalCompanies: 0 })` returns a non-empty string.
- Both prompt builders explicitly request a JSON response with keys `{ subject: string, htmlBody: string }`.
- `supabase/functions/send-digest/index.js` exists, handles `OPTIONS` preflight, rejects non-POST methods, and never throws on the empty-subscriber path.
- Invoking the function locally with zero confirmed subscribers returns HTTP 200 with body `{ sent: 0, errors: 0 }`.
- A single subscriber failure (LLM parse error, Resend non-2xx, or query error) increments `errors`, does NOT abort the run, and the outer handler continues to the next subscriber.
- After a successful Resend send, `map_subscriptions.last_digest_sent` is updated to `now()` for that subscriber.
- After every run (success or partial failure), exactly one row is inserted into `map_digest_runs` with `subscribers_sent` and `errors` totals.

### Required Artifacts

| Path                                        | Provides                                           | Key Exports                                                      |
| ------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `supabase/functions/send-digest/prompts.js` | Prompt strings/builders for LLM JSON-mode digests  | `SYSTEM_PROMPT`, `buildPersonalizedPrompt`, `buildEcosystemPrompt` |
| `supabase/functions/send-digest/index.js`   | Deno.serve orchestrator: subscribers → LLM → Resend → log | (no exports — Deno entrypoint)                                   |

### Key Links

| From                                          | To                                          | Via                                                                                  |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `index.js`                                    | `prompts.js`                                | `import { SYSTEM_PROMPT, buildPersonalizedPrompt, buildEcosystemPrompt } from './prompts.js'` |
| `index.js`                                    | `_shared/supabaseAdmin.js`                  | `import { createAdminClient } from '../_shared/supabaseAdmin.js'`                    |
| `index.js`                                    | `_shared/llm.js`                            | `import { callLLM } from '../_shared/llm.js'`                                        |
| `index.js`                                    | `map_subscriptions` (DB)                    | `select * where confirmed = true` + `update last_digest_sent`                        |
| `index.js`                                    | `map_startups` (DB)                         | filter by sector/stage/region containment + `created_at`/`updated_at` > `last_digest_sent` |
| `index.js`                                    | `map_digest_runs` (DB)                      | single `insert` with `{ subscribers_sent, errors }`                                  |
| `index.js`                                    | Resend HTTP API                             | `fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer …' } })` |
| Resend email body                             | `/subscribe?unsubscribe=<confirm_token>`    | Inline HTML `<p>` footer using `subscriber.confirm_token` (NOT `subscriber.id`)      |

---

## Dependency Graph

```
Task 2.1 (no deps)               → creates: supabase/functions/send-digest/prompts.js
Task 2.2 (needs 2.1's exports)   → creates: supabase/functions/send-digest/index.js
```

`index.js` imports `SYSTEM_PROMPT`, `buildPersonalizedPrompt`, and `buildEcosystemPrompt` directly from `./prompts.js`. Task 2.2 cannot be verified until 2.1 is on disk.

---

## Execution Sequences

| Sequence | Tasks    | Parallel |
| -------- | -------- | -------- |
| 1        | Task 2.1 | No (root) |
| 2        | Task 2.2 | No (depends on 2.1) |

---

## Tasks

### Task 2.1: Create `send-digest/prompts.js` — system prompt + two prompt builders

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/send-digest/prompts.js
</files>

<action>
Create the prompt-builder module for the send-digest Edge Function. Three named exports, JSDoc on each, semicolons throughout (Deno convention).

1. `export const SYSTEM_PROMPT` — a single template-literal string establishing the AI as a Utah startup ecosystem analyst writing weekly subscriber updates. Tone: informative, concise, professional, no marketing fluff. Must instruct the model to ground its writing in Utah's startup context (Silicon Slopes, SLC/Provo/Ogden, etc.) and to ALWAYS respond with valid JSON shaped exactly `{ "subject": string, "htmlBody": string }` — no markdown, no code fences.

2. `export function buildPersonalizedPrompt(subscriber, updates)` — receives a subscriber row (with `filter_criteria` jsonb containing `{ sectors, stages, regions, hiring_only, investor }`) and an array of company update rows from `map_startups`. Returns a user-prompt string that:
   - Summarizes which sectors/stages/regions the subscriber follows (read from `subscriber.filter_criteria`; gracefully handle missing/empty arrays so calling with `{}` does NOT throw).
   - Embeds the `updates` array as a serialized list of company facts (name, sector, stage, region, is_hiring, description if present, created_at) — keep it compact but informative.
   - Instructs the model to write a subject line plus a 2–4 paragraph HTML email body covering what changed in their watched space this week.
   - Re-emphasizes the JSON response shape `{ subject, htmlBody }`.
   - Returns a non-empty string even when `updates` is `[]` and `subscriber` is `{}`.

3. `export function buildEcosystemPrompt(subscriber, highlights)` — receives subscriber row + a `highlights` object `{ hiringCount: number, newestCompany: object|null, totalCompanies: number }`. Returns a user-prompt string that:
   - Acknowledges the subscriber had no matches in their watched filters this week.
   - Embeds the three highlight numbers/objects as ecosystem-wide context.
   - Instructs the model to write subject line + 2–3 paragraph HTML email body covering broader Utah startup activity (hiring momentum, newest entrant, total ecosystem size).
   - Re-emphasizes the JSON response shape `{ subject, htmlBody }`.
   - Must not throw when `highlights.newestCompany` is `null` or when `subscriber` is `{}`.

Use plain string concatenation or template literals — no external dependencies. No imports needed.
</action>

<verify>
1. File exists at `supabase/functions/send-digest/prompts.js`.
2. File contains three top-level `export` statements: `export const SYSTEM_PROMPT`, `export function buildPersonalizedPrompt`, `export function buildEcosystemPrompt`.
3. Smoke-test in a Deno repl or `deno eval`:
   ```
   deno eval "import('./supabase/functions/send-digest/prompts.js').then(m => { console.log(typeof m.SYSTEM_PROMPT === 'string' && m.SYSTEM_PROMPT.length > 0); console.log(typeof m.buildPersonalizedPrompt({}, []) === 'string' && m.buildPersonalizedPrompt({}, []).length > 0); console.log(typeof m.buildEcosystemPrompt({}, { hiringCount: 0, newestCompany: null, totalCompanies: 0 }) === 'string' && m.buildEcosystemPrompt({}, { hiringCount: 0, newestCompany: null, totalCompanies: 0 }).length > 0); })"
   ```
   All three lines must print `true`.
4. Both prompt-builder return values contain the literal substring `{ subject` (or equivalent JSON-shape directive) so the LLM is instructed to return the destructure-friendly shape.
5. Domain complete: prompts module is import-safe and produces non-empty strings for the empty-subscriber and empty-updates cases — guaranteeing `index.js` can never crash on prompt construction.
</verify>

<done>
A Deno import of `./prompts.js` resolves cleanly and returns three truthy exports, with both `buildPersonalizedPrompt({}, [])` and `buildEcosystemPrompt({}, { hiringCount: 0, newestCompany: null, totalCompanies: 0 })` returning non-empty strings.
</done>

---

### Task 2.2: Create `send-digest/index.js` — orchestrator (subscribers → LLM → Resend → log)

**Type:** auto
**Sequence:** 2

<files>
supabase/functions/send-digest/index.js
</files>

<action>
Create the Deno Edge Function entrypoint. Follow the existing `approve-submission/index.js` style: file-level JSDoc, `corsHeaders` const, inline `jsonResponse` and `errorResponse` helpers (do NOT import them — locked convention), semicolons throughout, `Deno.serve` handler.

**File header:** JSDoc block stating purpose ("send-digest — generates and emails the weekly AI digest to confirmed subscribers") and a service-role-only auth note.

**Imports:**
```
import { createAdminClient } from '../_shared/supabaseAdmin.js';
import { callLLM } from '../_shared/llm.js';
import { SYSTEM_PROMPT, buildPersonalizedPrompt, buildEcosystemPrompt } from './prompts.js';
```

**Constants/helpers (above `Deno.serve`):**
- `corsHeaders` — same shape as `approve-submission/index.js` (Origin `*`, Headers `authorization, x-client-info, apikey, content-type`, Methods `POST, OPTIONS`).
- `function jsonResponse(body, status = 200)` — returns `new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })`.
- `function errorResponse(code, message, status = 500)` — returns `jsonResponse({ error: message, code }, status)`.

**Deno.serve handler — wrap the entire body in an outer try/catch returning `errorResponse(500, 'internal_error', 500)` on unexpected crash:**

1. **CORS preflight:** if `req.method === 'OPTIONS'` → `return new Response(null, { status: 204, headers: corsHeaders })`.

2. **Method guard:** if `req.method !== 'POST'` → `return errorResponse(405, 'method_not_allowed', 405)`.

3. **Env + client:**
   - `const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');`
   - If missing → `throw new Error('RESEND_API_KEY env var is required')` (caught by outer try/catch).
   - `const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';` — add a `// NOTE:` comment explaining `onboarding@resend.dev` is the Resend sandbox sender used for hackathon demo; production must set `RESEND_FROM_EMAIL` to a verified-domain address.
   - `const adminClient = createAdminClient();`

4. **Fetch confirmed subscribers:**
   ```
   const { data: subscribers, error: subsError } = await adminClient
     .from('map_subscriptions')
     .select('*')
     .eq('confirmed', true);
   if (subsError) throw subsError;
   ```

5. **Initialize counters:** `let subscribersSent = 0; let errors = 0;`

6. **Loop subscribers** with `for (const subscriber of subscribers ?? []) { try { … } catch (err) { console.error('subscriber failed', subscriber.email, err); errors += 1; } }`. Per-subscriber try/catch ensures one failure never aborts the run.

   Inside the per-subscriber try block:

   a. **Determine `lastDigestSent`** — `subscriber.last_digest_sent ?? '1970-01-01T00:00:00Z'` (so first-time subscribers match all rows).

   b. **Build the `map_startups` query for matching updates:**
      - Start `let query = adminClient.from('map_startups').select('*').or(\`created_at.gt.${lastDigestSent},updated_at.gt.${lastDigestSent}\`);`
      - Read filter arrays: `const fc = subscriber.filter_criteria ?? {};`
      - If `Array.isArray(fc.sectors) && fc.sectors.length > 0` → `query = query.in('sector', fc.sectors);`
      - If `Array.isArray(fc.stages) && fc.stages.length > 0` → `query = query.in('stage', fc.stages);`
      - If `Array.isArray(fc.regions) && fc.regions.length > 0` → `query = query.in('region', fc.regions);`
      - If `fc.hiring_only === true` → `query = query.eq('is_hiring', true);`
      - `const { data: updates, error: updatesError } = await query;`
      - If `updatesError` → throw to per-subscriber catch.

   c. **Mode selection:**
      - If `(updates?.length ?? 0) >= 1` → `mode = 'personalized'; userPrompt = buildPersonalizedPrompt(subscriber, updates);`
      - Else → `mode = 'ecosystem_highlights';` then run three highlight queries (use `count: 'exact', head: true` for counts):
        - `hiringCount`: `await adminClient.from('map_startups').select('*', { count: 'exact', head: true }).eq('is_hiring', true);` → use `.count`.
        - `totalCompanies`: `await adminClient.from('map_startups').select('*', { count: 'exact', head: true });` → use `.count`.
        - `newestCompany`: `await adminClient.from('map_startups').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();` → use `.data` (may be `null`).
        - Then `userPrompt = buildEcosystemPrompt(subscriber, { hiringCount, newestCompany, totalCompanies });`

   d. **Call LLM:**
      ```
      const llmResult = await callLLM({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            htmlBody: { type: 'string' },
          },
          required: ['subject', 'htmlBody'],
        },
      });
      ```
      Defensive parse: if `llmResult` is a string (callLLM fallback), `JSON.parse` it inside try/catch; on parse failure → `console.error('llm parse failed', subscriber.email)` and `throw` to bump `errors`. Destructure `{ subject, htmlBody }`.

   e. **Build unsubscribe footer + Resend payload:**
      ```
      const unsubscribeUrl = `${Deno.env.get('PUBLIC_SITE_URL') ?? 'https://utah-startup-map.com'}/subscribe?unsubscribe=${subscriber.confirm_token}`;
      const unsubscribeFooter = `<p style="font-size:12px;color:#888;margin-top:32px;">You're receiving this because you subscribed to Utah Startup Map digests. <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>`;
      const resendPayload = {
        from: `Utah Startup Map <${RESEND_FROM_EMAIL}>`,
        to: subscriber.email,
        subject,
        html: htmlBody + unsubscribeFooter,
      };
      ```
      Note in a comment: unsubscribe identifier is `confirm_token` (locked decision — NOT `subscriber.id`).

   f. **Send via Resend:**
      ```
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendPayload),
      });
      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        console.error('resend failed', subscriber.email, resendRes.status, errBody);
        throw new Error(`resend status ${resendRes.status}`);
      }
      ```

   g. **On success:** update `last_digest_sent` and increment counter:
      ```
      await adminClient
        .from('map_subscriptions')
        .update({ last_digest_sent: new Date().toISOString() })
        .eq('id', subscriber.id);
      subscribersSent += 1;
      ```

7. **Log the run** (after the loop, regardless of partial failures):
   ```
   await adminClient
     .from('map_digest_runs')
     .insert({ subscribers_sent: subscribersSent, errors });
   ```
   Wrap in its own try/catch — log on failure but do not let it overwrite the response.

8. **Return:** `return jsonResponse({ sent: subscribersSent, errors }, 200);`

The outer try/catch (around the whole handler) returns `errorResponse(500, err.message ?? 'internal_error', 500)` on any unexpected throw.
</action>

<verify>
1. File exists at `supabase/functions/send-digest/index.js`.
2. File begins with a JSDoc block and contains the three required imports (`createAdminClient`, `callLLM`, and the three named exports from `./prompts.js`).
3. File contains inline `corsHeaders`, `jsonResponse`, and `errorResponse` definitions (NOT imported).
4. `OPTIONS` preflight returns `204` with CORS headers; non-POST methods return `405`.
5. With Supabase running locally and zero confirmed subscribers in `map_subscriptions`, invoking:
   ```
   supabase functions serve send-digest --no-verify-jwt
   curl -X POST http://localhost:54321/functions/v1/send-digest -H 'Content-Type: application/json' -d '{}'
   ```
   returns HTTP 200 with body `{"sent":0,"errors":0}` and inserts exactly one row into `map_digest_runs` with `subscribers_sent=0, errors=0`.
6. Searching the file for the literal `confirm_token` confirms the unsubscribe link uses `subscriber.confirm_token` (NOT `subscriber.id`).
7. Searching the file for the literal `Bearer ${RESEND_API_KEY}` (or equivalent backtick-template form) confirms Resend Authorization header is built correctly.
8. Searching the file for `subscribers_sent` and `errors` confirms the `map_digest_runs` insert payload uses both column names.
9. Domain complete: an empty-subscriber-table run completes without throwing, returns the documented JSON, and writes a digest-run row — proving the orchestrator's control flow, env handling, DB wiring, and response shape are all correct end-to-end (the per-subscriber send path can be validated manually in staging or with a fixture row).
</verify>

<done>
A local invocation against an empty `map_subscriptions` table returns HTTP 200 with body `{"sent":0,"errors":0}` and inserts a single corresponding row into `map_digest_runs`.
</done>

---

## Verification Checklist

Maps 1:1 to the ROADMAP.md success criteria:

- [ ] `supabase/functions/send-digest/prompts.js` exports `SYSTEM_PROMPT`, `buildPersonalizedPrompt`, and `buildEcosystemPrompt`.
- [ ] `buildPersonalizedPrompt({}, [])` returns a non-empty string (no throws).
- [ ] `buildEcosystemPrompt({}, { hiringCount: 0, newestCompany: null, totalCompanies: 0 })` returns a non-empty string (no throws).
- [ ] Both prompt builders explicitly request a JSON response shaped `{ subject: string, htmlBody: string }`.
- [ ] `supabase/functions/send-digest/index.js` exists and handles `OPTIONS` preflight (returns 204).
- [ ] `index.js` rejects non-POST methods with 405.
- [ ] Calling the function with a service-role JWT and zero confirmed subscribers returns HTTP 200 with `{ sent: 0, errors: 0 }` and does NOT throw.
- [ ] The function can be invoked via `supabase functions invoke send-digest --no-verify-jwt` locally and produces the expected 200 response.
- [ ] Unsubscribe footer URL uses `subscriber.confirm_token` (locked decision, NOT `subscriber.id`).
- [ ] One row is inserted into `map_digest_runs` per invocation (even when zero subscribers).
- [ ] Per-subscriber failures increment `errors` and are caught — they never abort the run.
- [ ] On Resend success, `map_subscriptions.last_digest_sent` is updated to `now()` for that subscriber.

---

## Success Criteria

The phase is complete when:

1. Both files exist at the paths above and conform to the JS-only / semicolons-in-Deno / inline-helpers / `confirm_token`-as-unsubscribe locked conventions.
2. A local `supabase functions invoke send-digest --no-verify-jwt` against an empty `map_subscriptions` table returns HTTP 200 with `{ sent: 0, errors: 0 }`.
3. After that invocation, `select * from map_digest_runs order by run_at desc limit 1;` shows a fresh row with `subscribers_sent = 0` and `errors = 0`.
4. Static smoke-import of `prompts.js` in Deno proves all three exports are present and the two prompt builders return non-empty strings on empty inputs.
