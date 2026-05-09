# Quick Plan: Gemini Google Search grounding for company enrichment

## Context

**Files researched:**

- `/home/cayden/code/start_up_state_hackathon/supabase/functions/_shared/llm.js` (107 lines)
  - Currently exports a single `callLLM({ model, systemPrompt, userPrompt, schema })`
  - Default model: `gemini-2.0-flash`; uses `responseMimeType: 'application/json'` + `responseSchema` when `schema` is provided
  - Reads `GOOGLE_AI_API_KEY` from `Deno.env`
  - Has a `toGeminiSchema()` helper that converts JSON Schema → Gemini Schema (still needed for the non-grounding path)

- `/home/cayden/code/start_up_state_hackathon/supabase/functions/_shared/pipeline.js` (385 lines)
  - Step 7 (`// ── Step 7: Claude gap-fill ──`, lines 260-327) is the conditional gap-fill: it builds a JSON Schema only for `missingFields`, calls `callLLM({ ... schema })`, and merges null fields only.
  - Step 8 (lines 329-352) geocodes `record.address` — must remain unchanged.
  - Step 4 (lines 187-217) is the `Promise.allSettled` structured-enricher block — must remain unchanged.
  - Helper `_fieldDescription(field)` at the bottom (lines 368-384) is only consumed by Step 7.
  - `isMissing()` helper (line 90) treats null/undefined/'' as missing — reuse for merge logic.

**Key technical points:**

- Edge function code uses semicolons + JSDoc on exports (per `CONVENTIONS.md`).
- All edge-function imports must end in `.js`.
- Logging convention: `console.error('[pipeline] ...:', err)` / `console.log('[pipeline] ...')`.
- The `gemini-2.0-flash` model supports `tools: [{ google_search: {} }]` for grounding, but Gemini's grounding mode is incompatible with `responseMimeType: 'application/json'` + `responseSchema` — so when grounded we must drop those and parse the response text manually (it may be wrapped in ```` ```json ```` fences).
- Single secret powers AI: `GOOGLE_AI_API_KEY`. No new env vars.
- Sector enum (verbatim from existing system prompt): `fintech, healthtech, edtech, cleantech, enterprise-software, consumer, ecommerce, logistics, biotech, ai-ml, cybersecurity, other`.
- Stage enum: `idea, pre-seed, seed, series-a, series-b, growth, public, other`.

## Tasks

### Task 1 [x]: Add `useGrounding` option + `extractJsonFromText` helper to `_shared/llm.js`

<files>
/home/cayden/code/start_up_state_hackathon/supabase/functions/_shared/llm.js
</files>

<action>
Extend `callLLM()` to accept a new `useGrounding` boolean option in its options object. When `useGrounding === true`:
1. Set `body.tools = [{ google_search: {} }]` on the Gemini request payload.
2. DO NOT set `body.generationConfig.responseMimeType` or `responseSchema` (grounding conflicts with strict-schema mode on `gemini-2.0-flash`). If `schema` is also passed alongside `useGrounding: true`, ignore the `schema` for the request body construction.
3. Return the raw response text (do NOT attempt `JSON.parse`). The caller is responsible for parsing.

When `useGrounding` is falsy/omitted, behavior must be byte-for-byte unchanged from today (the existing schema + `responseMimeType` JSON path stays intact for any other current/future callers).

Also add and export a new helper: `extractJsonFromText(text)`. It must:
- Accept a string.
- Strip leading/trailing whitespace.
- If the text begins with ```` ```json ```` (or just ```` ``` ````) and ends with ```` ``` ````, strip those fences before parsing.
- Run `JSON.parse(stripped)`.
- On any failure (non-string input, no JSON found, parse error), return `null` (do not throw).

Follow existing file conventions: semicolons, JSDoc on exports, JS-only, ES modules. Update the JSDoc on `callLLM()` to document the new option and the conditional return shape (string when `useGrounding` is true, parsed JSON when `schema` is provided, plain string otherwise).
</action>

<verify>
Open the file and confirm:
- `callLLM` signature now destructures `useGrounding` (e.g. `{ model, systemPrompt, userPrompt, schema, useGrounding }`).
- A `useGrounding` branch sets `body.tools = [{ google_search: {} }]` and skips the `generationConfig` schema block.
- `extractJsonFromText` is `export`ed and handles ```` ```json ```` fences + bare ``` fences, returning `null` on failure.
- The non-grounding path still includes `responseMimeType: 'application/json'` and `responseSchema: toGeminiSchema(schema)` when `schema` is passed.

Quick syntax check:
```
deno check /home/cayden/code/start_up_state_hackathon/supabase/functions/_shared/llm.js
```
(If `deno` isn't installed, skip — Task 3's deploy step will surface any syntax errors.)
</verify>

<done>
- `callLLM` accepts and respects a `useGrounding: true` option that adds `tools: [{ google_search: {} }]` and skips `responseSchema` / `responseMimeType`.
- When grounded, `callLLM` returns the raw text string from the Gemini response.
- A new exported `extractJsonFromText(text)` helper strips ```` ```json ```` / ``` fences and returns either the parsed object or `null` on any failure (never throws).
- All existing call sites that pass `schema` (or no `schema`) without `useGrounding` continue to behave identically.
- File still uses semicolons + JSDoc per project conventions.
</done>

---

### Task 2 [x]: Replace conditional gap-fill with always-on grounded LLM call in `_shared/pipeline.js`

<files>
/home/cayden/code/start_up_state_hackathon/supabase/functions/_shared/pipeline.js
</files>

<action>
Replace the current "Step 7: Claude gap-fill" block (lines 260-327, the section under `// ── Step 7: Claude gap-fill ──`) with a new always-on, Gemini-with-grounding call. Specifically:

1. **Update the import** at the top of the file to also pull in `extractJsonFromText`:
   `import { callLLM, extractJsonFromText } from './llm.js';`

2. **Define the full extractable field list** (these are the fields the LLM is asked to fill):
   `name, description, sector, stage, founded_year, address, employee_range, total_raised, investors`
   (Note: 9 fields total. Per the request spec, all of these are to be filled by the grounded LLM call when still null/empty after Steps 4-6.)

3. **Always call the LLM once per submission** (no `if (missingFields.length > 0)` gate). Build:
   - `systemPrompt` — Tell the model it has access to Google Search; instruct it to search the web for the company by URL/domain to find current information; ask for output as a strict JSON object with EXACTLY the keys listed above and no extras; instruct it to use `null` for any field it cannot determine with confidence; specify the sector enum (`fintech, healthtech, edtech, cleantech, enterprise-software, consumer, ecommerce, logistics, biotech, ai-ml, cybersecurity, other`) and the stage enum (`idea, pre-seed, seed, series-a, series-b, growth, public, other`); for `founded_year` ask for a 4-digit integer or null; for `address` ask for full street address like `"123 Main St, Salt Lake City, UT 84101"`; for `employee_range` give examples `"1-10", "11-50", "51-200", "201-500", "500+"`; for `total_raised` give examples `"$5M", "$120M"` or null; for `investors` ask for an array of investor names (may be empty).
   - `userPrompt` — Include `Company URL`, `Domain`, optional `Submitter email` (if `email` is set), a brief "Already known data" JSON snippet (the same partial summary built today: `website`, `dcc_entity_type`, `dcc_status`, `investors`, `total_raised`, `is_hiring`, `job_titles`), then the homepage HTML clearly labeled as `Homepage HTML (truncated, may be empty for SPAs — fall back to web search if so):` followed by `html`.

4. **Log the request**:
   `console.log('[pipeline] Gemini grounded call: requesting <N> fields');`
   where `<N>` is the count of extractable fields (always 9 — but compute from the array so it stays in sync if the list changes).

5. **Invoke** `await callLLM({ systemPrompt, userPrompt, useGrounding: true })`. Wrap in `try/catch`. On error: `console.error('[pipeline] Gemini grounded call failed:', err?.message ?? err);` and skip merge (do not throw — pipeline must remain fail-soft).

6. **Parse** the returned raw text via `extractJsonFromText(text)`. If it returns `null`, log `console.error('[pipeline] Gemini parse error:', String(text).slice(0, 500));` and skip the merge step (still continue to Step 8).

7. **Log** the parsed non-null fields:
   ```
   const filled = Object.entries(parsed).filter(([_, v]) => !isMissing(v)).map(([k]) => k);
   console.log('[pipeline] Gemini returned: ' + filled.join(', '));
   ```

8. **Merge** with strict "fill-only-when-still-missing" semantics — do NOT overwrite any non-null value already on `record`. For each field in the extractable list:
   - For scalar fields (`name`, `description`, `sector`, `stage`, `founded_year`, `address`, `employee_range`, `total_raised`): merge only if `isMissing(record[field])` AND `!isMissing(parsed[field])`.
   - For `investors`: merge only if the existing `record.investors` is null OR an empty array (`[]`), AND `Array.isArray(parsed.investors)` AND `parsed.investors.length > 0`. (Crunchbase always sets `record.investors` to `[]` when it returns nothing — treat empty array as "still missing" for this one field so we get the LLM-discovered investors.)

9. **Remove** the now-unused `_fieldDescription` helper at the bottom of the file (lines 368-384) since the new flow doesn't use a JSON Schema.

10. **Update the file-level JSDoc** Step 7 line (currently "Claude Haiku gap-fill for any still-null fields.") to reflect the new behavior, e.g. "Gemini-with-Google-Search grounded extraction for the full field set; merge only into still-null fields."

11. **Do NOT touch** Steps 1-6 (URL validate, fetch HTML, fetch logo, structured enrichers via `Promise.allSettled`, careers URL/ATS) or Step 8 (geocode) or Step 9 (return). The `Promise.allSettled` fail-soft pattern stays. The geocode block at lines 329-352 stays exactly as-is — note that `record.address` may now be filled by the grounded LLM, so geocoding will benefit downstream.

Follow existing conventions: semicolons, `[pipeline]` log prefix, JSDoc preserved, no TypeScript, JS-only.
</action>

<verify>
1. Confirm the new import line exists at the top:
   ```
   import { callLLM, extractJsonFromText } from './llm.js';
   ```
2. Confirm the old conditional `if (missingFields.length > 0)` and per-field JSON Schema construction is gone, replaced by an unconditional `try { ... await callLLM({ systemPrompt, userPrompt, useGrounding: true }) ... }`.
3. Confirm the merge loop never touches a field where `record[field]` is already non-null/non-empty (special-case for `investors` empty array).
4. Confirm three new `console.log`/`console.error` lines exist matching the spec ("requesting N fields", "returned: ...", "parse error: ...").
5. Confirm `_fieldDescription` is removed.
6. Confirm Steps 4 (`Promise.allSettled`), 6 (ATS), and 8 (geocode) are byte-for-byte unchanged.
</verify>

<done>
- Pipeline always invokes Gemini-with-grounding once per submission (no conditional gate).
- The grounded prompt asks for 9 fields: `name, description, sector, stage, founded_year, address, employee_range, total_raised, investors`.
- Merge logic only fills still-null/empty fields — never overwrites DCC, Crunchbase, ATS, Logo.dev values. Empty `investors` array is treated as "still missing" so LLM-discovered investors land.
- All three required `[pipeline]` log lines are present (request count, returned-field list, parse-error fallback).
- `Promise.allSettled` and geocode steps are unchanged.
- File compiles cleanly when deployed (Task 3).
</done>

---

### Task 3: Deploy and verify with `zonos.com` curl test

<files>
(no file edits — deploy + verification only)
</files>

<action>
Deploy the `onboard-company` edge function (which bundles the two edited shared modules) to the remote Supabase project, then run an end-to-end smoke test against the live function.

Deploy:
```
supabase functions deploy onboard-company --project-ref punpjzwxqazqbxvkyemv
```

Verify with the zonos.com smoke test:
```
time curl -sS -X POST https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/onboard-company \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sb_publishable_pt0gL3bRK-iyja3fjrMZHw_Lamt7p_7' \
  -d '{"url":"https://zonos.com"}' | python3 -m json.tool
```

If response is empty, malformed, or shows an error, pull recent edge logs to diagnose:
```
supabase functions logs onboard-company --project-ref punpjzwxqazqbxvkyemv
```
(Look for the new `[pipeline] Gemini grounded call: requesting 9 fields`, `[pipeline] Gemini returned: ...`, and any `[pipeline] Gemini parse error:` lines.)
</action>

<verify>
The JSON response from the curl command must show:
- Wall-clock time 7-15s (`time` output) — significantly slower than the previous ~2s, indicating the LLM call is now actually completing.
- `company.name` populated (e.g. "Zonos").
- `company.description` populated (1-3 sentence description).
- `company.sector` populated and one of the documented enum values.
- `company.stage` populated and one of the documented enum values.
- `company.founded_year` populated as a 4-digit integer.
- `company.address` populated as a full street address.
- `company.employee_range` likely populated (Zonos is well-known).
- `company.total_raised` likely populated (Zonos is well-funded).
- `status === "auto_published"` (Zonos is in St. George, Utah → Utah-based → auto-published per existing routing rules).
- Edge function logs include `[pipeline] Gemini grounded call: requesting 9 fields` and `[pipeline] Gemini returned: <list>` with at least 5+ field names.
</verify>

<done>
- `supabase functions deploy onboard-company` succeeded against project ref `punpjzwxqazqbxvkyemv`.
- Live zonos.com test returns HTTP 200 in 7-15s with `company.name`, `company.description`, `company.sector`, `company.stage`, `company.founded_year`, and `company.address` all non-null.
- `status === "auto_published"` for the Zonos submission.
- Edge logs confirm the grounded call ran and returned a parseable JSON object.
</done>
