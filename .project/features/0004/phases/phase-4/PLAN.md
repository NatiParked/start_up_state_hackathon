# Feature Plan: Recurring Data Refresh — Phase 4 (End-to-End Integration & Verification)

## Objective

Confirm the full refresh pipeline operates correctly end-to-end: the cron schedule is registered and wired to the deployed function, manual bulk and single-company triggers produce the correct response shapes, the 7-day recency gate prevents redundant ATS calls, `map_refresh_log` rows are written with correct fields, and the entire cron path contains zero AI library imports.

**Purpose:** Close the feature with observable proof that the three prior phases assemble into a working pipeline. No new source files are produced unless a gap is discovered during testing.

**Output:**
- `.project/features/0004/phases/phase-4/VERIFICATION.md` — verbatim test outputs, SQL query results, and final `Phase 4 PASS` or `Phase 4 FAIL — <reason>`.

## Must-Haves (Goal-Backward)

### Observable Truths (provable in this phase)

- `select * from cron.job where jobname = 'refresh-jobs-weekly';` returns exactly one row with `schedule = '0 6 * * 1'` and `active = true`.
- A manual bulk POST to `/functions/v1/refresh-jobs` with body `{}` returns HTTP 200 and JSON `{ refreshed: N, skipped: M, errors: K }`, and at least one company (with a supported ATS `careers_url`) has `jobs_refreshed_at` updated within the last minute.
- A second immediate bulk POST (no `force`) returns `{ refreshed: 0, skipped: N+M, errors: 0 }` — the recency gate is working.
- A POST with `{ "startup_id": "<uuid-with-known-ATS>", "force": true }` returns `{ refreshed: 1, skipped: 0, errors: 0 }` and that company's `job_titles` and `is_hiring` are updated in `map_startups` within the same invocation.
- `map_refresh_log` contains at least two rows after the test runs; each row has a non-null `run_at`, a valid `source` (`'cron'` or `'manual'`), a boolean `success`, and a `jobs_updated` count consistent with the corresponding response.
- `grep -iE "gemini|claude|anthropic|openai|@google/generative-ai" supabase/functions/refresh-jobs/ supabase/functions/_shared/ats.js` returns zero matches.

### Required Artifacts

| Path | Provides |
|------|---------|
| `.project/features/0004/phases/phase-4/VERIFICATION.md` | Verbatim smoke outputs, SQL results, gap notes (if any), final PASS/FAIL verdict |

## Dependency Graph

```
Task 1 (cron schedule + AI-import check)
  needs: Phase 1 cron migration applied, Phase 3 function deployed
  creates: verification outputs for cron.job query and grep check
  ↓
Task 2 (bulk + recency gate + single-company live tests)
  needs: Task 1 (confirms function is live and cron is wired)
  creates: curl outputs and DB query results for map_startups + map_refresh_log
  ↓
Task 3 (write VERIFICATION.md + update STATE.md)
  needs: Task 2 (collects all evidence)
  creates: VERIFICATION.md with final verdict
```

## Execution Sequences

| Sequence | Tasks  | Parallel                                    |
|----------|--------|---------------------------------------------|
| 1        | Task 1 | No (baseline check before live invocations) |
| 2        | Task 2 | No (tests must run in order for recency gate to be meaningful) |
| 3        | Task 3 | No (depends on all test outputs)            |

## Tasks

### Task 1: Verify cron schedule registration and confirm zero AI imports

**Type:** auto
**Sequence:** 1

<files>
.project/features/0004/phases/phase-4/VERIFICATION.md
</files>

<action>
Run two static checks before live endpoint calls:

1. **Cron schedule check** — via Supabase MCP `execute_sql`:
   ```sql
   select jobid, jobname, schedule, active, command
   from cron.job
   where jobname = 'refresh-jobs-weekly';
   ```
   Expected: exactly one row, `schedule = '0 6 * * 1'`, `active = true`.
   If zero rows returned: this is a gap — the Phase 1 migration did not register the schedule. Apply the fix (run the `select cron.schedule(...)` call from the migration comment with the actual Supabase project URL and service role key via MCP `execute_sql`) before proceeding.
   Record the exact query result.

2. **AI-import grep** — from the shell:
   ```bash
   grep -riE "gemini|claude|anthropic|openai|@google/generative-ai" \
     supabase/functions/refresh-jobs/ \
     supabase/functions/_shared/ats.js
   ```
   Expected: zero matches. If any matches are found, record them as a gap and note the file/line for remediation.

Start writing `.project/features/0004/phases/phase-4/VERIFICATION.md` with two sections:
- `## Check 1: cron.job schedule` — paste query and result verbatim
- `## Check 2: AI-import grep` — paste command and output (or "no matches" if clean)
</action>

<verify>
1. `select jobid, jobname, schedule, active from cron.job where jobname = 'refresh-jobs-weekly'` returns exactly 1 row with `schedule = '0 6 * * 1'` and `active = true`.
2. The grep command exits with no output (zero matches) or only comments containing those strings (none expected).
3. VERIFICATION.md sections `## Check 1` and `## Check 2` exist and contain verbatim output.
</verify>

<done>
- [ ] `cron.job` table contains `refresh-jobs-weekly` row with correct schedule and `active = true`.
- [ ] Zero AI imports found in `refresh-jobs/` and `_shared/ats.js`.
- [ ] Both checks recorded in VERIFICATION.md.
</done>

---

### Task 2: Live endpoint smoke tests (bulk, recency gate, single-company force)

**Type:** auto
**Sequence:** 2

<files>
.project/features/0004/phases/phase-4/VERIFICATION.md
</files>

<action>
Run four live invocations against the deployed `/functions/v1/refresh-jobs` endpoint. Use the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` (or read them via `cat .env.local | grep SUPABASE`). After each curl, run SQL queries via Supabase MCP to confirm DB state.

**Smoke A — bulk cold run:**
```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: HTTP 200, JSON body with keys `refreshed`, `skipped`, `errors` (all non-negative integers). Record the exact JSON. Note the value of `refreshed` (N_A).

Follow with DB check via MCP `execute_sql`:
```sql
select id, name, careers_url, jobs_refreshed_at
from map_startups
where jobs_refreshed_at > now() - interval '2 minutes'
order by jobs_refreshed_at desc
limit 10;
```
If `N_A > 0`, at least one row should appear with a recent `jobs_refreshed_at`. Record the result.

**Smoke B — bulk warm run (recency gate):**
Re-run the identical curl from Smoke A immediately.
Expected: `{ refreshed: 0, skipped: <total companies>, errors: 0 }`. Record exact JSON.

**Smoke C — force-refresh single company:**
Find a company with a known Greenhouse/Lever/Ashby `careers_url` via MCP `execute_sql`:
```sql
select id, name, careers_url
from map_startups
where careers_url ~* 'greenhouse\.io|lever\.co|ashbyhq\.com'
limit 1;
```
POST with that UUID and `force: true`:
```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"startup_id":"<uuid>","force":true}'
```
Expected: `{ refreshed: 1, skipped: 0, errors: 0 }` (or `{ refreshed: 0, skipped: 0, errors: 1 }` if the ATS endpoint is unreachable — both shapes prove the function ran correctly). Record exact JSON.

Follow with DB check for that specific company:
```sql
select id, name, job_titles, is_hiring, jobs_refreshed_at
from map_startups
where id = '<uuid>';
```
Confirm `jobs_refreshed_at` is within the last 2 minutes and (if `refreshed: 1`) `job_titles` is a non-empty array. Record result.

**Smoke D — single-company recency gate:**
Re-run Smoke C immediately WITHOUT `force`:
```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/refresh-jobs" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"startup_id":"<uuid>"}'
```
Expected: `{ refreshed: 0, skipped: 1, errors: 0 }`. Record exact JSON.

**`map_refresh_log` check:**
After all four smokes, query via MCP `execute_sql`:
```sql
select id, startup_id, source, success, jobs_updated, error_message, run_at
from map_refresh_log
where run_at > now() - interval '10 minutes'
order by run_at desc
limit 10;
```
Expected: at least 2 rows (one `source = 'cron'` from Smoke A/B bulk runs, one `source = 'manual'` from Smoke C/D single run). Verify `jobs_updated` matches the `refreshed` count from each curl response. Record result.

Append all smoke outputs and DB queries to VERIFICATION.md under sections:
- `## Smoke A: bulk cold`
- `## Smoke B: bulk warm (recency gate)`
- `## Smoke C: single-company force`
- `## Smoke D: single-company recency gate`
- `## DB: map_startups updates`
- `## DB: map_refresh_log rows`
</action>

<verify>
1. Smoke A: HTTP 200, response has `refreshed`, `skipped`, `errors` keys.
2. Smoke B: `refreshed: 0` and `skipped > 0` — recency gate prevents redundant calls.
3. Smoke C: response has correct shape; if `refreshed: 1`, the target company's `jobs_refreshed_at` is within the last 2 minutes per DB check.
4. Smoke D: `{ refreshed: 0, skipped: 1, errors: 0 }` — single-company recency gate works.
5. `map_refresh_log` has ≥ 2 rows from this session with correct `source`, `success`, and `jobs_updated` values.
6. All six sections appended to VERIFICATION.md with verbatim outputs.
</verify>

<done>
- [ ] Smoke A passed — bulk cold run returns correct shape and updates `jobs_refreshed_at`.
- [ ] Smoke B passed — recency gate returns `refreshed: 0`.
- [ ] Smoke C passed — force-refresh updates exactly one company.
- [ ] Smoke D passed — single-company recency gate returns `skipped: 1`.
- [ ] `map_refresh_log` shows ≥ 2 rows with correct `source` and `jobs_updated`.
- [ ] All smoke outputs recorded in VERIFICATION.md.
</done>

---

### Task 3: Write final verdict and update STATE.md

**Type:** auto
**Sequence:** 3

<files>
.project/features/0004/phases/phase-4/VERIFICATION.md
.project/features/0004/STATE.md
</files>

<action>
1. **Close VERIFICATION.md**: append a `## Summary` section listing each success criterion from the ROADMAP with PASS/FAIL beside it, then a single final line: `Phase 4 PASS` (or `Phase 4 FAIL — <reason>` if any criterion could not be satisfied).

   Success criteria to evaluate (from ROADMAP Phase 4):
   - `cron.job` contains `refresh-jobs-weekly` with schedule `'0 6 * * 1'` → Check 1 result
   - Bulk invocation updates `jobs_refreshed_at` on ≥ 1 company → Smoke A + DB check
   - Second immediate bulk returns `{ refreshed: 0, skipped: N }` → Smoke B
   - Force-refresh updates target company's `job_titles` and `is_hiring` → Smoke C + DB check
   - `map_refresh_log` has ≥ 2 rows with correct fields → `map_refresh_log` DB check
   - Zero AI imports in `refresh-jobs/` and `_shared/ats.js` → Check 2 result

2. **Update STATE.md**: update the Phase 4 row from `Pending` to `✅ Verified`, set its `Completed` date to today, and mark tasks 4.1–4.6 as `✅ Done`. Also add a decision log entry summarizing any gaps found and how they were resolved (or "no gaps found" if all passed cleanly). Update the top-level Status field to reflect the feature is complete.
</action>

<verify>
1. VERIFICATION.md ends with `Phase 4 PASS` or `Phase 4 FAIL — <reason>`.
2. `## Summary` section lists all 6 ROADMAP success criteria with PASS/FAIL.
3. `STATE.md` Phase 4 row shows `✅ Verified` with today's date.
4. `STATE.md` tasks 4.1–4.6 are all `✅ Done`.
5. `STATE.md` decision log has a new entry for Phase 4.
</verify>

<done>
- [ ] VERIFICATION.md complete with `## Summary` and final verdict line.
- [ ] STATE.md updated: Phase 4 verified, all 6 tasks marked done.
- [ ] Decision log entry added to STATE.md.
</done>

## Verification Checklist

- [ ] `select * from cron.job where jobname = 'refresh-jobs-weekly'` returns 1 row, `schedule = '0 6 * * 1'`, `active = true`.
- [ ] Bulk POST `{}` returns HTTP 200 with `{ refreshed: N, skipped: M, errors: K }` and updates `map_startups.jobs_refreshed_at` for ≥ 1 ATS-detected company.
- [ ] Second immediate bulk POST returns `{ refreshed: 0, skipped: N+M, errors: 0 }` — recency gate works.
- [ ] Force-refresh POST `{ "startup_id": "<uuid>", "force": true }` returns `{ refreshed: 1, skipped: 0, errors: 0 }` and `map_startups` row is updated.
- [ ] `map_refresh_log` has ≥ 2 rows from test session; each has correct `source`, `success`, and `jobs_updated`.
- [ ] `grep -iE "gemini|claude|anthropic|openai|@google/generative-ai" supabase/functions/refresh-jobs/ supabase/functions/_shared/ats.js` returns zero matches.
- [ ] VERIFICATION.md ends with `Phase 4 PASS`.
- [ ] STATE.md reflects Phase 4 complete; all tasks 4.1–4.6 marked done.

## Success Criteria

Phase 4 is complete when:
1. `cron.job` contains the `refresh-jobs-weekly` entry with the correct schedule — the cron path is fully wired.
2. Live bulk invocation demonstrates ATS polling works end-to-end (≥ 1 company refreshed, or all skipped due to null `careers_url` — both are valid; the pipeline ran).
3. Recency gate prevents a second immediate bulk run from doing redundant work (`refreshed: 0`).
4. Single-company force-refresh updates exactly that company.
5. `map_refresh_log` faithfully records each invocation's outcome.
6. Zero AI imports confirmed by grep — the cron path is pure ATS HTTP fetching with no AI spend.
7. VERIFICATION.md exists and ends with `Phase 4 PASS`.
