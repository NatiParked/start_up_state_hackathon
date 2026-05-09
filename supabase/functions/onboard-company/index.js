/**
 * onboard-company — Public-facing Edge Function for AI-driven company onboarding.
 *
 * Accepts a POST `{ url, email? }` from the Vue frontend, runs the full
 * enrichment pipeline, evaluates the result through the Utah quality gate,
 * and writes the company to either `map_startups` (auto-published) or
 * `map_startup_submissions` (pending review).
 *
 * Usage (curl):
 *   curl -X POST https://<project>.supabase.co/functions/v1/onboard-company \
 *     -H 'Content-Type: application/json' \
 *     -H 'Authorization: Bearer <anon-key>' \
 *     -d '{"url":"https://zonos.com","email":"founder@example.com"}'
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { runEnrichmentPipeline } from '../_shared/pipeline.js';
import { normalizeDomain } from '../_shared/logo-dev.js';
import { runQualityGate } from './quality-gate.js';

/** CORS headers required so the Vue frontend can call this function from the browser. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Build a JSON response with CORS headers.
 *
 * @param {object} body - Response payload; will be JSON-serialised.
 * @param {number} [status=200] - HTTP status code.
 * @returns {Response}
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Build a structured error response.
 *
 * @param {string} code - Machine-readable error code, e.g. 'INVALID_INPUT'.
 * @param {string} message - Human-readable error message.
 * @param {number} status - HTTP status code.
 * @returns {Response}
 */
function errorResponse(code, message, status) {
  return jsonResponse({ error: message, code }, status);
}

/**
 * Build the scalar-column insert payload shared between `map_startups` and
 * `map_startup_submissions` inserts.
 *
 * @param {object} record - Enriched company record from `runEnrichmentPipeline`.
 * @returns {object} Flat object of scalar columns.
 */
function scalarColumns(record) {
  return {
    name: record.name ?? 'Unknown',
    description: record.description ?? null,
    website: record.website ?? null,
    address: record.address ?? null,
    city: record.city ?? null,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    region: record.region ?? null,
    sector: record.sector ?? null,
    stage: record.stage ?? null,
    employee_range: record.employee_range ?? null,
    founded_year: record.founded_year ?? null,
    is_hiring: record.is_hiring ?? null,
    job_titles: record.job_titles ?? null,
    careers_url: record.careers_url ?? null,
    logo_url: record.logo_url ?? null,
    investors: record.investors ?? null,
    total_raised: record.total_raised ?? null,
  };
}

Deno.serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return errorResponse('INVALID_INPUT', 'Only POST is supported', 405);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return errorResponse('INVALID_INPUT', 'Body must be valid JSON', 400);
  }

  const { url, email } = body ?? {};

  // ── Validate url ──────────────────────────────────────────────────────────
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return errorResponse('INVALID_INPUT', 'Field "url" is required and must be a valid URL', 400);
  }
  try {
    new URL(url);
  } catch (_) {
    return errorResponse('INVALID_INPUT', 'Field "url" is required and must be a valid URL', 400);
  }
  if (email !== undefined && typeof email !== 'string') {
    return errorResponse('INVALID_INPUT', 'Field "email" must be a string if provided', 400);
  }

  // ── Outer try/catch (steps 5–9) ───────────────────────────────────────────
  try {
    // ── Step 5: Create Supabase client ──────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('INTERNAL_ERROR', 'Supabase env not configured', 500);
    }
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Step 6: Run enrichment pipeline ────────────────────────────────────
    let record;
    try {
      record = await runEnrichmentPipeline({ url, email });
    } catch (err) {
      console.error('[onboard-company] Enrichment pipeline error:', err);
      return errorResponse('INTERNAL_ERROR', 'Enrichment pipeline failed', 500);
    }

    // ── Step 7: Run quality gate ────────────────────────────────────────────
    const gateResult = await runQualityGate(record, supabaseClient);

    // ── Step 8: Gate FAIL ───────────────────────────────────────────────────
    if (!gateResult.passed) {
      const scalars = scalarColumns(record);

      if (gateResult.existing_id) {
        // Duplicate of an existing map_startups row — insert audit submission
        const { error: dupInsertErr } = await supabaseClient
          .from('map_startup_submissions')
          .insert({
            ...scalars,
            status: 'auto_published',
            submitted_url: url,
            submitted_by_email: email ?? null,
            extracted_data: record,
            rejection_reason: null,
            reviewed_by: 'auto',
            reviewed_at: new Date().toISOString(),
          });

        if (dupInsertErr) {
          console.error('[onboard-company] Failed to insert duplicate audit submission:', dupInsertErr);
        }

        return jsonResponse({
          status: 'auto_published',
          startup_id: gateResult.existing_id,
          company: record,
          duplicate: true,
        });
      }

      // Gate failed for non-duplicate reason — insert pending submission
      const { error: pendingInsertErr } = await supabaseClient
        .from('map_startup_submissions')
        .insert({
          ...scalars,
          status: 'pending',
          submitted_url: url,
          submitted_by_email: email ?? null,
          extracted_data: record,
          rejection_reason: gateResult.reason,
        });

      if (pendingInsertErr) {
        console.error('[onboard-company] Failed to insert pending submission:', pendingInsertErr);
      }

      return jsonResponse({ status: 'pending', reason: gateResult.reason, company: record });
    }

    // ── Step 9: Gate PASS — insert into map_startups ────────────────────────
    const scalars = scalarColumns(record);
    const mapStartupsPayload = { ...scalars, verified: false };

    const { data: inserted, error: insertErr } = await supabaseClient
      .from('map_startups')
      .insert(mapStartupsPayload)
      .select('id')
      .single();

    if (insertErr || !inserted) {
      console.error('[onboard-company] Failed to insert into map_startups:', insertErr);
      return errorResponse('INTERNAL_ERROR', 'Failed to insert into map_startups', 500);
    }

    const startup_id = inserted.id;

    // Insert audit row into map_startup_submissions (non-fatal if this fails)
    const { error: auditInsertErr } = await supabaseClient
      .from('map_startup_submissions')
      .insert({
        ...scalars,
        status: 'auto_published',
        submitted_url: url,
        submitted_by_email: email ?? null,
        extracted_data: record,
        rejection_reason: null,
        reviewed_by: 'auto',
        reviewed_at: new Date().toISOString(),
      });

    if (auditInsertErr) {
      console.error('[onboard-company] Failed to insert audit submission (non-fatal):', auditInsertErr);
    }

    return jsonResponse({ status: 'auto_published', startup_id, company: record });
  } catch (err) {
    console.error('[onboard-company] Unexpected failure:', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected failure', 500);
  }
});
