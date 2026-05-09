# Feature Plan: 0008 Phase 1 — Database & View Tracking Migration

## Objective

Establish the `company_views` table with proper RLS, indexes, and a `get_company_view_stats` RPC so downstream phases (Edge Function, analytics panel, digest backfill) have a stable, queryable shape to build against.

**Purpose:** Without this schema in place, no view tracking can be recorded and no analytics surface can read aggregated counts. This phase is the data foundation for the entire feature.
**Output:** One new migration file applied to the Supabase project, creating the `company_views` table, an aggregate index, an `INSERT`-only anon RLS policy, and the `get_company_view_stats(uuid)` security-definer RPC.

## Must-Haves (Goal-Backward)

### Observable Truths

- An anon Supabase client can `INSERT` a row into `company_views` (so the future `track-view` Edge Function called with the anon key will succeed).
- An anon Supabase client cannot `SELECT` directly from `company_views` (raw view rows are private).
- An anon Supabase client can `rpc('get_company_view_stats', { p_startup_id })` and receive `{ views_this_week, views_total }` as numeric counts (zero when no rows exist).
- Deleting a `map_startups` row cascade-deletes its `company_views` rows (no orphans).
- The migration is idempotent enough to apply cleanly via Supabase MCP (mirrors the workflow used in Feature 0001 Phase 2).

### Required Artifacts

| Path                                      | Provides                                                       | Key Exports                                                                                |
| ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `supabase/migrations/0012_view_counts.sql` | Schema for view tracking (table + index + RLS + RPC + grants) | `company_views` table; `company_views_startup_id_viewed_at_idx` index; `get_company_view_stats(uuid)` RPC |

### Key Links

| From                                  | To                                | Via                                                  |
| ------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `company_views.startup_id`            | `map_startups.id`                 | Foreign key with `on delete cascade`                 |
| Anon role                             | `company_views` insert            | RLS policy `for insert to anon with check (true)`    |
| Anon / authenticated roles            | `get_company_view_stats(uuid)`    | `grant execute` on the function                      |
| `get_company_view_stats` (definer)    | `company_views` rows              | `security definer` + fixed `search_path = public`    |

## Dependency Graph

```
Task 1.1 (needs nothing)
  → creates: supabase/migrations/0012_view_counts.sql

Task 1.2 (needs 1.1)
  → consumes: supabase/migrations/0012_view_counts.sql
  → creates: applied schema in the live Supabase project (table, index, policy, RPC, grants)
```

## Execution Sequences

| Sequence | Tasks    | Parallel |
| -------- | -------- | -------- |
| 1        | Task 1.1 | —        |
| 2        | Task 1.2 | —        |

## Tasks

### Task 1.1: Author `0012_view_counts.sql`

**Type:** auto
**Sequence:** 1

<files>
supabase/migrations/0012_view_counts.sql
</files>

<action>
Create the migration file `supabase/migrations/0012_view_counts.sql` for Feature 0008 Phase 1. Match the comment-header style of `0011_admin_map_subscriptions_rls.sql` (file name, one-line purpose, feature reference, idempotency note). Make every statement idempotent (`create table if not exists`, `create index if not exists`, `drop policy if exists` then `create policy`, `create or replace function`).

The migration must contain exactly the following structural elements:

1. Table `company_views` with columns:
   - `id uuid primary key default gen_random_uuid()`
   - `startup_id uuid not null references map_startups(id) on delete cascade`
   - `viewed_at timestamptz not null default now()`
   - `session_id text not null`
2. B-tree index `company_views_startup_id_viewed_at_idx` on `company_views(startup_id, viewed_at desc)`.
3. `alter table company_views enable row level security;`
4. RLS policy named `company_views_anon_insert` allowing `for insert to anon with check (true)`. Do NOT create any `select` policy — absence of one means anon `select` is blocked.
5. Function:
   ```
   create or replace function get_company_view_stats(p_startup_id uuid)
   returns table (views_this_week bigint, views_total bigint)
   language sql
   security definer
   set search_path = public
   as $$
     select
       count(*) filter (where viewed_at >= now() - interval '7 days') as views_this_week,
       count(*) as views_total
     from company_views
     where startup_id = p_startup_id
   $$;
   ```
6. `grant execute on function get_company_view_stats(uuid) to anon, authenticated;`

Do not invent extra columns, additional policies, triggers, or seed data — the four success criteria define the entire surface area. SQL keywords lowercased to match precedent in `0011_admin_map_subscriptions_rls.sql`'s policy block (mixed-case OK in DDL section headers per existing file). 2-space indent inside SQL bodies.
</action>

<verify>
1. File exists: `supabase/migrations/0012_view_counts.sql` is present and non-empty.
2. Static check: file contains the literal strings `create table if not exists company_views`, `references map_startups(id) on delete cascade`, `company_views_startup_id_viewed_at_idx`, `enable row level security`, `for insert`, `to anon`, `create or replace function get_company_view_stats`, `security definer`, `set search_path = public`, and `grant execute on function get_company_view_stats(uuid) to anon, authenticated`.
3. Negative check: file does NOT contain any `for select` policy on `company_views` (anon select must remain blocked).
4. Numbering check: no other file in `supabase/migrations/` is named `0012_*.sql` (this is the next sequential slot after `0011_admin_map_subscriptions_rls.sql`).
</verify>

<done>
`supabase/migrations/0012_view_counts.sql` exists, is idempotent, and encodes the table + index + RLS + RPC + grants exactly as enumerated. The file has not been applied yet — Task 1.2 owns application.
</done>

---

### Task 1.2: Apply migration via Supabase MCP and verify the RPC

**Type:** auto
**Sequence:** 2

<files>
supabase/migrations/0012_view_counts.sql (read-only — applied, not modified)
</files>

<action>
Apply the migration authored in Task 1.1 to the live Supabase project using the Supabase MCP `apply_migration` tool (the same workflow Feature 0001 Phase 2 used). Pass the migration name `0012_view_counts` and the SQL body read from `supabase/migrations/0012_view_counts.sql`.

After application succeeds, run read-only SQL probes via the Supabase MCP `execute_sql` tool to prove every ROADMAP success criterion:

1. Confirm the table shape: query `information_schema.columns` for `company_views` and assert all four columns (`id`, `startup_id`, `viewed_at`, `session_id`) exist with the expected types.
2. Confirm the index exists: query `pg_indexes` for `indexname = 'company_views_startup_id_viewed_at_idx'`.
3. Confirm RLS is enabled and the insert policy is present: query `pg_policies` for `tablename = 'company_views'` and assert one row with `cmd = 'INSERT'` and `roles` containing `anon`; assert NO row with `cmd = 'SELECT'`.
4. Smoke-test the RPC with a real `map_startups.id`: pick any existing id via `select id from map_startups limit 1` and call `select * from get_company_view_stats('<that uuid>')`. Both columns must return `0` (bigint) for an unseeded company.
5. Cascade probe (read-only — DO NOT actually delete a real row): inspect `information_schema.referential_constraints` to confirm the FK on `company_views.startup_id` has `delete_rule = 'CASCADE'`.

If any probe fails, surface the failure clearly (do not retry blindly). On success, report the four success criteria as verified.
</action>

<verify>
1. Migration applied: Supabase MCP `apply_migration` returned success for `0012_view_counts`.
2. Table columns: probe (1) returns exactly four rows for `id`, `startup_id`, `viewed_at`, `session_id` with types `uuid`, `uuid`, `timestamp with time zone`, `text` respectively.
3. Index present: probe (2) returns one row for `company_views_startup_id_viewed_at_idx`.
4. RLS shape: probe (3) confirms one `INSERT` policy for `anon` and zero `SELECT` policies on `company_views`.
5. RPC works: probe (4) returns `views_this_week = 0` and `views_total = 0` (both bigint) for a real startup id with no view rows yet.
6. Cascade FK: probe (5) confirms `delete_rule = 'CASCADE'` on the `company_views.startup_id → map_startups.id` foreign key.
</verify>

<done>
The `0012_view_counts` migration is live in the Supabase project. All four ROADMAP success criteria for Phase 1 are verified by read-only probes. Phase 2 (track-view Edge Function) is unblocked.
</done>

## Verification Checklist

Each item maps to one ROADMAP success criterion:

- [ ] **Criterion 1 — Table + index exist:** `company_views` has columns `id`, `startup_id`, `viewed_at`, `session_id`; index `company_views_startup_id_viewed_at_idx` is present (Task 1.2 probes 1 and 2).
- [ ] **Criterion 2 — Anon insert allowed, anon select blocked:** `pg_policies` shows one `INSERT` policy targeting `anon` and zero `SELECT` policies on `company_views` (Task 1.2 probe 3).
- [ ] **Criterion 3 — RPC returns numeric `{ views_this_week, views_total }`:** `select * from get_company_view_stats('<real id>')` returns both columns as `0::bigint` for an unseeded company (Task 1.2 probe 4).
- [ ] **Criterion 4 — FK cascades on `map_startups` delete:** `information_schema.referential_constraints` shows `delete_rule = 'CASCADE'` for the `company_views → map_startups` FK (Task 1.2 probe 5).

## Success Criteria

Phase 1 is complete when the migration file exists at `supabase/migrations/0012_view_counts.sql`, has been applied to the live Supabase project via Supabase MCP, and all four ROADMAP success criteria above are verified by read-only probes against `information_schema`, `pg_indexes`, `pg_policies`, and the `get_company_view_stats` RPC itself. No frontend or Edge Function code is in scope for this phase.
