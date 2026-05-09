# Phase 1 Plan: Database & Edge Function

Feature: 0006 — AI Onboarding: Claim & Self-Service Edit
Phase: 1 of 3

---

## Objective

Stand up the `company_claims` table (with RLS), the `get_company_view_stats` stub RPC, and the `claim-company` Deno edge function that validates email-domain ownership and registers a claim row. No frontend work in this phase.

---

## Must-Haves (goal-backward)

These are derived directly from the Phase 1 success criteria in ROADMAP.md:

1. `supabase/migrations/0003_claims.sql` applies cleanly — `company_claims` table exists with expected columns and constraints
2. `select get_company_view_stats('<any uuid>'::uuid)` returns `{"views_this_week": 0, "views_total": 0}` 
3. POST to `claim-company` with matching email domain → 200 `{ ok: true }`, row inserted in `company_claims`
4. POST with mismatched domain → 400 `EMAIL_DOMAIN_MISMATCH`
5. Duplicate POST (same startup_id + email) → 200 `{ ok: true }` (idempotent — no duplicate row)

---

## Tasks

### Task 1 — Migration: company_claims table + get_company_view_stats RPC

**Goal:** Create `supabase/migrations/0003_claims.sql` with the full schema: table, constraints, index, RLS policies, and RPC stub.

**Files:**
- Create: `supabase/migrations/0003_claims.sql`

**Action:**

Write the migration file with these sections in order:

```sql
-- 1. company_claims table
create table if not exists company_claims (
  id             uuid primary key default gen_random_uuid(),
  startup_id     uuid not null references map_startups(id) on delete cascade,
  claimer_email  text not null,
  created_at     timestamptz not null default now(),
  constraint company_claims_startup_email_key unique (startup_id, claimer_email)
);

-- 2. B-tree index on startup_id for efficient lookups
create index if not exists company_claims_startup_id_idx on company_claims(startup_id);

-- 3. Enable RLS
alter table company_claims enable row level security;

-- 4. RLS: authenticated users can read their own rows only
create policy "claimer read own"
  on company_claims
  for select
  to authenticated
  using (auth.jwt() ->> 'email' = claimer_email);

-- 5. RLS: service role only for INSERT and DELETE (client never writes directly)
--    No client-facing INSERT/DELETE policy → anon/authenticated cannot insert rows.
--    The edge function uses the service role key (bypasses RLS) for upserts.

-- 6. get_company_view_stats stub RPC
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
```

**Important note on migration number:** `0003` was intentionally reserved for this feature (the repo currently has 0001, 0002, 0004-0007, 0009). Apply using the Supabase MCP `apply_migration` tool rather than `supabase db push` if the CLI rejects the out-of-sequence version. Alternatively, use the Supabase MCP `execute_sql` tool to run the SQL directly, then create the file for tracking.

**Verify:**
- File exists at `supabase/migrations/0003_claims.sql`
- SQL is syntactically valid (no unmatched parentheses, correct semicolons)
- `select * from company_claims` returns an empty table with columns `id, startup_id, claimer_email, created_at`
- `select get_company_view_stats(gen_random_uuid())` returns `{"views_this_week": 0, "views_total": 0}`

**Done when:** Migration applied (via MCP or CLI), both DB assertions pass.

---

### Task 2 — Edge Function: claim-company (domain validation + upsert)

**Goal:** Create `supabase/functions/claim-company/index.js` — a Deno edge function that validates the claimer's email domain against the company's website domain and upserts a row in `company_claims`.

**Files:**
- Create: `supabase/functions/claim-company/index.js`

**Action:**

Write the edge function following the exact structure of `supabase/functions/onboard-company/index.js` (CORS helpers at top, typed handlers, outer try/catch):

```js
/**
 * claim-company — Validates email-domain ownership and registers a company claim.
 *
 * Accepts POST { startup_id: string, claimer_email: string }.
 * Steps:
 *   1. Fetch the map_startups row for startup_id.
 *   2. Normalize both the company `website` domain and the `claimer_email` domain.
 *   3. If domains don't match, return 400 EMAIL_DOMAIN_MISMATCH.
 *   4. Upsert into company_claims (idempotent on conflict).
 *   5. Return 200 { ok: true }.
 *
 * The OTP magic-link is sent by the client (signInWithOtp) — NOT by this function.
 *
 * Usage (curl):
 *   curl -X POST https://<project>.supabase.co/functions/v1/claim-company \
 *     -H 'Content-Type: application/json' \
 *     -H 'Authorization: Bearer <anon-key>' \
 *     -d '{"startup_id":"<uuid>","claimer_email":"admin@thatcompany.com"}'
 */

import { createAdminClient } from '../_shared/supabaseAdmin.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code, message, status) {
  return jsonResponse({ error: message, code }, status);
}

/**
 * Extract hostname from a URL or plain domain string.
 * Returns lowercase hostname without 'www.' prefix.
 *
 * @param {string} value - URL like 'https://thatcompany.com' or email domain like 'thatcompany.com'
 * @returns {string} normalized hostname, e.g. 'thatcompany.com'
 */
function normalizeDomain(value) {
  try {
    // If it looks like a URL, parse it
    const url = value.includes('://') ? new URL(value) : new URL('https://' + value);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^www\./, '');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('INVALID_INPUT', 'Method not allowed', 405);
  }

  try {
    const body = await req.json();
    const { startup_id, claimer_email } = body;

    if (!startup_id || !claimer_email) {
      return errorResponse('INVALID_INPUT', 'startup_id and claimer_email are required', 400);
    }

    const supabase = createAdminClient();

    // ── Step 1: Fetch the company row ─────────────────────────────────────────
    const { data: company, error: fetchError } = await supabase
      .from('map_startups')
      .select('id, website')
      .eq('id', startup_id)
      .maybeSingle();

    if (fetchError) {
      console.error('[claim-company] fetch error:', fetchError);
      return errorResponse('INTERNAL_ERROR', 'Failed to fetch company', 500);
    }
    if (!company) {
      return errorResponse('INVALID_INPUT', 'Company not found', 404);
    }
    if (!company.website) {
      return errorResponse('INVALID_INPUT', 'Company has no website on record', 400);
    }

    // ── Step 2: Normalize domains ─────────────────────────────────────────────
    const companyDomain = normalizeDomain(company.website);
    const emailDomain   = normalizeDomain(claimer_email.split('@')[1] ?? '');

    // ── Step 3: Domain match check ────────────────────────────────────────────
    if (companyDomain !== emailDomain) {
      return errorResponse(
        'EMAIL_DOMAIN_MISMATCH',
        'Email domain does not match company website',
        400,
      );
    }

    // ── Step 4: Upsert claim row (idempotent) ─────────────────────────────────
    const { error: upsertError } = await supabase
      .from('company_claims')
      .upsert(
        { startup_id, claimer_email: claimer_email.toLowerCase() },
        { onConflict: 'startup_id,claimer_email', ignoreDuplicates: true },
      );

    if (upsertError) {
      console.error('[claim-company] upsert error:', upsertError);
      return errorResponse('INTERNAL_ERROR', 'Failed to register claim', 500);
    }

    // ── Step 5: Done — client will call signInWithOtp ─────────────────────────
    return jsonResponse({ ok: true });

  } catch (err) {
    console.error('[claim-company] unhandled error:', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
});
```

**Verify:**
- File exists at `supabase/functions/claim-company/index.js`
- Function deployed (use Supabase MCP `deploy_edge_function` or `supabase functions deploy claim-company`)
- POST with matching domain → 200 `{ ok: true }`, row in `company_claims`
- POST with mismatched domain → 400 `{ error: "Email domain does not match company website", code: "EMAIL_DOMAIN_MISMATCH" }`
- Duplicate POST (same startup_id + email) → 200 `{ ok: true }`, no duplicate row

**Done when:** Function deployed, all three POST scenarios return expected responses.

---

## Dependency Graph

```
Task 1 (migration) ──► Task 2 (edge function)
                        └── requires company_claims table to exist for upsert
```

Tasks must run sequentially: Task 1 first, then Task 2.

---

## Verification Checklist

Mapped to ROADMAP.md Phase 1 verification items:

- [x] `supabase migration up` (or MCP apply) applies `0003_claims.sql` cleanly — no SQL errors
- [x] `select * from company_claims` returns empty set with expected columns (`id`, `startup_id`, `claimer_email`, `created_at`)
- [x] `select get_company_view_stats(gen_random_uuid())` returns `{"views_this_week": 0, "views_total": 0}`
- [ ] POST `{ startup_id: <valid_id>, claimer_email: "admin@thatcompany.com" }` (where website is `https://thatcompany.com`) → 200 `{ ok: true }`, row appears in `company_claims`
- [ ] POST with mismatched email domain → 400 `EMAIL_DOMAIN_MISMATCH`
- [ ] Duplicate POST (same startup_id + email) → 200 `{ ok: true }`, `company_claims` count unchanged

Completed Task 1: 2026-05-09
Completed Task 2: 2026-05-09

---

## Notes for Executor

1. **Migration number gap:** The repo skips from 0002 to 0004; `0003_claims.sql` fills that gap. If `supabase db push` rejects the out-of-sequence migration, apply via Supabase MCP `apply_migration` tool instead — it executes SQL directly without version-ordering enforcement.

2. **No RLS INSERT policy for clients:** The edge function uses the service-role client (bypasses RLS), so no client-side INSERT policy is needed on `company_claims`. This is intentional — only the edge function can create claim rows.

3. **Phase 3 addendum:** `CompanyEditView` will need an UPDATE RLS policy on `map_startups`. That policy is added in Phase 3's PLAN, not here, since it depends on the Phase 3 edit form being built.

4. **OTP not sent here:** The `claim-company` function only validates + registers. The client calls `supabase.auth.signInWithOtp()` after receiving `{ ok: true }` from this function. Do not add email/OTP logic to the edge function.
