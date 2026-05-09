/**
 * confirm-subscription — verifies a subscriber's email via a one-time token.
 *
 * Accepts GET requests with a `?token=<confirm_token>` query param.
 * Looks up the token in map_subscriptions, marks the row confirmed,
 * and redirects to the subscribe page with a status query param.
 *
 * Returns: 302 redirect to /subscribe?confirmed=true | already | error=invalid
 */

import { createAdminClient } from '../_shared/supabaseAdmin.js';

/** CORS headers required for browser invocations. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * Build a JSON Response with CORS headers always present.
 *
 * @param {object} body
 * @param {number} [status=200]
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
 * Build a JSON error Response with CORS headers.
 *
 * @param {string} code - Machine-readable error code.
 * @param {string} message - Human-readable error message.
 * @param {number} [status=500]
 * @returns {Response}
 */
function errorResponse(code, message, status = 500) {
  return jsonResponse({ error: message, code }, status);
}

Deno.serve(async (req) => {
  try {
    // -------------------------------------------------------------------------
    // 1. CORS preflight
    // -------------------------------------------------------------------------
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // -------------------------------------------------------------------------
    // 2. Method guard
    // -------------------------------------------------------------------------
    if (req.method !== 'GET') {
      return errorResponse('method_not_allowed', 'method_not_allowed', 405);
    }

    // -------------------------------------------------------------------------
    // 3. Parse token from query string
    // -------------------------------------------------------------------------
    const token = new URL(req.url).searchParams.get('token');

    // -------------------------------------------------------------------------
    // 4. Site URL + redirect helper
    // -------------------------------------------------------------------------
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:5173';
    const redirect = (path) =>
      new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `${siteUrl}${path}` },
      });

    // -------------------------------------------------------------------------
    // 5. Require token
    // -------------------------------------------------------------------------
    if (!token) {
      return redirect('/subscribe?error=invalid');
    }

    // -------------------------------------------------------------------------
    // 6. Look up subscription row
    // -------------------------------------------------------------------------
    const adminClient = createAdminClient();

    const { data: row, error: selectError } = await adminClient
      .from('map_subscriptions')
      .select('*')
      .eq('confirm_token', token)
      .maybeSingle();

    if (selectError) throw selectError;

    // -------------------------------------------------------------------------
    // 7. Not found → invalid
    // -------------------------------------------------------------------------
    if (!row) {
      return redirect('/subscribe?error=invalid');
    }

    // -------------------------------------------------------------------------
    // 8. Already confirmed
    // -------------------------------------------------------------------------
    if (row.confirmed === true) {
      return redirect('/subscribe?confirmed=already');
    }

    // -------------------------------------------------------------------------
    // 9. Confirm the subscription
    // -------------------------------------------------------------------------
    const { error: updateError } = await adminClient
      .from('map_subscriptions')
      .update({ confirmed: true })
      .eq('confirm_token', token);

    if (updateError) throw updateError;

    return redirect('/subscribe?confirmed=true');
  } catch (err) {
    console.error('confirm-subscription fatal error', err);
    return errorResponse('internal_error', err.message ?? 'internal_error', 500);
  }
});
