-- 0012_view_counts.sql
-- Creates the company_views table with an index, anon-insert RLS policy, and get_company_view_stats RPC.
-- Feature 0008 Phase 1 — Database & View Tracking Migration.
--
-- This migration is idempotent: safe to re-run on a partially migrated database.
--
-- Depends on: map_startups table created in 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Table: company_views
-- ---------------------------------------------------------------------------

create table if not exists company_views (
  id         uuid        primary key default gen_random_uuid(),
  startup_id uuid        not null references map_startups(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  session_id text        not null
);

-- ---------------------------------------------------------------------------
-- Index: company_views_startup_id_viewed_at_idx
-- ---------------------------------------------------------------------------

create index if not exists company_views_startup_id_viewed_at_idx
  on company_views (startup_id, viewed_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table company_views enable row level security;

-- Anon insert policy (no select policy — direct anon select is intentionally blocked)
drop policy if exists company_views_anon_insert on company_views;
create policy company_views_anon_insert
  on company_views
  for insert
  to anon
  with check (true);

-- ---------------------------------------------------------------------------
-- RPC: get_company_view_stats
-- ---------------------------------------------------------------------------

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

grant execute on function get_company_view_stats(uuid) to anon, authenticated;
