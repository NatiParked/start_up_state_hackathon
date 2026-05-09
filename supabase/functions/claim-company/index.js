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

function normalizeDomain(value) {
  try {
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

    const companyDomain = normalizeDomain(company.website);
    const emailDomain   = normalizeDomain(claimer_email.split('@')[1] ?? '');

    if (companyDomain !== emailDomain) {
      return errorResponse(
        'EMAIL_DOMAIN_MISMATCH',
        'Email domain does not match company website',
        400,
      );
    }

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

    return jsonResponse({ ok: true });

  } catch (err) {
    console.error('[claim-company] unhandled error:', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
});
