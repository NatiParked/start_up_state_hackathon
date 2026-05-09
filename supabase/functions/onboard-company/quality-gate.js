/**
 * Quality gate: decides whether an enriched company record should be
 * auto-published to `map_startups` or held in `map_startup_submissions`
 * for human review.
 *
 * Checks are evaluated in order; the first failure short-circuits and returns
 * `{ passed: false, reason: '<human readable>' }`.
 */

import { isInsideUtah } from './utah-bounds.js';
import { normalizeDomain } from '../_shared/logo-dev.js';

/**
 * Run the auto-publish quality gate against an enriched company record.
 *
 * Checks (in order):
 *  1. Required fields — name, address, sector, description must be non-empty strings.
 *  2. Utah bounding-box check — lat/lng must be inside Utah.
 *  3. Duplicate detection — not already in `map_startups` or pending in `map_startup_submissions`.
 *  4. Utah DCC active status — if dcc_status is present it must be 'Active'.
 *
 * @param {object} record - Enriched company record from `runEnrichmentPipeline`.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient - Authenticated
 *   Supabase client with service-role access for duplicate detection queries.
 * @returns {Promise<{
 *   passed: boolean,
 *   reason: string|null,
 *   existing_id?: string
 * }>} Gate result.
 *   - `passed`: `true` if all checks pass; `false` on first failure.
 *   - `reason`: human-readable failure reason, or `null` when passed.
 *   - `existing_id`: populated only when the record duplicates an existing
 *     `map_startups` row; callers use it to return the existing startup id.
 */
export async function runQualityGate(record, supabaseClient) {
  // ── Check 1: Required fields ──────────────────────────────────────────────
  const requiredFields = ['name', 'address', 'sector', 'description'];
  const missingFields = requiredFields.filter((f) => {
    const val = record[f];
    return val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
  });

  if (missingFields.length > 0) {
    return { passed: false, reason: `Missing required fields: ${missingFields.join(', ')}` };
  }

  // ── Check 2: Utah bounding box ────────────────────────────────────────────
  if (!isInsideUtah({ lat: record.lat, lng: record.lng })) {
    return {
      passed: false,
      reason: `Coordinates are outside Utah bounding box (lat=${record.lat}, lng=${record.lng})`,
    };
  }

  // ── Check 3: Duplicate detection ─────────────────────────────────────────
  const domain = normalizeDomain(record.website);

  if (domain) {
    // 3a. Check map_startups for existing company by domain or name
    const { data: existingStartups, error: startupsError } = await supabaseClient
      .from('map_startups')
      .select('id')
      .or(`website.ilike.%${domain}%,name.ilike.${record.name}`)
      .limit(1);

    if (!startupsError && existingStartups && existingStartups.length > 0) {
      const existing = existingStartups[0];
      return {
        passed: false,
        reason: `Duplicate: company already exists in map_startups (id=${existing.id})`,
        existing_id: existing.id,
      };
    }

    // 3b. Check map_startup_submissions for pending or auto-published submission
    const { data: existingSubmissions, error: submissionsError } = await supabaseClient
      .from('map_startup_submissions')
      .select('id')
      .ilike('website', `%${domain}%`)
      .in('status', ['pending', 'auto_published'])
      .limit(1);

    if (!submissionsError && existingSubmissions && existingSubmissions.length > 0) {
      return {
        passed: false,
        reason: 'Duplicate: pending or auto-published submission already exists for this domain',
      };
    }
  }

  // ── Check 4: Utah DCC active status ──────────────────────────────────────
  if (record.dcc_status !== null && record.dcc_status !== undefined) {
    if (record.dcc_status !== 'Active') {
      return {
        passed: false,
        reason: `Utah DCC status is "${record.dcc_status}" (must be "Active" if present)`,
      };
    }
  }

  return { passed: true, reason: null };
}
