# Feature 0001 — Phase 2: Database Schema & Migration

## Phase Goal

Create the `supabase/migrations/0001_init.sql` migration file that defines the `map_startups` and `map_startup_submissions` tables (with all columns, indexes, RLS, and policies) so that seed data has a destination and the Pinia store has a queryable shape.

## Must-Haves (Goal-Backward)

When this phase is done, all of these must be true:

### Observable Truths

- A migration file exists at the repo root: `supabase/migrations/0001_init.sql`.
- The file declares a `map_startups` table with all 28 columns matching the spec exactly (correct names, types, defaults).
- The file declares a `map_startup_submissions` table with submission-tracking columns (`status`, `submitted_at`) plus the mirrored core fields needed for moderation.
- B-tree indexes exist on `map_startups(sector)`, `map_startups(stage)`, and `map_startups(region)`.
- A GIN index exists on `map_startups(investors)` so `@>` array containment queries are fast.
- Row Level Security is enabled on both tables.
- An RLS policy on `map_startups` allows public `select` (anon read-only).
- An RLS policy on `map_startup_submissions` allows public `insert` (anon can submit), with no public select policy.
- A short, clear command is documented (in this PLAN and as a comment in the SQL) for how the developer applies the migration manually.

### Required Artifacts

| Path                              | Provides                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| `supabase/migrations/0001_init.sql` | Schema, indexes, RLS, and policies for the Map product DB |

### Key Links

| From                         | To                              | Via                                  |
| ---------------------------- | ------------------------------- | ------------------------------------ |
| Phase 3 import script        | `map_startups` table            | `supabase.from('map_startups').insert(...)` |
| Phase 4 `useStartupsStore`   | `map_startups` table            | `supabase.from('map_startups').select('*')` |
| Future submission form       | `map_startup_submissions` table | anon `insert` allowed by RLS         |

## Tasks

### Task 2.1: Author the initial migration SQL file

**Sequence:** 1
**Type:** auto
**Status:** Complete
Completed: 2026-05-09

**Files:**
- `supabase/migrations/0001_init.sql` (create)

**Steps:**

1. Confirm the directory exists (create it if not): `supabase/migrations/` at the repo root (NOT inside `goed/`).
2. Create `supabase/migrations/0001_init.sql` with the exact contents below. The file is one self-contained SQL script: tables, indexes, RLS enablement, and policies — in that order. Include the leading header comment so future maintainers know what this migration does and how to apply it.

   ```sql
   -- 0001_init.sql
   -- Initial schema for the Utah Startup Map product.
   --
   -- Apply manually (do NOT auto-run from this repo):
   --   Option A (Supabase CLI, run from repo root):
   --     supabase db push
   --   Option B (SQL editor):
   --     Paste the contents of this file into the Supabase project's SQL editor and run.
   --
   -- All Map product tables MUST be prefixed with map_ (project convention).

   -- ---------------------------------------------------------------------------
   -- Tables
   -- ---------------------------------------------------------------------------

   create table map_startups (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     description text,
     website text,
     linkedin text,
     address text,
     city text,
     lat float8,
     lng float8,
     region text,
     stage text,
     sector text,
     funding_stage text,
     business_type text,
     employee_range text,
     founded_year int,
     is_hiring boolean default false,
     job_titles text[],
     careers_url text,
     logo_url text,
     google_place_id text,
     google_rating numeric,
     phone text,
     investors text[],
     total_raised text,
     verified boolean default true,
     last_refreshed_at timestamptz,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   create table map_startup_submissions (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     description text,
     website text,
     linkedin text,
     address text,
     city text,
     lat float8,
     lng float8,
     region text,
     stage text,
     sector text,
     funding_stage text,
     business_type text,
     employee_range text,
     founded_year int,
     is_hiring boolean default false,
     job_titles text[],
     careers_url text,
     logo_url text,
     phone text,
     investors text[],
     total_raised text,
     status text not null default 'pending',
     submitted_at timestamptz default now(),
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   -- ---------------------------------------------------------------------------
   -- Indexes
   -- ---------------------------------------------------------------------------

   -- B-tree indexes for the most common filter facets on the map.
   create index map_startups_sector_idx on map_startups (sector);
   create index map_startups_stage_idx  on map_startups (stage);
   create index map_startups_region_idx on map_startups (region);

   -- GIN index supports investor array containment queries (e.g. investors @> ARRAY['Pelion']).
   create index map_startups_investors_gin_idx on map_startups using gin (investors);

   -- ---------------------------------------------------------------------------
   -- Row Level Security
   -- ---------------------------------------------------------------------------

   alter table map_startups            enable row level security;
   alter table map_startup_submissions enable row level security;

   -- map_startups: public read-only. Anon may select, but cannot insert/update/delete.
   create policy map_startups_public_select
     on map_startups
     for select
     to anon, authenticated
     using (true);

   -- map_startup_submissions: public submit-only. Anon may insert, but cannot select/update/delete.
   create policy map_startup_submissions_public_insert
     on map_startup_submissions
     for insert
     to anon, authenticated
     with check (true);
   ```

3. Save the file. Do not run it against any Supabase project from this task — applying the migration is an explicit manual developer step.

**Done when:**
- `supabase/migrations/0001_init.sql` exists at the repo root.
- Reading the file shows: both `create table` statements (with all 28 `map_startups` columns and the submissions columns including `status` and `submitted_at`), the four indexes (3 B-tree + 1 GIN), `enable row level security` on both tables, the public select policy on `map_startups`, and the public insert policy on `map_startup_submissions`.
- The header comment documents the manual apply commands (`supabase db push` or pasting into the SQL editor).
- Running `grep -c "map_startups" supabase/migrations/0001_init.sql` returns a value of 6 or more (table create, 3 indexes, 1 GIN index, RLS enable, policy — at minimum the table name appears multiple times).
- The file contains no `drop`, no `truncate`, and no destructive statements.

---

## Sequence Summary

| Sequence | Task                                          | Parallel With | Depends On |
| -------- | --------------------------------------------- | ------------- | ---------- |
| 1        | Task 2.1 — Author the initial migration SQL  | —             | Nothing    |

This phase is a single-task phase. It does not depend on Phase 1 and can be executed independently.

## Verification Checklist

Run these checks after the task completes to confirm the phase goal was achieved:

- [ ] File exists: `ls supabase/migrations/0001_init.sql` succeeds (path is at repo root, NOT inside `goed/`).
- [ ] Both tables are declared: `grep -E "create table map_startups( |\()|create table map_startup_submissions( |\()" supabase/migrations/0001_init.sql` returns two matching lines.
- [ ] All 28 columns of `map_startups` are present. Spot-check by grepping for the column names that are easiest to typo: `grep -E "^\s+(id|name|description|website|linkedin|address|city|lat|lng|region|stage|sector|funding_stage|business_type|employee_range|founded_year|is_hiring|job_titles|careers_url|logo_url|google_place_id|google_rating|phone|investors|total_raised|verified|last_refreshed_at|created_at|updated_at)\b" supabase/migrations/0001_init.sql | wc -l` shows at least 28 lines for the `map_startups` block (some names also appear in the submissions block, that is fine).
- [ ] `map_startup_submissions` declares both `status text not null default 'pending'` and `submitted_at timestamptz default now()`.
- [ ] All four indexes are present: `grep -E "create index .* on map_startups" supabase/migrations/0001_init.sql | wc -l` returns 4.
- [ ] The GIN index uses `using gin (investors)` — verify with `grep "using gin (investors)" supabase/migrations/0001_init.sql`.
- [ ] RLS is enabled on both tables: `grep "enable row level security" supabase/migrations/0001_init.sql | wc -l` returns 2.
- [ ] The public select policy on `map_startups` is `for select` and uses `using (true)`.
- [ ] The public insert policy on `map_startup_submissions` is `for insert` and uses `with check (true)`.
- [ ] No public select policy exists on `map_startup_submissions` (anon must NOT be able to read submissions).
- [ ] The header comment of the file documents the manual apply commands (`supabase db push` and/or "paste into SQL editor").
- [ ] (Manual, post-apply, optional during this phase) After the developer applies the migration to their Supabase project: an anon client can `select * from map_startups` (returns 0 rows initially) and is blocked from insert/update/delete; an anon client can `insert` into `map_startup_submissions` but cannot `select` from it.
