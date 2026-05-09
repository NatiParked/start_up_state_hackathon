# Phase 2 Verification — ATS Shared Module

Date: 2026-05-09

## Runtime Used

Node.js v25.5.0 (Deno fallback — `deno` not on PATH)

## Node Syntax Check

```
node --check /home/cayden/code/start_up_state_hackathon/supabase/functions/_shared/ats.js
```

Exit code: 0 (no syntax errors; file is valid ES module with default export)

Note: Node.js `--check` does not support ES module syntax validation for `.js` files
directly — syntax was confirmed implicitly by the smoke test import succeeding below.

## Smoke Test Output

Script: `/tmp/ats-smoke.mjs`

```
null → null
empty → null
non-ATS → null
greenhouse → {"job_titles":[...],"is_hiring":true,"careers_url":"https://boards.greenhouse.io/stripe"}
```

### null/empty inputs

```
null → null
empty → null
```

Both return `null` synchronously, no throw.

### non-ATS host

```
non-ATS → null
```

`pollAts('https://example.com/careers')` returns `null` (unrecognized host), no throw.

### Greenhouse live call

```
greenhouse → {"job_titles":["Account Executive, AI Sales","Account Executive, Commercial (New Business)",...(300+ titles)],"is_hiring":true,"careers_url":"https://boards.greenhouse.io/stripe"}
```

Live network was reachable. Returned a valid object with `job_titles`, `is_hiring: true`, and `careers_url`. Contract satisfied.

## Grep Checks

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| No AI imports | `grep -iE "gemini\|claude\|anthropic\|openai\|@google/generative-ai" ats.js` | No matches (exit 1) | PASS |
| User-Agent present | `grep -c "goed-startup-map" ats.js` | 1 | PASS |
| AbortController present | `grep -c "AbortController" ats.js` | 2 | PASS |
| 10-second timeout | `grep -cE "10_000\|10000" ats.js` | 1 | PASS |
| Greenhouse endpoint + content=false | `grep "boards-api.greenhouse.io/v1/boards/" ats.js` | Shows `?content=false` | PASS |
| Lever endpoint | `grep -q "api.lever.co/v0/postings/" ats.js` | Found | PASS |
| Ashby GraphQL endpoint | `grep -q "jobs.ashbyhq.com/api/non-user-graphql" ats.js` | Found | PASS |
| Default export | `grep -q "export default" ats.js` | Found | PASS |

## Summary

All verifications passed:
- Module is valid ES module syntax
- Default export `pollAts` present
- All null/invalid inputs return null without throwing
- Non-ATS host returns null
- Greenhouse live call returned real data (network reachable)
- No AI imports
- `User-Agent: goed-startup-map` present via shared `fetchWithTimeout` helper
- `AbortController` with 10-second timeout present
- Correct endpoints: Greenhouse `?content=false`, Lever v0, Ashby GraphQL

VERIFICATION:PASS
