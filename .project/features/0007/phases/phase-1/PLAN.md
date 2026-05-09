# Feature Plan: 0007 — Engagement (Subscriptions & AI Digest), Phase 1: Database Schema & Migration

## Objective

Create migration `supabase/migrations/0009_subscriptions.sql` that adds the `map_subscriptions` and `map_digest_runs` tables (with double opt-in token, RLS, and indexes) so Phases 2-4 (Edge Functions, UI, AI digest) have a working schema to build against.

**Purpose:** This phase is the database foundation for the entire engagement feature. Without these tables, no subscription Edge Function, no confirmation flow, and no weekly digest run can exist.

**Output:** A single new migration file (`supabase/migrations/0009_subscriptions.sql`) plus the inline (commented) reference for the pg_cron weekly schedule. No application code is touched in this phase.

---

## Must-Haves (Goal-Backward)

### Observable Truths (must be TRUE when phase is done)

- The `map_subscriptions` table exists with **all** required columns: `id`, `email`, `filter_criteria`, `frequency`, `last_digest_sent`, `confirm_token`, `confirmed`, `created_at`.
- The `map_subscriptions` table has a **unique constraint on `email`** so duplicate subscribes fail at the DB layer.
- The `map_digest_runs` table exists with `id`, `run_at`, `subscribers_sent`, `errors`.
- RLS is **enabled** on both tables.
- An **anon** (unauthenticated public) client CAN `INSERT` into `map_subscriptions` but CANNOT `SELECT` from it (so visitors can subscribe but cannot enumerate other subscribers' emails).
- The **service-role** client CAN `SELECT` and `UPDATE` `map_subscriptions` (used by `confirm-subscription` and `send-digest` Edge Functions in later phases).
- The **anon** client CANNOT touch `map_digest_runs` at all; only service-role can `INSERT`/`SELECT` it.
- A B-tree index exists on `map_subscriptions(confirmed)` (fast "all confirmed subs" query for the digest).
- A B-tree index exists on `map_subscriptions(email)` (covered by the UNIQUE constraint, but explicitly created for clarity / matches ROADMAP wording).
- The migration file contains a **commented-out** pg_cron schedule block as a reference, with a clear note that it must be applied manually in the SQL editor after `app.supabase_functions_url` and `app.service_role_key` are configured.
- The migration is **idempotent** (safe to re-run): uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DROP POLICY IF EXISTS` before each `CREATE POLICY`, matching the convention in `0002_submissions.sql` and `0006_admin_users.sql`.

### Required Artifacts

| Path                                          | Provides                                                                            | Key Content                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/0009_subscriptions.sql`  | DDL for both new tables, RLS policies, indexes, and a reference pg_cron schedule    | `CREATE TABLE map_subscriptions`, `CREATE TABLE map_digest_runs`, 4 RLS policies, 2 indexes, commented `cron.schedule` |

### Required Wiring

- `map_subscriptions.id` and `map_digest_runs.id` default to `gen_random_uuid()` (already enabled by Supabase by default).
- `confirm_token` defaults to `gen_random_uuid()` so each new row gets a unique opt-in token automatically — Edge Functions in Phase 2 read this column to build the confirmation URL.
- `filter_criteria jsonb` defaults to `'{}'::jsonb` — the AI digest in Phase 4 reads this to filter the startup list per subscriber.
- `confirmed boolean` defaults to `false` — the digest job only sends to rows where `confirmed = true`.
- The pg_cron block (commented) calls `net.http_post` against `current_setting('app.supabase_functions_url') || '/send-digest'` with a service-role bearer token, fires Mondays at 09:00 UTC.

### Key Links (most likely to break)

| From                          | To                                | Via                                                                  |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| Anon supabase-js client       | `map_subscriptions` INSERT        | RLS policy `map_subscriptions_anon_insert` on `auth.role() = 'anon'` |
| Service-role Edge Function    | `map_subscriptions` SELECT/UPDATE | RLS policy on `auth.role() = 'service_role'`                         |
| Service-role Edge Function    | `map_digest_runs` INSERT/SELECT   | RLS policy on `auth.role() = 'service_role'`                         |
| Phase 4 digest job            | "all confirmed subscribers" query | Index `map_subscriptions_confirmed_idx`                              |
| Phase 2 subscribe Edge Fn     | duplicate-email check             | UNIQUE constraint on `map_subscriptions.email`                       |

---

## Dependency Graph

```
Task 1 (write migration file) ──▶ Task 2 (apply migration & verify in Supabase)
```

Task 1 has no dependencies (just authoring SQL). Task 2 depends on Task 1's file existing on disk.

## Execution Sequences

| Sequence | Tasks  | Parallel |
| -------- | ------ | -------- |
| 1        | Task 1 | n/a (single task)        |
| 2        | Task 2 | n/a (single task)        |

---

## Tasks

### Task 1: Author `0009_subscriptions.sql` migration

**Type:** auto
**Sequence:** 1
**Estimated effort:** ~20 minutes

<files>
supabase/migrations/0009_subscriptions.sql
</files>

<action>
Create a new migration file at `supabase/migrations/0009_subscriptions.sql` following the conventions established in `supabase/migrations/0002_submissions.sql` and `supabase/migrations/0006_admin_users.sql`:

1. **Header comment block** (lines 1-12 style of 0006): file name, one-line purpose ("Subscriptions and digest-run tables for the Utah Startup Map AI digest, Feature 0007 Phase 1"), apply instructions (CLI + SQL editor), reminder that map_ prefix is required, and a note that the migration is idempotent.

2. **`map_subscriptions` table** — `CREATE TABLE IF NOT EXISTS` with these exact columns:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `email text NOT NULL`
   - `filter_criteria jsonb NOT NULL DEFAULT '{}'::jsonb`
   - `frequency text NOT NULL DEFAULT 'weekly'`
   - `last_digest_sent timestamptz`
   - `confirm_token uuid NOT NULL DEFAULT gen_random_uuid()`
   - `confirmed boolean NOT NULL DEFAULT false`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - Add a UNIQUE constraint on `email` (use `CONSTRAINT map_subscriptions_email_unique UNIQUE (email)` inline OR a separate `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` — pick the inline form since it's a fresh CREATE).

3. **`map_digest_runs` table** — `CREATE TABLE IF NOT EXISTS` with:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `run_at timestamptz NOT NULL DEFAULT now()`
   - `subscribers_sent int NOT NULL DEFAULT 0`
   - `errors int NOT NULL DEFAULT 0`

4. **Indexes** (both `CREATE INDEX IF NOT EXISTS`):
   - `map_subscriptions_confirmed_idx ON map_subscriptions (confirmed)`
   - `map_subscriptions_email_idx ON map_subscriptions (email)` (explicit even though UNIQUE creates one — match the ROADMAP wording)

5. **Enable RLS** on both tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

6. **RLS policies** — each preceded by `DROP POLICY IF EXISTS ... ON ...;` so the migration is re-runnable:
   - `map_subscriptions_anon_insert` — `FOR INSERT TO anon WITH CHECK (auth.role() = 'anon')`
   - `map_subscriptions_service_select` — `FOR SELECT TO service_role USING (auth.role() = 'service_role')`
   - `map_subscriptions_service_update` — `FOR UPDATE TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
   - `map_digest_runs_service_insert` — `FOR INSERT TO service_role WITH CHECK (auth.role() = 'service_role')`
   - `map_digest_runs_service_select` — `FOR SELECT TO service_role USING (auth.role() = 'service_role')`
   - Do NOT create any anon policy on `map_digest_runs` (denial-by-default with RLS enabled).

7. **pg_cron reference block** at the end of the file as a SQL comment (`/* ... */` block). Include the exact `select cron.schedule('send-digest-weekly', '0 9 * * 1', $$select net.http_post(url := current_setting('app.supabase_functions_url') || '/send-digest', headers := json_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))::jsonb, body := '{}'::jsonb) as request_id$$);` from the ROADMAP. Add a leading comment paragraph explaining: "This block is intentionally commented out. It must be applied manually via the Supabase SQL editor AFTER setting `app.supabase_functions_url` and `app.service_role_key` via `ALTER DATABASE postgres SET app.supabase_functions_url = '...'`. Schedule fires Mondays 09:00 UTC and POSTs to the `send-digest` Edge Function created in Phase 4."

Do NOT touch any other migration file. Do NOT add seed data. Do NOT create any client/Edge code (later phases own that).
</action>

<verify>
1. File exists at the absolute path `/home/cayden/code/start_up_state_hackathon/supabase/migrations/0009_subscriptions.sql`.
2. `grep -c "CREATE TABLE IF NOT EXISTS map_subscriptions" supabase/migrations/0009_subscriptions.sql` returns `1`.
3. `grep -c "CREATE TABLE IF NOT EXISTS map_digest_runs" supabase/migrations/0009_subscriptions.sql` returns `1`.
4. `grep -c "confirm_token uuid NOT NULL DEFAULT gen_random_uuid" supabase/migrations/0009_subscriptions.sql` returns `1`.
5. `grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/0009_subscriptions.sql` returns `2` (one per table).
6. `grep -c "CREATE POLICY" supabase/migrations/0009_subscriptions.sql` returns `5` (one anon-insert + two service on subscriptions + two service on digest_runs).
7. `grep -c "DROP POLICY IF EXISTS" supabase/migrations/0009_subscriptions.sql` returns `5` (one before each CREATE POLICY).
8. `grep -c "CREATE INDEX IF NOT EXISTS" supabase/migrations/0009_subscriptions.sql` returns `2`.
9. `grep -c "cron.schedule" supabase/migrations/0009_subscriptions.sql` returns `1` (inside a comment block — the reference).
10. The cron.schedule line is inside a SQL comment (`/* ... */` or every line prefixed `--`); it is NOT executable. Confirm by searching that the line is not at column 0 without a comment marker.
</verify>

<done>
- [ ] `supabase/migrations/0009_subscriptions.sql` written.
- [ ] All 8 columns present on `map_subscriptions` with correct types and defaults.
- [ ] UNIQUE constraint on `map_subscriptions.email` declared.
- [ ] All 4 columns present on `map_digest_runs`.
- [ ] RLS enabled on both tables.
- [ ] 5 policies created (1 anon-insert + 4 service-role).
- [ ] 2 indexes created (`confirmed`, `email`).
- [ ] pg_cron schedule block included as a comment with explanatory note.
- [ ] Migration is idempotent (every CREATE uses `IF NOT EXISTS`, every CREATE POLICY is preceded by DROP POLICY IF EXISTS).
</done>

---

### Task 2: Apply migration to Supabase and verify schema + RLS

**Type:** auto
**Sequence:** 2
**Estimated effort:** ~15 minutes

<files>
(no files modified — verification-only task; reads remote DB state)
</files>

<action>
Apply the migration written in Task 1 to the live Supabase project (the same project used by the rest of the hackathon — see `goed/src/lib/supabase.js` for the URL) using the Supabase MCP tools.

Steps:
1. Use the Supabase MCP `list_tables` tool to confirm the project's current schema and that `map_subscriptions` / `map_digest_runs` do **not** yet exist (sanity check before applying).
2. Use the Supabase MCP `apply_migration` tool with name `0009_subscriptions` and the full contents of `supabase/migrations/0009_subscriptions.sql` as the SQL body. (If `apply_migration` is unavailable in this environment, fall back to `execute_sql` with the same body.)
3. Use `list_tables` again to confirm both tables now exist.
4. Use `execute_sql` to run these verification queries and capture the results:
   - `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'map_subscriptions' ORDER BY ordinal_position;` — expect 8 rows matching the spec.
   - `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'map_digest_runs' ORDER BY ordinal_position;` — expect 4 rows.
   - `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('map_subscriptions','map_digest_runs');` — expect both rows with `relrowsecurity = true`.
   - `SELECT polname, polcmd, polroles::regrole[] FROM pg_policy WHERE polrelid IN ('map_subscriptions'::regclass, 'map_digest_runs'::regclass) ORDER BY polname;` — expect 5 policies.
   - `SELECT indexname FROM pg_indexes WHERE tablename = 'map_subscriptions' ORDER BY indexname;` — expect at least the two named indexes plus the PK index.
5. Use the Supabase MCP `get_advisors` tool with type `security` to confirm no new RLS-disabled-table warnings were introduced by this migration.
6. Run a functional probe of RLS using `execute_sql` (note: MCP `execute_sql` runs as service-role, so this only proves service-role access; the anon-only insert is verified at policy level above):
   - `INSERT INTO map_subscriptions (email) VALUES ('phase1-verify@example.com') RETURNING id, email, confirm_token, confirmed;` — expect 1 row with `confirmed = false` and a non-null UUID `confirm_token`.
   - `SELECT count(*) FROM map_subscriptions WHERE email = 'phase1-verify@example.com';` — expect 1.
   - `INSERT INTO map_subscriptions (email) VALUES ('phase1-verify@example.com');` — expect a UNIQUE-violation error (this proves the unique constraint is wired).
   - Cleanup: `DELETE FROM map_subscriptions WHERE email = 'phase1-verify@example.com';`.

Record the output of each verification query in the next phase's STATE.md or in a comment on the verification checklist below. Do NOT commit yet (commit happens at phase close-out, not here).
</action>

<verify>
1. `list_tables` output (post-migration) contains both `map_subscriptions` and `map_digest_runs` in the public schema.
2. The 8-column `information_schema.columns` query for `map_subscriptions` returns rows for: `id`, `email`, `filter_criteria`, `frequency`, `last_digest_sent`, `confirm_token`, `confirmed`, `created_at` — and `confirm_token` shows `data_type = 'uuid'` with default `gen_random_uuid()`.
3. The 4-column query for `map_digest_runs` returns rows for: `id`, `run_at`, `subscribers_sent`, `errors`.
4. `pg_class.relrowsecurity` is `true` for both tables.
5. `pg_policy` query returns exactly 5 rows: `map_subscriptions_anon_insert`, `map_subscriptions_service_select`, `map_subscriptions_service_update`, `map_digest_runs_service_insert`, `map_digest_runs_service_select`.
6. `pg_indexes` query for `map_subscriptions` includes `map_subscriptions_confirmed_idx` and `map_subscriptions_email_idx`.
7. Functional probe: insert succeeds, default `confirmed = false`, default `confirm_token` is a non-null UUID, duplicate insert raises a UNIQUE-violation error, cleanup DELETE succeeds.
8. `get_advisors(type='security')` returns no new warnings of category `rls_disabled` for the two new tables.
</verify>

<done>
- [ ] Migration applied to remote Supabase project successfully (no errors from `apply_migration` / `execute_sql`).
- [ ] All 8 verification queries from the action block return the expected results.
- [ ] Functional probe confirms (a) inserts work with defaults, (b) UNIQUE-on-email rejects duplicates, (c) test row cleaned up.
- [ ] `get_advisors` shows no `rls_disabled` warnings for `map_subscriptions` or `map_digest_runs`.
</done>

---

## Verification Checklist (maps 1:1 to ROADMAP success criteria)

- [ ] **Schema — map_subscriptions:** Table exists with all required columns including `confirm_token uuid`, `confirmed boolean`, and `filter_criteria jsonb`. (Verified by Task 2 step 4 query #1.)
- [ ] **Schema — map_digest_runs:** Table exists with `run_at timestamptz`, `subscribers_sent int`, `errors int`. (Verified by Task 2 step 4 query #2.)
- [ ] **RLS enabled:** Both tables have `relrowsecurity = true`. (Verified by Task 2 step 4 query #3 and visible in Supabase dashboard → Table Editor.)
- [ ] **Anon INSERT, no anon SELECT on map_subscriptions:** Policy `map_subscriptions_anon_insert` exists for INSERT to role `anon`; no SELECT/UPDATE policy targets `anon`. (Verified by Task 2 step 4 query #4.)
- [ ] **Service-role full access on map_subscriptions:** Policies `map_subscriptions_service_select` and `map_subscriptions_service_update` exist. (Verified by Task 2 step 4 query #4 and confirmed by the functional probe in Task 2 step 6 succeeding under service-role.)
- [ ] **Service-role-only on map_digest_runs:** Two service-role policies, no anon policies. (Verified by Task 2 step 4 query #4.)
- [ ] **Indexes:** `map_subscriptions_confirmed_idx` and `map_subscriptions_email_idx` exist. (Verified by Task 2 step 4 query #5.)
- [ ] **Idempotent migration:** Re-running the migration produces no errors (verified by the `IF NOT EXISTS` / `DROP POLICY IF EXISTS` audit in Task 1 verify steps 2-7).
- [ ] **pg_cron reference present but inert:** The cron.schedule line is in the migration as a comment, with explanatory text. It is NOT executed by the migration. (Verified by Task 1 verify steps 9-10.)
- [ ] **Confirm-token defaulting:** A row inserted with no `confirm_token` value gets a non-null UUID. (Verified by Task 2 step 6 functional probe.)
- [ ] **Unique-email enforcement:** Duplicate-email INSERT raises a UNIQUE-violation error. (Verified by Task 2 step 6 functional probe.)

---

## Success Criteria

Phase 1 is complete when:

1. `supabase/migrations/0009_subscriptions.sql` exists in the repo and matches the spec in Task 1.
2. The migration has been applied to the live Supabase project without errors.
3. All 11 items in the Verification Checklist above are checked.
4. No `rls_disabled` security advisors are present for the two new tables.
5. Phases 2-4 (subscribe Edge Fn, confirm flow, AI digest) can begin building against the schema with no further DB changes required for their happy paths.
