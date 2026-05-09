/**
 * Shared helper: rate-limited Nominatim (OpenStreetMap) geocoder.
 * Usage: import { geocodeAddress, extractCity } from '../_shared/nominatim.js'
 *
 * Nominatim ToS requires:
 *  - User-Agent header identifying the application
 *  - Maximum 1 request per second
 */

/** Tracks the timestamp of the last Nominatim request for rate-limiting. */
let lastCallAt = 0;

/**
 * Geocode a free-form address string using Nominatim.
 * Enforces at least 1000ms between calls and retries once on HTTP 429.
 *
 * @param {string} address - free-form address to geocode, e.g. '136 S Main St, Salt Lake City, UT'
 * @returns {Promise<{lat: number, lng: number, display_name: string, address: object}|null>}
 *   Parsed result object, or null if not found / non-2xx / empty results
 * @throws never — all network errors are caught and returned as null
 */
export async function geocodeAddress(address) {
  // Rate limiting: ensure at least 1000ms between calls
  const wait = Math.max(0, 1000 - (Date.now() - lastCallAt));
  await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(address)}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'goed-hackathon' },
    });
  } catch (_) {
    return null;
  }

  // On 429: wait 2s and retry exactly once
  if (response.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    lastCallAt = Date.now();
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': 'goed-hackathon' },
      });
    } catch (_) {
      return null;
    }
  }

  if (!response.ok) return null;

  let json;
  try {
    json = await response.json();
  } catch (_) {
    return null;
  }

  if (!Array.isArray(json) || json.length === 0) return null;

  const r = json[0];
  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    display_name: r.display_name,
    address: r.address,
  };
}

/**
 * Extract a human-readable city name from a Nominatim geocode result.
 * Checks address fields in priority order: city → town → village → municipality → county.
 *
 * @param {{address: object}|null} result - object returned by geocodeAddress
 * @returns {string|null} city/town/village/municipality/county name, or null if none found
 */
export function extractCity(result) {
  if (!result || !result.address) return null;
  const a = result.address;
  return a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
}
