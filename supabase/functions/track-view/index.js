/**
 * track-view — Fire-and-forget view tracking for company drawer opens.
 *
 * Accepts POST { startup_id: string (UUID), session_id: string (1–64 chars) }.
 * Steps:
 *   1. Validate startup_id matches UUID regex.
 *   2. Validate session_id is a non-empty string no longer than 64 chars.
 *   3. Insert a row into company_views using the anon Supabase client (RLS insert policy
 *      created in Phase 1 migration 0012_view_counts.sql is sufficient).
 *   4. On insert error: log via console.error and STILL return { ok: true } 200 —
 *      this is the fire-and-forget contract; tracking failures must never block the UI.
 *   5. Validation failures return { error: 'invalid input' } 400.
 *
 * Example:
 *   curl -X POST https://<project>.supabase.co/functions/v1/track-view \
 *     -H 'Content-Type: application/json' \
 *     -H 'apikey: <anon-key>' \
 *     -d '{"startup_id":"<uuid>","session_id":"<uuid>"}'
 *
 * Consumers: goed/src/components/drawer/CompanyDrawer.vue (fire-and-forget fetch on drawer open)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * @param {unknown} body
 * @param {number} [status=200]
 * @returns {Response}
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_ANON_KEY'),
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'invalid input' }, 400)
  }

  try {
    let body
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'invalid input' }, 400)
    }

    const { startup_id, session_id } = body

    if (!UUID_REGEX.test(startup_id)) {
      return jsonResponse({ error: 'invalid input' }, 400)
    }

    if (
      typeof session_id !== 'string' ||
      session_id.length < 1 ||
      session_id.length > 64
    ) {
      return jsonResponse({ error: 'invalid input' }, 400)
    }

    const { error } = await supabase
      .from('company_views')
      .insert({ startup_id, session_id })

    if (error) {
      console.error('[track-view] insert error:', error)
    }

    return jsonResponse({ ok: true })

  } catch (err) {
    console.error('[track-view] unhandled error:', err)
    return jsonResponse({ ok: true })
  }
})
