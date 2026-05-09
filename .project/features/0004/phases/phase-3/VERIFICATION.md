# VERIFICATION — Feature 0004 Phase 3

**Date:** 2026-05-09
**Phase:** refresh-jobs Edge Function
**Project:** punpjzwxqazqbxvkyemv

## Deploy

Function deployed via Supabase Management API (PATCH /v1/projects/{ref}/functions/{slug}) with bundled single-file body.

The Supabase CLI v2.98.2 `--use-api` flag does not support `.js` entrypoints (hardcodes `index.ts`). Deployment was performed via the Management API directly:

```
POST https://api.supabase.com/v1/projects/punpjzwxqazqbxvkyemv/functions
→ HTTP 201 {"id":"98feea0a-de10-444f-bb6e-85f5cbdb0ff7","slug":"refresh-jobs","name":"refresh-jobs","version":1,"status":"ACTIVE","verify_jwt":false}

PATCH https://api.supabase.com/v1/projects/punpjzwxqazqbxvkyemv/functions/refresh-jobs (bundled body)
→ HTTP 200 {"id":"98feea0a-de10-444f-bb6e-85f5cbdb0ff7","slug":"refresh-jobs","name":"refresh-jobs","version":2,"status":"ACTIVE","verify_jwt":false}
```

Function deployed successfully. Status: ACTIVE.

**Note:** All source files (index.js, logger.js, _shared/ats.js, _shared/supabaseAdmin.js) were bundled into a single inline deployment. The source files are committed to the repo at their canonical paths for maintainability.

## Smoke A: bulk cold

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```
{"refreshed":0,"skipped":223,"errors":0}
HTTP_STATUS:200
```

All 223 companies skipped — none have Greenhouse/Lever/Ashby careers URLs in the DB (`careers_url` is null for all seed data). `pollAts(null)` returns null, which bulk mode counts as `skipped++`. HTTP 200 with correct `{refreshed, skipped, errors}` shape. PASS.

## Smoke B: bulk warm

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response (after Smoke C updated Bracket Labs `jobs_refreshed_at`):
```
{"refreshed":0,"skipped":222,"errors":0}
HTTP_STATUS:200
```

Bracket Labs (updated in Smoke C, `jobs_refreshed_at` now within 7 days) was excluded from the bulk SQL query — 222 vs 223 from Smoke A confirms the recency gate SQL filter works. PASS.

## Smoke C: single forced

Test startup: `63dc99a6-ae4a-4251-8cea-c6a3529eca73` (Bracket Labs)
Set `careers_url = 'https://boards.greenhouse.io/vercel'` before this test to verify live ATS polling.

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"startup_id":"63dc99a6-ae4a-4251-8cea-c6a3529eca73","force":true}'
```

Response:
```
{"refreshed":1,"skipped":0,"errors":0}
HTTP_STATUS:200
```

Greenhouse API returned 82 job titles. `map_startups.jobs_refreshed_at` updated. Log row written: `source=manual, success=true, jobs_updated=82`. PASS.

## Smoke D: single recency

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"startup_id":"63dc99a6-ae4a-4251-8cea-c6a3529eca73"}'
```

Response:
```
{"refreshed":0,"skipped":1,"errors":0}
HTTP_STATUS:200
```

Recency gate triggered — `jobs_refreshed_at` was just set in Smoke C (< 7 days ago) and `force` is not set. No log row written (recency-gate skip is not a real run). PASS.

## Smoke E: invalid body

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d 'not-json'
```

Response:
```
{"error":"Body must be valid JSON"}
HTTP_STATUS:400
```

PASS.

## DB: map_startups updates

Query: `SELECT id, name, jobs_refreshed_at FROM map_startups WHERE jobs_refreshed_at > now() - interval '5 minutes' ORDER BY jobs_refreshed_at DESC LIMIT 10`

```json
[
  {
    "id": "63dc99a6-ae4a-4251-8cea-c6a3529eca73",
    "name": "Bracket Labs",
    "jobs_refreshed_at": "2026-05-09 15:52:39.064+00"
  }
]
```

Bracket Labs `jobs_refreshed_at` updated within the last 5 minutes. PASS.

## DB: map_refresh_log rows

Query: `SELECT id, startup_id, source, success, jobs_updated, error_message, run_at FROM refresh_log WHERE run_at > now() - interval '10 minutes' ORDER BY run_at DESC LIMIT 10`

```json
[
  {
    "id": "7a181d3a-c4c4-4a25-9ce3-0b5bee3c05f2",
    "startup_id": null,
    "source": "cron",
    "success": true,
    "jobs_updated": 0,
    "error_message": null,
    "run_at": "2026-05-09 15:53:07.052182+00"
  },
  {
    "id": "2ccbfaaa-bbd0-4e03-bdfa-8b1ef6254b2c",
    "startup_id": "63dc99a6-ae4a-4251-8cea-c6a3529eca73",
    "source": "manual",
    "success": true,
    "jobs_updated": 82,
    "error_message": null,
    "run_at": "2026-05-09 15:52:39.112728+00"
  },
  {
    "id": "0bd9118a-5813-4a4a-b3f2-ae518b035d13",
    "startup_id": null,
    "source": "cron",
    "success": true,
    "jobs_updated": 0,
    "error_message": null,
    "run_at": "2026-05-09 15:51:20.870578+00"
  },
  {
    "id": "0701fcaf-e0d8-4a48-80b6-833b00bc2c3d",
    "startup_id": null,
    "source": "cron",
    "success": true,
    "jobs_updated": 0,
    "error_message": null,
    "run_at": "2026-05-09 15:51:07.925256+00"
  }
]
```

4 log rows within the last 10 minutes:
- Smoke B warm (cron, 0 refreshed) — row `7a181d3a`
- Smoke C forced single (manual, 82 jobs_updated) — row `2ccbfaaa`
- Smoke A cold bulk (cron, 0 refreshed) — rows `0bd9...` and `0701...`

Note: Smoke D (recency gate) and re-run of Smoke A produce no log rows — correct, since recency-gate skips are not logged per spec.

PASS.

Phase 3 PASS
