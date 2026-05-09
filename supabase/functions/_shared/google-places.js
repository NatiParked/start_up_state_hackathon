/**
 * Shared helper: Google Places (New) text-search enricher.
 * Usage: import { placesSearch } from '../_shared/google-places.js'
 *
 * This is a "stretch" enricher — if GOOGLE_PLACES_API_KEY is not configured
 * the function returns null silently rather than throwing.
 */

/**
 * Search Google Places for a company by name and city using the Places (New) API.
 * Returns null — never throws — when the API key is absent or on any error.
 *
 * @param {string} name - company name, e.g. 'Zonos'
 * @param {string} city - city to search in, e.g. 'St. George'
 * @returns {Promise<{place_id: string, rating: number|null, phone: string|null, business_status: string|null, photos: string[]}|null>}
 *   Normalized place record, or null if the API key is missing, the search yields no results,
 *   or the HTTP call fails
 */
export async function placesSearch(name, city) {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!key) return null;

  let response;
  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.rating,places.nationalPhoneNumber,places.businessStatus,places.photos',
      },
      body: JSON.stringify({ textQuery: `${name} ${city}` }),
    });
  } catch (_) {
    return null;
  }

  if (!response.ok) return null;

  let data;
  try {
    data = await response.json();
  } catch (_) {
    return null;
  }

  if (!data.places || data.places.length === 0) return null;

  const place = data.places[0];
  return {
    place_id: place.id,
    rating: place.rating ?? null,
    phone: place.nationalPhoneNumber ?? null,
    business_status: place.businessStatus ?? null,
    photos: (place.photos ?? []).map((p) => p.name),
  };
}
