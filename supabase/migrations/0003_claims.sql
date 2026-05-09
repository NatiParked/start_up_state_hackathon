-- company_claims table
create table if not exists company_claims (
  id             uuid primary key default gen_random_uuid(),
  startup_id     uuid not null references map_startups(id) on delete cascade,
  claimer_email  text not null,
  created_at     timestamptz not null default now(),
  constraint company_claims_startup_email_key unique (startup_id, claimer_email)
);

-- B-tree index on startup_id for efficient lookups
create index if not exists company_claims_startup_id_idx on company_claims(startup_id);

-- Enable RLS
alter table company_claims enable row level security;

-- RLS: authenticated users can read their own rows only
create policy "claimer read own"
  on company_claims
  for select
  to authenticated
  using (auth.jwt() ->> 'email' = claimer_email);

-- get_company_view_stats stub RPC
create or replace function get_company_view_stats(p_startup_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'views_this_week', 0,
    'views_total',     0
  );
$$;

grant execute on function get_company_view_stats(uuid) to anon, authenticated;
