# Feature Plan: AI Onboarding — Phase 2: Core Enrichers & Pipeline Orchestrator

## Objective

Build the seven enricher modules (Crunchbase, Utah DCC, ATS, plus stretch enrichers GitHub / Wappalyzer / ProductHunt / News) and the `pipeline.js` orchestrator that composes them with the Phase 1 helpers (`logo-dev.js`, `nominatim.js`, `llm.js`) into a single end-to-end enrichment routine. Given just a company URL, the pipeline must produce a normalized record matching the `map_startups` column shape, with structured-source data taking priority over Claude gap-fill. This is the heart of the "submission → enriched company record" flow that the Phase 3 Edge Function will invoke.

**Purpose:** Enable a one-URL submission to be transformed into a fully populated company record (logo, location, sector, stage, investors, jobs, registration status) without manual data entry.
**Output:** 7 new enricher modules + 1 orchestrator (`pipeline.js`), all living under `supabase/functions/_shared/`.

## Must-Haves (Goal-Backward)

### Observable Truths

- `runEnrichmentPipeline({ url: 'https://zonos.com' })` returns an object with non-null `name`, `logo_url`, `lat`, `lng`, `sector`, `description`.
- A failure in any single enricher (network error, 4xx/5xx, malformed HTML) does NOT abort the pipeline — `console.error` is logged and the field is left null.
- Crunchbase enricher returns a non-empty `investors` array for a known-funded company, or `{}` for a domain with no Crunchbase profile — never throws.
- Utah DCC enricher returns `{ entity_type, status, registration_date }` for a registered Utah LLC, or `{}` for an unknown name — never throws.
- ATS enricher returns `{ job_titles, is_hiring: true, careers_url }` for a Greenhouse/Lever/Ashby URL, or `null` for a domain with no detected ATS.
- All four stretch enrichers (`github.js`, `wappalyzer.js`, `producthunt.js`, `news.js`) return `{}` silently when their API key env var is absent — no thrown error, no console noise.
- Claude Haiku gap-fill (via `llm.js`) is invoked ONLY for fields still null/empty after API enrichers complete; fields populated by APIs are not overwritten.
- Returned record shape exactly matches `map_startups` columns: `name, description, website, address, city, lat, lng, region, sector, stage, employee_range, founded_year, is_hiring, job_titles, careers_url, logo_url, investors, total_raised, dcc_status, dcc_entity_type`.

### Required Artifacts

| Path | Provides | Key Exports |
| --- | --- | --- |
| `supabase/functions/_shared/ats.js` | ATS detection + jobs scrape (shared with M5) | `pollAts(careersUrl)` |
| `supabase/functions/_shared/enrichers/crunchbase.js` | Investor / funding scrape | `enrichFromCrunchbase(domain)` |
| `supabase/functions/_shared/enrichers/utah-dcc.js` | UT corp registry lookup | `enrichFromUtahDcc(name)` |
| `supabase/functions/_shared/enrichers/github.js` | Public GH org search (stretch) | `enrichFromGithub(domain)` |
| `supabase/functions/_shared/enrichers/wappalyzer.js` | Tech-stack lookup (stretch, key-gated) | `enrichFromWappalyzer(url)` |
| `supabase/functions/_shared/enrichers/producthunt.js` | PH search (stretch) | `enrichFromProductHunt(name)` |
| `supabase/functions/_shared/enrichers/news.js` | NewsAPI headlines (stretch, key-gated) | `enrichFromNews(name)` |
| `supabase/functions/_shared/pipeline.js` | End-to-end orchestrator | `runEnrichmentPipeline({ url, email? })` |

### Required Wiring

- `pipeline.js` imports `normalizeDomain`, `fetchLogo` from `./logo-dev.js`; `geocodeAddress`, `extractCity` from `./nominatim.js`; `callLLM` from `./llm.js`; `pollAts` from `./ats.js`; and each enricher from `./enrichers/<name>.js`.
- All enricher imports use relative paths (e.g. `import { pollAts } from '../ats.js'`) — never absolute, never barrel files.
- Each enricher exports exactly one named function returning a plain JS object (or `null` for `pollAts`); never throws.
- Pipeline runs structured sources via `Promise.allSettled` (parallel where independent) and only THEN invokes Claude gap-fill once for any remaining null fields.

### Key Links

| From | To | Via |
| --- | --- | --- |
| `pipeline.js` | `enrichers/*.js` | `Promise.allSettled([...enricherPromises])` |
| `pipeline.js` | `llm.js` | `callLLM({ schema })` only after structured sources resolve |
| `pollAts` callers | careers URL | URL substring matches `greenhouse.io` / `lever.co` / `ashbyhq.com` — slug from path segment |
| `enrichFromUtahDcc` | `secure.utah.gov/bes/index.html` | form-encoded POST body `entityName={name}` |
| `enrichFromCrunchbase` | `crunchbase.com/organization/{slug}` | scrape `__NEXT_DATA__` then `og:description` fallback |

## Dependency Graph

```
Task 2.1 (ats.js)              ─┐
Task 2.2 (crunchbase.js)        │
Task 2.3 (utah-dcc.js)          │
Task 2.4 (github.js)            ├──→ Task 2.8 (pipeline.js)
Task 2.5 (wappalyzer.js)        │
Task 2.6 (producthunt.js)       │
Task 2.7 (news.js)             ─┘
```

All seven enricher tasks (2.1 – 2.7) only depend on Phase 1 helpers (already present) and have no inter-dependencies. They can be implemented in parallel. Task 2.8 (pipeline) depends on all seven plus the Phase 1 helpers.

## Execution Sequences

| Sequence | Tasks | Parallel? |
| --- | --- | --- |
| 1 | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 | Yes — all independent |
| 2 | 2.8 | Sequential (depends on Sequence 1) |

## Tasks

### Task 2.1: Build ATS detector (`ats.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/ats.js
</files>

<action>
Create `pollAts(careersUrl)`. Detect ATS platform from URL substring: `greenhouse.io` → use `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`; `lever.co` → use `https://api.lever.co/v0/postings/{slug}?mode=json`; `ashbyhq.com` → use `https://api.ashbyhq.com/posting-api/job-board/{slug}` (or `https://jobs.ashbyhq.com/{slug}` JSON if simpler). Extract the slug from the path segment immediately following the host. Fetch the JSON, parse out an array of postings, return `{ job_titles: string[], is_hiring: boolean, careers_url: string }` where `is_hiring` is `job_titles.length > 0`. Return `null` silently for null/empty input, unrecognized hosts, network errors, or non-2xx responses. JSDoc the export. File location is `_shared/ats.js` (NOT under `enrichers/`) because Feature 0005 imports from this exact path.
</action>

<verify>
1. File exists at `supabase/functions/_shared/ats.js` with named export `pollAts`.
2. JSDoc block present on `pollAts`.
3. Sanity check via `deno eval` (or a quick Deno test): calling `pollAts('https://boards.greenhouse.io/zonos')` returns an object with `job_titles` array (or `null` if Zonos isn't on Greenhouse — both are valid pass conditions); `pollAts('https://example.com/careers')` returns `null` without throwing; `pollAts(null)` returns `null` without throwing.
</verify>

<done>
[x] Task 2.1 complete
Completed: 2026-05-09
</done>

### Task 2.2: Build Crunchbase enricher (`enrichers/crunchbase.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/enrichers/crunchbase.js
</files>

<action>
Create `enrichFromCrunchbase(domain)`. Convert `domain` to a Crunchbase slug (lowercase, strip TLD, replace dots with dashes — e.g. `zonos.com` → `zonos`). Fetch `https://www.crunchbase.com/organization/{slug}` with a realistic `User-Agent`. Primary parse path: regex-extract the `<script id="__NEXT_DATA__" type="application/json">…</script>` blob, `JSON.parse` it, and walk for funding/investor data — typical paths include `props.pageProps.searchResults` or `props.pageProps.entity.properties.funding_total`. Map results into `{ investors: string[], total_raised: string, funding_rounds: object[] }`. Fallback: if `__NEXT_DATA__` is missing or doesn't parse, attempt to read the `<meta property="og:description">` for a one-line summary but DO NOT populate funding fields from it — just return `{}` for funding. Return `{}` (not `null`) on any fetch error, parse failure, or missing slug. Wrap everything in try/catch — never throw. JSDoc the export.
</action>

<verify>
1. File exists at `supabase/functions/_shared/enrichers/crunchbase.js` with named export `enrichFromCrunchbase`.
2. JSDoc present.
3. Quick smoke: `enrichFromCrunchbase('zonos.com')` returns either an object containing an `investors` array OR `{}` (both pass — the goal is "no throw"). `enrichFromCrunchbase('this-domain-does-not-exist-9999.com')` returns `{}` without throwing.
</verify>

<done>
[x] Task 2.2 complete
Completed: 2026-05-09
</done>

### Task 2.3: Build Utah DCC enricher (`enrichers/utah-dcc.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/enrichers/utah-dcc.js
</files>

<action>
Create `enrichFromUtahDcc(name)`. POST to `https://secure.utah.gov/bes/index.html` with `Content-Type: application/x-www-form-urlencoded` body containing `queryType=name&registeredAgentName=&entityName={encoded name}&status=&filingType=`. Parse the returned HTML results table to find a row whose entity name (case-insensitive) matches the input. Extract `entity_type`, `status`, `registration_date`, and any visible officer names into an `officers: string[]`. Return `{ entity_type, status, registration_date, officers }`. Return `{}` for empty/null input, no match, network error, or HTML parse failure. Wrap in try/catch — never throw. Use simple regex or `DOMParser` from `deno-dom` if available; if `deno-dom` is not in the import map, fall back to regex-based table-row extraction. JSDoc the export.
</action>

<verify>
1. File exists at `supabase/functions/_shared/enrichers/utah-dcc.js` with named export `enrichFromUtahDcc`.
2. JSDoc present.
3. Smoke check: `enrichFromUtahDcc('Zonos')` returns either an object with at least one of `entity_type` / `status` / `registration_date` populated, OR `{}` — both pass. `enrichFromUtahDcc('Definitely Not A Real Company XYZ 9999')` returns `{}` without throwing. `enrichFromUtahDcc('')` returns `{}` without throwing.
</verify>

<done>
[ ] Task 2.3 complete
</done>

### Task 2.4: Build GitHub enricher (`enrichers/github.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/enrichers/github.js
</files>

<action>
Create `enrichFromGithub(domain)`. Derive `orgName` from `domain` by stripping the TLD and using the first segment (`zonos.com` → `zonos`). Call `https://api.github.com/search/repositories?q=org:{orgName}` with header `Accept: application/vnd.github+json` and (no auth — relies on unauthenticated 10-req/min limit). On 200, parse: `repo_count = json.total_count`, `languages = unique non-null repo.language values from json.items`, `contributor_count = sum of distinct watchers/stargazers across the first page is acceptable as a proxy` (document the proxy in a JSDoc comment if used). Return `{ repo_count, languages, contributor_count }`. Return `{}` silently on 403, 429, any non-2xx, or network error. Wrap in try/catch — never throw. JSDoc the export including the rate-limit note.
</action>

<verify>
1. File exists at `supabase/functions/_shared/enrichers/github.js` with named export `enrichFromGithub`.
2. JSDoc present (including rate-limit note).
3. Smoke: `enrichFromGithub('zonos.com')` returns either a populated object or `{}` — both pass. `enrichFromGithub('nonexistentcompany9999.com')` returns `{}` without throwing.
</verify>

<done>
[x] Task 2.4 complete
Completed: 2026-05-09
</done>

### Task 2.5: Build Wappalyzer stretch enricher (`enrichers/wappalyzer.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/enrichers/wappalyzer.js
</files>

<action>
Create `enrichFromWappalyzer(url)`. Read `WAPPALYZER_API_KEY` via `Deno.env.get`. If absent or empty, return `{}` immediately (no fetch, no log noise — this is a roadmap enricher). If present, call the Wappalyzer Lookup API (`https://api.wappalyzer.com/v2/lookup/?urls={encoded url}`) with header `x-api-key: {key}`. On success, map the response's technology array to `{ tech_stack: string[] }` (extract `.name` from each tech entry). Return `{}` on any non-2xx or fetch error. Wrap in try/catch — never throw. JSDoc the export, noting that an absent key is the expected demo state.
</action>

<verify>
1. File exists at `supabase/functions/_shared/enrichers/wappalyzer.js` with named export `enrichFromWappalyzer`.
2. JSDoc present.
3. Smoke: with `WAPPALYZER_API_KEY` unset, `enrichFromWappalyzer('https://zonos.com')` returns `{}` instantly without making a network call and without throwing.
</verify>

<done>
[x] Task 2.5 complete
Completed: 2026-05-09
</done>

### Task 2.6: Build ProductHunt stretch enricher (`enrichers/producthunt.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/enrichers/producthunt.js
</files>

<action>
Create `enrichFromProductHunt(name)`. Attempt a public ProductHunt search: fetch `https://www.producthunt.com/search?q={encoded name}` and parse the response for the first product hit (extract launch date and upvotes from inline JSON or visible HTML — best-effort regex is fine). If a `PRODUCTHUNT_API_TOKEN` env var is present, prefer their GraphQL API (`https://api.producthunt.com/v2/api/graphql`); otherwise scrape the public page. Return `{ launch_date: string, upvotes: number }` on success, `{}` on empty input, no match, parse failure, fetch error, or rate-limit. Wrap in try/catch — never throw. JSDoc the export.
</action>

<verify>
1. File exists at `supabase/functions/_shared/enrichers/producthunt.js` with named export `enrichFromProductHunt`.
2. JSDoc present.
3. Smoke: `enrichFromProductHunt('Zonos')` returns either a populated object or `{}` — both pass. `enrichFromProductHunt('')` returns `{}` without throwing.
</verify>

<done>
[ ] Task 2.6 complete
</done>

### Task 2.7: Build News stretch enricher (`enrichers/news.js`)

**Type:** auto
**Sequence:** 1

<files>
supabase/functions/_shared/enrichers/news.js
</files>

<action>
Create `enrichFromNews(name)`. Read `NEWS_API_KEY` via `Deno.env.get`. If absent, return `{}` immediately (no fetch, no error). If present, call `https://newsapi.org/v2/everything?q={encoded name}&pageSize=3&sortBy=publishedAt&apiKey={key}`. Map the response's `articles` array to `{ headlines: string[] }` taking up to 3 article titles. Return `{}` on no results, non-2xx, or network error. Wrap in try/catch — never throw. JSDoc the export, noting absent key is the expected demo state.
</action>

<verify>
1. File exists at `supabase/functions/_shared/enrichers/news.js` with named export `enrichFromNews`.
2. JSDoc present.
3. Smoke: with `NEWS_API_KEY` unset, `enrichFromNews('Zonos')` returns `{}` instantly without making a network call and without throwing.
</verify>

<done>
[ ] Task 2.7 complete
</done>

### Task 2.8: Build pipeline orchestrator (`pipeline.js`)

**Type:** auto
**Sequence:** 2

<files>
supabase/functions/_shared/pipeline.js
</files>

<action>
Create `runEnrichmentPipeline({ url, email })`. Orchestration order:

1. Validate `url`; if missing, return an empty/normalized record with `website: null`. Compute `domain = normalizeDomain(url)`.
2. Fetch the company website HTML via `fetch(url)` with a realistic `User-Agent` and a sensible timeout — store the HTML string (truncate to ~50 KB) for later Claude gap-fill. On fetch error, set `html = ''`.
3. Resolve the logo synchronously: `logo_url = fetchLogo(url)`.
4. Run structured-source enrichers in parallel via `Promise.allSettled([...])`:
   - `enrichFromUtahDcc(<best-known name — initially derived from domain root, replaced once Claude returns name>)` — note: name may not be known yet; pass the domain's first segment as a fallback search term.
   - `enrichFromCrunchbase(domain)`
   - `enrichFromGithub(domain)`
   - `enrichFromWappalyzer(url)`
   - `enrichFromProductHunt(domain.split('.')[0])`
   - `enrichFromNews(domain.split('.')[0])`
5. Build a partial record from these results, mapping: `dcc.entity_type → dcc_entity_type`, `dcc.status → dcc_status`, `crunchbase.investors → investors`, `crunchbase.total_raised → total_raised`.
6. Detect a careers URL: try `${url.replace(/\/$/, '')}/careers` as a guess, OR scrape the HTML for any anchor whose href contains `greenhouse.io` / `lever.co` / `ashbyhq.com`. Set `careers_url` accordingly. Then call `pollAts(careers_url)`. If it returns non-null, merge `is_hiring`, `job_titles`, `careers_url` into the record.
7. Claude gap-fill: build a JSON Schema with the still-missing fields (`name`, `description`, `sector`, `stage`, `founded_year`, `address`) — only fields whose value is null/empty/undefined in the partial record. If at least one field is missing, call `callLLM({ systemPrompt, userPrompt, schema })` with the truncated HTML + email + partial record summary as the user prompt. Merge returned values ONLY into fields that were null — never overwrite existing values.
8. Geocode: if `record.address` is now populated, call `geocodeAddress(address)`. Use the result to fill `lat`, `lng`, `city`, `region` (`region` defaults to `'Utah'` for any UT result; otherwise null). If geocode returns null, leave `lat`, `lng`, `city` null.
9. Return a single object with EXACTLY these keys (any unset → null): `name, description, website, address, city, lat, lng, region, sector, stage, employee_range, founded_year, is_hiring, job_titles, careers_url, logo_url, investors, total_raised, dcc_status, dcc_entity_type`.

Implementation rules:
- Wrap each step in try/catch and `console.error` on failure — pipeline continues regardless.
- Use `Promise.allSettled` (NOT `Promise.all`) for parallel groups.
- Default arrays (`job_titles`, `investors`) to `[]` not null when their source ran but returned empty.
- Imports: `import { normalizeDomain } from './logo-dev.js'` etc. — relative paths only, no `_shared/` prefix needed since same dir.
- JSDoc the single exported function with `@param` and `@returns` covering the full output shape.
</action>

<verify>
1. File exists at `supabase/functions/_shared/pipeline.js` with named export `runEnrichmentPipeline`.
2. JSDoc on the export documents both input shape (`{ url, email? }`) and the full 20-field output shape.
3. Imports verified: file references `./logo-dev.js`, `./nominatim.js`, `./llm.js`, `./ats.js`, `./enrichers/crunchbase.js`, `./enrichers/utah-dcc.js`, `./enrichers/github.js`, `./enrichers/wappalyzer.js`, `./enrichers/producthunt.js`, `./enrichers/news.js`.
4. Functional smoke: invoke from a Deno script — `await runEnrichmentPipeline({ url: 'https://zonos.com' })` returns an object with all 20 keys present (some may be null), and at minimum `website` and `logo_url` are non-null. No uncaught exception is thrown even if every API errored. Output object includes the expected keys verified by `Object.keys(result).sort()`.
5. Failure-isolation check: temporarily simulate (or just trust JSDoc + code review) that even if all four stretch enrichers return `{}` and Crunchbase/DCC/ATS all fail, the function still returns a complete-shape object without throwing.
</verify>

<done>
[ ] Task 2.8 complete
</done>

## Verification Checklist

- [ ] All 8 files created at the exact paths listed in the artifacts table.
- [ ] Every exported function has a JSDoc block.
- [ ] `pollAts(null)` and `pollAts('http://example.com/careers')` both return `null` without throwing.
- [ ] `enrichFromCrunchbase('nonexistent99999.com')` returns `{}` without throwing.
- [ ] `enrichFromUtahDcc('')` and `enrichFromUtahDcc('FAKE NAME XYZ')` return `{}` without throwing.
- [ ] `enrichFromGithub('nonexistent99999.com')` returns `{}` without throwing.
- [ ] With `WAPPALYZER_API_KEY` unset → `enrichFromWappalyzer(...)` returns `{}` instantly, no network call.
- [ ] With `NEWS_API_KEY` unset → `enrichFromNews(...)` returns `{}` instantly, no network call.
- [ ] `enrichFromProductHunt('')` returns `{}` without throwing.
- [ ] `runEnrichmentPipeline({ url: 'https://zonos.com' })` returns an object with all 20 keys present and at least `website` + `logo_url` non-null.
- [ ] Pipeline never throws even when every enricher fails — failure is logged via `console.error` only.
- [ ] Pipeline calls `callLLM` only after structured enrichers complete and ONLY for fields still null/empty.
- [ ] All enricher imports use relative paths (`./` or `../`); no barrel `index.js` files anywhere under `_shared/`.
- [ ] All enricher modules use `Deno.env.get(...)` for any secrets (never `process.env`).

## Success Criteria

`runEnrichmentPipeline({ url: 'https://zonos.com' })` returns a normalized 20-field record with at minimum `name`, `website`, `logo_url`, `lat`, `lng`, `sector`, `description` non-null, with structured-source data taking priority over Claude gap-fill, and the call completes without ever throwing — even if every external API errors or every stretch API key is absent. All seven enrichers are individually invocable and degrade silently to `{}` (or `null` for `pollAts`) on failure. The phase is done when Phase 3 (the Edge Function entry point) can `import { runEnrichmentPipeline } from '../_shared/pipeline.js'` and call it as the single source of submission enrichment.
