/**
 * approve-submission — Admin Edge Function.
 *
 * Verifies the caller is an allow-listed admin, deep-merges any field overrides
 * into the submission's extracted_data, inserts the record into map_startups,
 * and marks the submission as approved.
 *
 * Expected request body:
 *   { submission_id: string, overrides?: object }
 *
 * Returns:
 *   { data: { startup_id: string }, error: null }
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

/**
 * Recursively merge `overrides` into `base`.
 * Plain objects are merged deeply; all other values are replaced.
 *
 * @param {object} base
 * @param {object} overrides
 * @returns {object}
 */
function deepMerge(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // -------------------------------------------------------------------------
  // 1. Parse request body
  // -------------------------------------------------------------------------
  let submission_id, overrides;
  try {
    const body = await req.json();
    submission_id = body.submission_id;
    overrides = body.overrides ?? null;
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
  // 3. Fetch the submission row
  // -------------------------------------------------------------------------
  const { data: submission, error: fetchError } = await adminClient
    .from('map_startup_submissions')
    .select('*')
    .eq('id', submission_id)
    .maybeSingle();

  if (fetchError) {
    console.error('fetch submission error', fetchError);
    return jsonResponse({ error: 'internal_error', code: 500 }, 500);
  }

  if (!submission) {
    return jsonResponse({ error: 'submission_not_found', code: 404 }, 404);
  }

  // -------------------------------------------------------------------------
  // 4. Build the map_startups insert payload
  //    Source of truth: extracted_data jsonb column, overridden by caller overrides.
  // -------------------------------------------------------------------------
  const baseData = submission.extracted_data ?? {};
  const mergedData = overrides ? deepMerge(baseData, overrides) : baseData;

  // Strip any keys that don't belong in map_startups (e.g. internal pipeline keys)
  const {
    name,
    description,
    website,
    linkedin,
    address,
    city,
    lat,
    lng,
    region,
    stage,
    sector,
    funding_stage,
    business_type,
    employee_range,
    founded_year,
    is_hiring,
    job_titles,
    careers_url,
    logo_url,
    google_place_id,
    google_rating,
    phone,
    investors,
    total_raised,
    verified,
    last_refreshed_at,
  } = mergedData;

  const insertPayload = {
    name: name ?? submission.name,
    description,
    website: website ?? submission.website,
    linkedin,
    address,
    city,
    lat: lat != null ? parseFloat(lat) : null,
    lng: lng != null ? parseFloat(lng) : null,
    region,
    stage,
    sector,
    funding_stage,
    business_type,
    employee_range,
    founded_year: founded_year != null ? parseInt(founded_year, 10) : null,
    is_hiring: is_hiring ?? false,
    job_titles: Array.isArray(job_titles) ? job_titles : null,
    careers_url,
    logo_url,
    google_place_id,
    google_rating: google_rating != null ? parseFloat(google_rating) : null,
    phone,
    investors: Array.isArray(investors) ? investors : null,
    total_raised,
    verified: verified ?? false,
    last_refreshed_at,
  };

  // Remove undefined keys to avoid overwriting with null unintentionally
  for (const key of Object.keys(insertPayload)) {
    if (insertPayload[key] === undefined) {
      delete insertPayload[key];
    }
  }

  // -------------------------------------------------------------------------
  // 5. Insert into map_startups
  // -------------------------------------------------------------------------
  const { data: inserted, error: insertError } = await adminClient
    .from('map_startups')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    console.error('map_startups insert error', insertError);
    return jsonResponse({ error: 'internal_error', code: 500 }, 500);
  }

  const startup_id = inserted.id;

  // -------------------------------------------------------------------------
  // 6. Mark submission as approved
  // -------------------------------------------------------------------------
  const { error: updateError } = await adminClient
    .from('map_startup_submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: callerEmail,
    })
    .eq('id', submission_id);

  if (updateError) {
    console.error('submission update error', updateError);
    // Don't fail the request — the record was already inserted. Log and continue.
  }

  return jsonResponse({ data: { startup_id }, error: null });
});
