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
