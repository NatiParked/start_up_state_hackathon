/**
 * reject-submission — Admin Edge Function.
 *
 * Verifies the caller is an allow-listed admin, then marks the submission as
 * rejected with the provided rejection_reason.
 *
 * Expected request body:
 *   { submission_id: string, rejection_reason: string }
 *
 * Returns:
 *   { data: { submission_id: string }, error: null }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createAdminClient } from '../_shared/supabaseAdmin.js';

/** CORS headers required for browser invocations. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // -------------------------------------------------------------------------
  // 1. Parse request body
  // -------------------------------------------------------------------------
  let submission_id, rejection_reason;
  try {
    const body = await req.json();
    submission_id = body.submission_id;
    rejection_reason = body.rejection_reason ?? null;
  } catch {
    return jsonResponse({ error: 'invalid_body', code: 400 }, 400);
  }

  if (!submission_id) {
    return jsonResponse({ error: 'submission_id is required', code: 400 }, 400);
  }

  // -------------------------------------------------------------------------
  // 2. Extract and verify JWT → confirm caller is an allow-listed admin
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    return jsonResponse({ error: 'unauthorized', code: 401 }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  // Anon client used solely to validate the JWT and retrieve the caller's email.
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userError } = await anonClient.auth.getUser(jwt);
  if (userError || !userData?.user?.email) {
    return jsonResponse({ error: 'unauthorized', code: 401 }, 401);
  }

  const callerEmail = userData.user.email;

  // Service-role client bypasses RLS for all subsequent queries.
  const adminClient = createAdminClient();

  const { data: adminRow, error: adminLookupError } = await adminClient
    .from('map_admin_users')
    .select('email')
    .eq('email', callerEmail)
    .maybeSingle();

  if (adminLookupError) {
    console.error('admin lookup error', adminLookupError);
    return jsonResponse({ error: 'internal_error', code: 500 }, 500);
  }

  if (!adminRow) {
    return jsonResponse({ error: 'unauthorized', code: 401 }, 401);
  }

  // -------------------------------------------------------------------------
  // 3. Mark submission as rejected
  // -------------------------------------------------------------------------
  const { error: updateError } = await adminClient
    .from('map_startup_submissions')
    .update({
      status: 'rejected',
      rejection_reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: callerEmail,
    })
    .eq('id', submission_id);

  if (updateError) {
    console.error('submission update error', updateError);
    return jsonResponse({ error: 'internal_error', code: 500 }, 500);
  }

  return jsonResponse({ data: { submission_id }, error: null });
});
