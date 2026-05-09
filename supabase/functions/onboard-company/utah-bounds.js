/**
 * Utah geographic validation helpers.
 *
 * Provides coordinate bounding-box checks and Nominatim result state
 * verification for restricting the startup map to Utah companies.
 */

/**
 * Determine whether a lat/lng coordinate pair falls inside the Utah bounding box.
 *
 * Utah geographic bounds:
 *   Latitude:  37.0 – 42.0  (south to north)
 *   Longitude: -114.05 – -109.05 (west to east)
 *
 * @param {{ lat?: number, lng?: number }} coords - Coordinate pair to check.
 * @returns {boolean} `true` only if both values are finite numbers within
 *   the Utah bounding box; `false` for missing, non-finite, or out-of-range values.
 *   Never throws.
 */
export function isInsideUtah({ lat, lng } = {}) {
  try {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!isFinite(lat) || !isFinite(lng)) return false;
    return lat >= 37.0 && lat <= 42.0 && lng >= -114.05 && lng <= -109.05;
  } catch (_) {
    return false;
  }
}

/**
 * Verify that a Nominatim geocode result refers to a location in Utah.
 *
 * Checks `result.address.state` (case-insensitive match for 'utah') or
 * `result.address.state_code` (exact match for 'UT').
 *
 * @param {object|null} nominatimResult - Nominatim geocode result object,
 *   expected to have an `address` sub-object as returned by `_shared/nominatim.js`.
 * @returns {boolean} `true` if the result is in Utah; `false` for any other
 *   state, missing address, or null input. Never throws.
 */
export function verifyUtahState(nominatimResult) {
  try {
    if (!nominatimResult || typeof nominatimResult !== 'object') return false;
    const address = nominatimResult.address;
    if (!address || typeof address !== 'object') return false;
    if (typeof address.state === 'string' && address.state.toLowerCase() === 'utah') return true;
    if (address.state_code === 'UT') return true;
    return false;
  } catch (_) {
    return false;
  }
}
