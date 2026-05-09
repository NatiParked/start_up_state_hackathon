/**
 * refresh-jobs — Edge Function: weekly ATS job refresh orchestrator.
 *
 * Two modes, both accept POST:
 *
 * Bulk (no body / empty body):
 *   curl -X POST https://<project>.supabase.co/functions/v1/refresh-jobs \
 *     -H 'Authorization: Bearer <service-role-key>' \
 *     -H 'Content-Type: application/json' \
 *     -d '{}'
 *
 * Single-company (forced):
 *   curl -X POST https://<project>.supabase.co/functions/v1/refresh-jobs \
 *     -H 'Authorization: Bearer <service-role-key>' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"startup_id":"<uuid>","force":true}'
 */

import { createAdminClient } from '../_shared/supabaseAdmin.js';
import pollAts from '../_shared/ats.js';
import { logRun } from './logger.js';

/** CORS headers required so admin tooling can call this function from the browser. */
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
 * @param {string} message - Human-readable error message.
 * @param {number} status - HTTP status code.
 * @returns {Response}
 */
function errorResponse(message, status) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return errorResponse('Only POST is supported', 405);
  }

  // ── Top-level try/catch ───────────────────────────────────────────────────
  try {
    // ── Parse body (empty / null body treated as bulk mode {}) ───────────────
    let body;
    const text = await req.text();
    if (!text || text.trim() === '') {
      body = {};
    } else {
      try {
        body = JSON.parse(text);
      } catch (_) {
        return errorResponse('Body must be valid JSON', 400);
      }
    }

    // ── Extract params ────────────────────────────────────────────────────────
    const { startup_id, force } = body ?? {};

    if (startup_id !== undefined && typeof startup_id !== 'string') {
      return errorResponse('startup_id must be a string if provided', 400);
    }

    const forceRefresh = force === true;

    // ── Create admin client ───────────────────────────────────────────────────
    const supabase = createAdminClient();

    // ── Single-company mode ───────────────────────────────────────────────────
    if (startup_id) {
      const { data: rows, error: selectErr } = await supabase
        .from('map_startups')
        .select('*')
        .eq('id', startup_id)
        .limit(1);

      if (selectErr) {
        console.error('[refresh-jobs] DB select error:', selectErr);
        return errorResponse('Unexpected failure', 500);
      }

      if (!rows || rows.length === 0) {
        return errorResponse('Startup not found', 404);
      }

      const row = rows[0];

      // Recency gate: skip if refreshed within the last 7 days and force is not set.
      // A recency-gate skip is not a real run, so no log row is written.
      if (!forceRefresh && row.jobs_refreshed_at) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (new Date(row.jobs_refreshed_at) > sevenDaysAgo) {
          return jsonResponse({ refreshed: 0, skipped: 1, errors: 0 });
        }
      }

      const result = await pollAts(row.careers_url);

      if (result === null) {
        await logRun(supabase, {
          startup_id,
          source: 'manual',
          success: false,
          error_message: 'pollAts returned null (unsupported ATS or fetch failure)',
          jobs_updated: 0,
        });
        return jsonResponse({ refreshed: 0, skipped: 0, errors: 1 });
      }

      const { error: updateErr } = await supabase
        .from('map_startups')
        .update({
          job_titles: result.job_titles,
          is_hiring: result.is_hiring,
          careers_url: result.careers_url,
          jobs_refreshed_at: new Date().toISOString(),
        })
        .eq('id', startup_id);

      if (updateErr) {
        await logRun(supabase, {
          startup_id,
          source: 'manual',
          success: false,
          error_message: updateErr.message,
          jobs_updated: 0,
        });
        return jsonResponse({ refreshed: 0, skipped: 0, errors: 1 });
      }

      await logRun(supabase, {
        startup_id,
        source: 'manual',
        success: true,
        error_message: null,
        jobs_updated: result.job_titles.length,
      });
      return jsonResponse({ refreshed: 1, skipped: 0, errors: 0 });
    }

    // ── Bulk mode ─────────────────────────────────────────────────────────────
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: stale, error: bulkSelectErr } = await supabase
      .from('map_startups')
      .select('id, name, careers_url, jobs_refreshed_at')
      .or(`jobs_refreshed_at.is.null,jobs_refreshed_at.lt.${cutoff}`);

    if (bulkSelectErr) {
      console.error('[refresh-jobs] Bulk select error:', bulkSelectErr);
      return errorResponse('Unexpected failure', 500);
    }

    let refreshed = 0;
    let skipped = 0;
    let errors = 0;
    let anyError = false;

    for (const row of (stale ?? [])) {
      const result = await pollAts(row.careers_url);

      if (result === null) {
        // Unsupported ATS or transient fetch failure — not a hard error in bulk mode
        skipped++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('map_startups')
        .update({
          job_titles: result.job_titles,
          is_hiring: result.is_hiring,
          careers_url: result.careers_url,
          jobs_refreshed_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateErr) {
        errors++;
        anyError = true;
        console.error('[refresh-jobs] Update failed for startup', row.id, updateErr);
      } else {
        refreshed++;
      }
    }

    // One summary log row for the entire bulk run
    await logRun(supabase, {
      startup_id: null,
      source: 'cron',
      success: !anyError,
      error_message: anyError ? 'one or more updates failed' : null,
      jobs_updated: refreshed,
    });

    return jsonResponse({ refreshed, skipped, errors });

  } catch (err) {
    console.error('[refresh-jobs] Unexpected failure:', err);
    return errorResponse('Unexpected failure', 500);
  }
});
