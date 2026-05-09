/**
 * company-photos — Server-side proxy that fetches Google Places photo URLs for a given place_id.
 * Keeps the GOOGLE_PLACES_API_KEY off the client entirely.
 *
 * Accepts:
 *   POST { place_id: string }  (preferred — matches supabase.functions.invoke)
 *   GET  ?place_id=...         (for manual curl testing)
 *
 * Returns: 200 { photos: [{ url: string, attribution: string|null }] }
 * Never returns a non-200 status from business logic — always degrades to { photos: [] }.
 *
 * curl example:
 *   curl -X POST https://punpjzwxqazqbxvkyemv.supabase.co/functions/v1/company-photos \
 *     -H 'Authorization: Bearer <anon-key>' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"place_id":"ChIJN1t_tDeuEmsRUsoyG83frY4"}'
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return errorResponse('INVALID_INPUT', 'Method not allowed', 405);
  }

  try {
    // ── Parse place_id ────────────────────────────────────────────────────────
    let place_id;

    if (req.method === 'POST') {
      const body = await req.json();
      place_id = body?.place_id;
    } else {
      const url = new URL(req.url);
      place_id = url.searchParams.get('place_id');
    }

    if (!place_id) {
      return errorResponse('INVALID_INPUT', 'place_id is required', 400);
    }

    // ── Read API key — graceful degradation if missing ────────────────────────
    const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!key) {
      console.warn('[company-photos] GOOGLE_PLACES_API_KEY not set; returning empty list');
      return jsonResponse({ photos: [] });
    }

    // ── Fetch photo names from Places (New) API ───────────────────────────────
    const placesUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=photos`;
    const placesRes = await fetch(placesUrl, {
      headers: { 'X-Goog-Api-Key': key },
    });

    if (!placesRes.ok) {
      console.error('[company-photos] Places API error:', placesRes.status, await placesRes.text());
      return jsonResponse({ photos: [] });
    }

    const placesData = await placesRes.json();
    const rawPhotos = placesData?.photos ?? [];

    // ── Map to { url, attribution } objects ──────────────────────────────────
    // Each photo.name is a resource path like "places/ChIJ.../photos/AeR..."
    // We construct the media URL directly — no additional round-trip needed.
    const photos = rawPhotos.map((photo) => ({
      url: `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${key}`,
      attribution: photo.authorAttributions?.[0]?.displayName ?? null,
    }));

    return jsonResponse({ photos });

  } catch (err) {
    console.error('[company-photos] fetch failed:', err);
    return jsonResponse({ photos: [] });
  }
});
