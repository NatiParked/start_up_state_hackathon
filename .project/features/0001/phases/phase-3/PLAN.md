# Feature 0001 — Phase 3: Seed Import Script

## Phase Goal

Build the one-time Node ESM script `goed/scripts/import-seed-companies.js` that fetches the published Google Sheet, geocodes each row via Nominatim, derives a Utah region, constructs a logo.dev URL, and inserts all 96 companies into the `map_startups` Supabase table.

---

## Must-Haves (Goal-Backward)

When this phase is done, the following must be TRUE:

### Observable Truths

- Running `node scripts/import-seed-companies.js` from inside `goed/` exits cleanly and prints a single summary line to stdout (total rows, geocode failures, insert failures).
- After the script completes, `select count(*) from map_startups` returns exactly **96**.
- Spot-checking 3 random rows in `map_startups` shows non-null `lat`, `lng`, `region`, `sector`, and `logo_url`.
- Re-running the script does **not** produce duplicate rows (count remains 96) — idempotent via truncate-and-reload.
- Geocode warnings are written to a local log file (e.g. `goed/scripts/import-warnings.log`), never to `console`.
- The script honors the Nominatim 1 req/sec rate limit and identifies itself with `User-Agent: goed-hackathon`.

### Required Artifacts

| Path                                    | Provides                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `goed/scripts/import-seed-companies.js` | One-time ESM runner script: env load → CSV fetch → CSV parse → geocode loop → region derive → logo URL build → Supabase batch insert |
| `goed/scripts/import-warnings.log`      | (Generated at run time) Per-row warnings for failed geocoding / insert errors                                                         |

### Required Wiring

- Reads `goed/.env.local` manually (Vite `import.meta.env` is NOT available in plain Node). Required keys: `VITE_SUPABASE_URL`, Supabase service-role key (or anon key with insert RLS), `VITE_LOGO_DEV_TOKEN`.
- Uses `@supabase/supabase-js` (already installed in Phase 1) — instantiates a client locally inside the script (does NOT import `goed/src/lib/supabase.js`, which uses Vite env).
- Uses Node 20+ built-in `fetch` (no `node-fetch` dependency needed).
- Truncates `map_startups` before inserting to guarantee idempotency.

### Key Links (most likely failure points)

| From                            | To                                | Via                                                              |
| ------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `.env.local` parser             | Supabase client                   | Manual `fs.readFileSync` + line split (NOT `dotenv` if avoidable) |
| Google Sheet `gid=0` CSV URL    | Parsed row objects                | `fetch` → text → CSV parse (handle quoted fields with commas)     |
| Nominatim response              | `lat`/`lng`/`region`              | JSON `[0].lat`, `[0].lon` → bounding-box check                   |
| Bare domain extraction          | logo.dev URL                      | Strip protocol, `www.`, path, query from `Website` value         |
| Sheet column header             | DB column name                    | Exact mapping table — header strings must match published sheet  |

---

## Tasks

### Task 3.1: Script skeleton — env loading, CSV fetch, CSV parse

**Sequence:** 1
**Type:** auto

**Files:**
- `goed/scripts/import-seed-companies.js` (create)

**Steps:**

1. Add JSDoc header block at top of file describing:
   - Purpose (one-time seed import for `map_startups`)
   - Usage: `node scripts/import-seed-companies.js` (run from inside `goed/`)
   - Required env vars in `goed/.env.local`: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (preferred) or `VITE_SUPABASE_ANON_KEY`, `VITE_LOGO_DEV_TOKEN`
   - Side effects: truncates and reloads `map_startups`; appends to `goed/scripts/import-warnings.log`

2. Imports (top of file):
   ```js
   import fs from 'node:fs'
   import path from 'node:path'
   import { fileURLToPath } from 'node:url'
   import { createClient } from '@supabase/supabase-js'
   ```

3. Implement `loadEnv()` — reads `goed/.env.local` from disk (resolve path relative to script's `__dirname`), splits by line, ignores blanks and `#` comments, parses `KEY=VALUE` into a plain object, returns it. Throws if file missing.

4. Implement `fetchSheetCsv(sheetId)` — constructs the published CSV URL using the `gviz/tq?tqx=out:csv` or `pub?output=csv` pattern for the given sheet ID `1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk`. Use `fetch`. Return the response body as text. Throw on non-200.

5. Implement `parseCsv(text)` — handles quoted fields containing commas and newlines. Return an array of row objects keyed by header name. Headers expected (in this exact spelling, normalize whitespace):
   - `Display Type`, `LinkedIn Link`, `Startup Name`, `Full Address`, `Description`, `Website`, `Stage`, `# of Employees`, `Section/Sector`
   - Implementation can be a small hand-rolled parser (CSV with quoted fields) — do NOT add a new npm dependency.

6. Implement `appendWarning(message)` — appends a timestamped line to `goed/scripts/import-warnings.log` (resolved relative to script `__dirname`). Used in place of `console.warn`.

7. Add a `main()` async function that (for now) just calls `loadEnv`, `fetchSheetCsv`, `parseCsv`, then logs `rows.length` to stdout (this is the ONLY allowed `console` call in the script — final summary line). Wire `main().catch(...)` at the bottom of the file.

8. Style: 2-space indent, single quotes, no semicolons, trailing commas, ESM `import`/`export`.

**Done when:**
- File exists at `goed/scripts/import-seed-companies.js`.
- Running `node scripts/import-seed-companies.js` from `goed/` (with `.env.local` in place) prints a single number to stdout matching the row count of the sheet (~96).
- No exceptions thrown; CSV parsing handles quoted fields containing commas correctly.

---

### Task 3.2: Geocoding + region derivation + logo URL

**Sequence:** 2
**Type:** auto

**Files:**
- `goed/scripts/import-seed-companies.js` (modify — extend skeleton from Task 3.1)

**Steps:**

1. Add a module-level constant `UTAH_REGIONS` — array of `{ name, latMin, latMax, lngMin, lngMax }` entries in the order they should be checked:
   ```
   Salt Lake City metro: lat 40.4..41.0, lng -112.3..-111.7
   Utah Valley:          lat 39.9..40.4, lng -112.1..-111.6
   Ogden/Weber:          lat 41.0..41.5, lng -112.3..-111.8
   St. George:           lat 37.0..37.5, lng -114.0..-113.3
   Cache Valley:         lat 41.5..42.0, lng -112.0..-111.5
   ```
   Plus a fallback string `'Other Utah'` when none match.

2. Implement `deriveRegion(lat, lng)`:
   - If `lat == null || lng == null` return `null`.
   - Iterate `UTAH_REGIONS`; return first matching `name`.
   - Return `'Other Utah'` if none match.

3. Implement `geocodeAddress(address)`:
   - URL: `https://nominatim.openstreetmap.org/search?q=<encodeURIComponent(address)>&format=json&limit=1`
   - Fetch with header `User-Agent: goed-hackathon`.
   - Parse JSON. If empty array or no result → return `{ lat: null, lng: null }` and `appendWarning` the address.
   - Else return `{ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) }`.
   - On HTTP error or thrown exception → `appendWarning` the error + address; return `{ lat: null, lng: null }`. Never throw out.

4. Implement `sleep(ms)` — `new Promise(r => setTimeout(r, ms))`. Used for rate limiting.

5. Implement `extractDomain(websiteUrl)`:
   - Trim, lowercase.
   - Strip `http://`, `https://`, leading `www.`, any path/query/hash after the host.
   - Return bare domain (e.g. `example.com`). Return `null` if input is empty/invalid.

6. Implement `buildLogoUrl(domain, token)`:
   - If `domain` is null → return `null`.
   - Else return `https://img.logo.dev/${domain}?token=${token}`.

7. Implement `enrichRow(rawRow, logoToken)` — async function:
   - Map sheet headers to DB columns:
     | Sheet header       | DB column        |
     | ------------------ | ---------------- |
     | `Startup Name`     | `name`           |
     | `Full Address`     | `address`        |
     | `Description`      | `description`    |
     | `Website`          | `website`        |
     | `LinkedIn Link`    | `linkedin`       |
     | `Stage`            | `stage`          |
     | `# of Employees`   | `employee_range` |
     | `Section/Sector`   | `sector`         |
   - Geocode the address.
   - Derive region from the lat/lng.
   - Extract domain from website and build logo URL.
   - Set defaults: `verified: true`, `is_hiring: false`.
   - Return a single object ready for insert into `map_startups`.

8. Update `main()` to:
   - After parsing CSV, iterate rows sequentially with `await sleep(1100)` between geocode calls (1 req/sec with margin).
   - Track `geocodeFailures` count (rows where lat/lng came back null).
   - Collect enriched rows into an array (do not insert yet — that is Task 3.3).

**Done when:**
- For a sample of 3 input rows, `enrichRow()` returns objects with non-null `name`, `address`, `sector`, `logo_url`, and the correct `region` derived from the lat/lng.
- Geocode failures append to `goed/scripts/import-warnings.log` with timestamp + address; no `console.warn` calls exist.
- Total runtime for 96 rows is approximately 96 × 1.1s ≈ 110s (rate limit honored).

---

### Task 3.3: Supabase truncate + batch insert + summary

**Sequence:** 3
**Type:** auto

**Files:**
- `goed/scripts/import-seed-companies.js` (modify — finalize)

**Steps:**

1. Inside `main()`, after enrichment, instantiate the Supabase client:
   - Prefer `SUPABASE_SERVICE_ROLE_KEY` from env (bypasses RLS). Fall back to `VITE_SUPABASE_ANON_KEY` only if service-role key is absent.
   - `createClient(env.VITE_SUPABASE_URL, key, { auth: { persistSession: false } })`.

2. Implement `truncateTable(supabase)`:
   - Execute a delete-all: `await supabase.from('map_startups').delete().neq('id', '00000000-0000-0000-0000-000000000000')` (the `.neq` matches every row since no row will have that sentinel uuid).
   - Append warning if the response has an error; do not throw — let downstream insert proceed and surface the issue in the summary.

3. Implement `batchInsert(supabase, rows, batchSize = 50)`:
   - Slice `rows` into chunks of 50.
   - For each chunk: `await supabase.from('map_startups').insert(chunk)`.
   - On error per chunk: append warning with chunk indices + error message; increment `insertFailures` counter by the chunk's length.
   - Return the total count of successfully inserted rows.

4. In `main()`, call `truncateTable` then `batchInsert(supabase, enrichedRows)`.

5. Print final summary line to stdout (the ONE allowed `console.log` in committed code, since this is a runner script — note the JSDoc header should call this out explicitly):
   ```
   Imported {inserted}/{total} rows | geocode failures: {geocodeFailures} | insert failures: {insertFailures}
   ```

6. Exit with code 0 on success, 1 if `inserted === 0` or any uncaught error.

7. Final review pass:
   - Confirm JSDoc header at top of file is complete and accurate.
   - Confirm style: 2-space indent, single quotes, no semicolons, trailing commas.
   - Confirm only ONE `console` call exists (the summary line).
   - Confirm warnings use `appendWarning()` and write to `goed/scripts/import-warnings.log`.

**Verify (inline — no separate verification phase):**

1. **File exists:** `goed/scripts/import-seed-companies.js` is present, ESM, with JSDoc header.
2. **End-to-end run:** From inside `goed/`, run `node scripts/import-seed-companies.js`. Script completes and prints the summary line.
3. **DB row count:** In Supabase SQL editor, `select count(*) from map_startups;` returns exactly **96**.
4. **Spot check:** `select name, lat, lng, region, sector, logo_url from map_startups limit 3;` — all three rows have non-null values for `lat`, `lng`, `region`, `sector`, `logo_url`.
5. **Idempotency:** Re-run the script. Count remains **96** (no duplicates).
6. **No console pollution:** Only the summary line appears on stdout. Geocode warnings (if any) appear in `goed/scripts/import-warnings.log`.

**Done when:**
- All 6 verify steps above pass.
- `node scripts/import-seed-companies.js` is fully repeatable.

---

## Sequence Summary

| Sequence | Task                                                          | Depends on       |
| -------- | ------------------------------------------------------------- | ---------------- |
| 1        | 3.1 Script skeleton (env, fetch, CSV parse)                   | Phase 1 (deps), Phase 2 (table exists) |
| 2        | 3.2 Geocoding + region derivation + logo URL (extends 3.1)    | 3.1              |
| 3        | 3.3 Supabase truncate + batch insert + summary (finalizes)    | 3.2              |

All three tasks modify the **same file**. They are sequential by design (each builds on the previous), but each is independently verifiable.

---

## Verification Checklist

Phase 3 is complete when **all** of the following are true:

- [x] `goed/scripts/import-seed-companies.js` exists with a JSDoc header block describing usage and side effects.
- [x] Script is JavaScript ESM (no TypeScript), uses `import` syntax, and runs on Node 20+ without extra dependencies beyond `@supabase/supabase-js`.
- [ ] Running `node scripts/import-seed-companies.js` from inside `goed/` completes end-to-end and prints exactly one summary line to stdout.
- [ ] `select count(*) from map_startups;` returns **96** after the script runs.
- [ ] Three randomly selected rows from `map_startups` show non-null `lat`, `lng`, `region`, `sector`, and `logo_url`.
- [ ] `lat`/`lng` values for those rows fall within Utah bounds; `region` matches the appropriate bounding box.
- [ ] Re-running the script yields **96** rows (no duplicates) — idempotent.
- [x] Nominatim calls are rate-limited to ≤1 req/sec and include `User-Agent: goed-hackathon`.
- [x] Geocode warnings are written to `goed/scripts/import-warnings.log`, NOT to console.
- [x] Only the final summary line uses `console`; this is documented in the file's JSDoc header as the single intentional exception.
- [x] Style: 2-space indent, single quotes, no semicolons, trailing commas — consistent throughout.

Completed: 2026-05-09
