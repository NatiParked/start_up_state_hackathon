/**
 * End-to-end enrichment pipeline orchestrator.
 *
 * Given a company website URL (and optionally the submitter's email), this
 * module fetches data from every structured source in parallel, fills remaining
 * gaps with a Claude Haiku LLM call, geocodes the resulting address, and
 * returns a single normalized record whose keys map 1:1 to `map_startups`
 * columns.
 *
 * Usage:
 *   import { runEnrichmentPipeline } from '../_shared/pipeline.js'
 *   const record = await runEnrichmentPipeline({ url: 'https://zonos.com', email: 'founder@example.com' })
 */

import { normalizeDomain, fetchLogo } from './logo-dev.js';
import { geocodeAddress, extractCity } from './nominatim.js';
import { callLLM, extractJsonFromText } from './llm.js';
import { pollAts } from './ats.js';
import { enrichFromCrunchbase } from './enrichers/crunchbase.js';
import { enrichFromUtahDcc } from './enrichers/utah-dcc.js';
import { enrichFromGithub } from './enrichers/github.js';
import { enrichFromWappalyzer } from './enrichers/wappalyzer.js';
import { enrichFromProductHunt } from './enrichers/producthunt.js';
import { enrichFromNews } from './enrichers/news.js';

/** Maximum bytes of homepage HTML to pass into the Claude gap-fill prompt. */
const HTML_TRUNCATE_BYTES = 50_000;

/** Realistic browser User-Agent used when fetching company homepages. */
const FETCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * ATS hostname substrings to look for in anchor hrefs when scraping
 * the company homepage for a careers link.
 */
const ATS_HOSTS = ['greenhouse.io', 'lever.co', 'ashbyhq.com'];

/**
 * Build a null-safe empty record with all 20 required output keys.
 *
 * @returns {object} Record with every key set to null.
 */
function emptyRecord() {
  return {
    name: null,
    description: null,
    website: null,
    address: null,
    city: null,
    lat: null,
    lng: null,
    region: null,
    sector: null,
    stage: null,
    employee_range: null,
    founded_year: null,
    is_hiring: null,
    job_titles: null,
    careers_url: null,
    logo_url: null,
    investors: null,
    total_raised: null,
    dcc_status: null,
    dcc_entity_type: null,
  };
}

/**
 * Extract the first `<a href="…">` whose href contains one of the ATS hostnames.
 *
 * @param {string} html - Raw HTML string of the company homepage.
 * @returns {string|null} The ATS careers URL if found, otherwise null.
 */
function findAtsUrlInHtml(html) {
  if (!html) return null;
  const escaped = ATS_HOSTS.map(h => h.replace(/\./g, '\\.')).join('|');
  const hrefPattern = new RegExp(`href=["']([^"']*(?:${escaped})[^"']*)`, 'i');
  const match = hrefPattern.exec(html);
  return match ? match[1] : null;
}

/**
 * Determine whether a value is considered "missing" (null, undefined, or empty string).
 *
 * @param {*} value
 * @returns {boolean}
 */
function isMissing(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Run the full enrichment pipeline for a submitted company URL.
 *
 * Orchestration order:
 *  1. Validate URL → compute domain.
 *  2. Fetch homepage HTML (truncated to ~50 KB).
 *  3. Resolve logo URL synchronously.
 *  4. Run all structured enrichers in parallel via Promise.allSettled.
 *  5. Build partial record from enricher results.
 *  6. Detect careers URL → poll ATS.
 *  7. Gemini-with-Google-Search grounded extraction for the full field set; merge only into still-null fields.
 *  8. Geocode address → fill lat/lng/city/region.
 *  9. Return normalized 20-field record.
 *
 * @param {{ url?: string, email?: string }} options
 *   - url: company website URL, e.g. 'https://zonos.com'
 *   - email: submitter email (passed to the LLM prompt for context)
 * @returns {Promise<{
 *   name: string|null,
 *   description: string|null,
 *   website: string|null,
 *   address: string|null,
 *   city: string|null,
 *   lat: number|null,
 *   lng: number|null,
 *   region: string|null,
 *   sector: string|null,
 *   stage: string|null,
 *   employee_range: string|null,
 *   founded_year: number|null,
 *   is_hiring: boolean|null,
 *   job_titles: string[]|null,
 *   careers_url: string|null,
 *   logo_url: string|null,
 *   investors: string[]|null,
 *   total_raised: string|null,
 *   dcc_status: string|null,
 *   dcc_entity_type: string|null,
 * }>} Normalized company record — all 20 keys always present; unresolved → null.
 *   Never throws.
 */
export async function runEnrichmentPipeline({ url, email } = {}) {
  const record = emptyRecord();

  // ── Step 1: Validate URL ─────────────────────────────────────────────────
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return record; // website stays null
  }

  const cleanUrl = url.trim();
  record.website = cleanUrl;

  const domain = normalizeDomain(cleanUrl);
  if (!domain) {
    return record;
  }

  // Derive a rough "company name guess" from the domain root for enrichers
  // that need a name before Claude runs (e.g. DCC, ProductHunt, News).
  const domainRoot = domain.split('.')[0];

  // ── Step 2: Fetch homepage HTML ──────────────────────────────────────────
  let html = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let htmlResponse;
    try {
      htmlResponse = await fetch(cleanUrl, {
        headers: { 'User-Agent': FETCH_USER_AGENT },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (htmlResponse.ok) {
      const raw = await htmlResponse.text();
      html = raw.length > HTML_TRUNCATE_BYTES ? raw.slice(0, HTML_TRUNCATE_BYTES) : raw;
    }
  } catch (err) {
    console.error('[pipeline] Failed to fetch homepage HTML:', err?.message ?? err);
    html = '';
  }

  // ── Step 3: Resolve logo URL ─────────────────────────────────────────────
  try {
    record.logo_url = fetchLogo(cleanUrl) ?? null;
  } catch (err) {
    console.error('[pipeline] fetchLogo failed:', err?.message ?? err);
    record.logo_url = null;
  }

  // ── Step 4: Run structured enrichers in parallel ─────────────────────────
  const [dccResult, crunchbaseResult, githubResult, wappalyzerResult, phResult, newsResult] =
    await Promise.allSettled([
      enrichFromUtahDcc(domainRoot),
      enrichFromCrunchbase(domain),
      enrichFromGithub(domain),
      enrichFromWappalyzer(cleanUrl),
      enrichFromProductHunt(domainRoot),
      enrichFromNews(domainRoot),
    ]);

  // Helper to safely extract a fulfilled value or fall back to a default.
  const fulfilled = (result, fallback = {}) =>
    result.status === 'fulfilled' ? (result.value ?? fallback) : fallback;

  const dcc = fulfilled(dccResult);
  const crunchbase = fulfilled(crunchbaseResult);
  // github, wappalyzer, producthunt, news are available but not mapped to the
  // 20 required output fields — they remain available for future extensions.
  // We still log errors from them so issues surface.
  if (githubResult.status === 'rejected') {
    console.error('[pipeline] enrichFromGithub rejected:', githubResult.reason);
  }
  if (wappalyzerResult.status === 'rejected') {
    console.error('[pipeline] enrichFromWappalyzer rejected:', wappalyzerResult.reason);
  }
  if (phResult.status === 'rejected') {
    console.error('[pipeline] enrichFromProductHunt rejected:', phResult.reason);
  }
  if (newsResult.status === 'rejected') {
    console.error('[pipeline] enrichFromNews rejected:', newsResult.reason);
  }

  // ── Step 5: Build partial record from enricher results ───────────────────
  // DCC → dcc_entity_type, dcc_status
  if (!isMissing(dcc.entity_type)) record.dcc_entity_type = dcc.entity_type;
  if (!isMissing(dcc.status)) record.dcc_status = dcc.status;

  // Crunchbase → investors, total_raised
  if (Array.isArray(crunchbase.investors)) {
    record.investors = crunchbase.investors.length > 0 ? crunchbase.investors : [];
  } else {
    record.investors = [];
  }
  if (!isMissing(crunchbase.total_raised)) record.total_raised = crunchbase.total_raised;

  // ── Step 6: Detect careers URL and poll ATS ──────────────────────────────
  let careersUrl = null;
  try {
    // First try: look for an ATS link in the homepage HTML
    const atsFromHtml = findAtsUrlInHtml(html);
    if (atsFromHtml) {
      careersUrl = atsFromHtml;
    } else {
      // Second try: construct a /careers guess
      careersUrl = `${cleanUrl.replace(/\/$/, '')}/careers`;
    }
  } catch (err) {
    console.error('[pipeline] Error detecting careers URL:', err?.message ?? err);
  }

  if (careersUrl) {
    try {
      const atsData = await pollAts(careersUrl);
      if (atsData !== null) {
        record.is_hiring = atsData.is_hiring ?? null;
        record.job_titles = Array.isArray(atsData.job_titles) ? atsData.job_titles : [];
        record.careers_url = atsData.careers_url ?? careersUrl;
      }
    } catch (err) {
      console.error('[pipeline] pollAts failed:', err?.message ?? err);
    }
  }

  // ── Step 7: Gemini-with-grounding extraction ─────────────────────────────
  // Always run once per submission — fills all still-null scalar and array fields.
  const groundedFields = [
    'name', 'description', 'sector', 'stage', 'founded_year',
    'address', 'employee_range', 'total_raised', 'investors',
  ];

  const partialSummary = JSON.stringify({
    website: record.website,
    dcc_entity_type: record.dcc_entity_type,
    dcc_status: record.dcc_status,
    investors: record.investors,
    total_raised: record.total_raised,
    is_hiring: record.is_hiring,
    job_titles: record.job_titles,
  });

  const systemPrompt =
    'You are a startup data enrichment assistant with access to Google Search. ' +
    'Search the web for the company identified by the URL and domain below to find current, accurate information. ' +
    'Return ONLY a strict JSON object with EXACTLY these keys and no extras: ' +
    groundedFields.join(', ') + '. ' +
    'Use null for any field you cannot determine with confidence. ' +
    'Field constraints:\n' +
    '- sector: one of fintech, healthtech, edtech, cleantech, enterprise-software, consumer, ecommerce, logistics, biotech, ai-ml, cybersecurity, other\n' +
    '- stage: one of idea, pre-seed, seed, series-a, series-b, growth, public, other\n' +
    '- founded_year: 4-digit integer or null\n' +
    '- address: full street address like "123 Main St, Salt Lake City, UT 84101" or null\n' +
    '- employee_range: one of "1-10", "11-50", "51-200", "201-500", "500+" or null\n' +
    '- total_raised: formatted string like "$5M" or "$120M" or null\n' +
    '- investors: array of investor name strings (may be empty array [])';

  const userPrompt =
    `Company URL: ${cleanUrl}\n` +
    `Domain: ${domain}\n` +
    (email ? `Submitter email: ${email}\n` : '') +
    `Already known data: ${partialSummary}\n\n` +
    `Homepage HTML (truncated, may be empty for SPAs — fall back to web search if so):\n${html}`;

  console.log(`[pipeline] Gemini grounded call: requesting ${groundedFields.length} fields`);

  try {
    const rawText = await callLLM({ systemPrompt, userPrompt, useGrounding: true });
    const parsed = extractJsonFromText(rawText);

    if (parsed === null) {
      console.error('[pipeline] Gemini parse error:', String(rawText).slice(0, 500));
    } else {
      const filled = Object.entries(parsed).filter(([_, v]) => !isMissing(v)).map(([k]) => k);
      console.log('[pipeline] Gemini returned: ' + filled.join(', '));

      // Merge scalars — only into still-null/empty fields
      const scalarFields = ['name', 'description', 'sector', 'stage', 'founded_year', 'address', 'employee_range', 'total_raised'];
      for (const field of scalarFields) {
        if (isMissing(record[field]) && !isMissing(parsed[field])) {
          record[field] = parsed[field];
        }
      }

      // Merge investors — treat empty array as "still missing"
      const existingInvestors = record.investors;
      const parsedInvestors = parsed.investors;
      if (
        (existingInvestors === null || (Array.isArray(existingInvestors) && existingInvestors.length === 0)) &&
        Array.isArray(parsedInvestors) &&
        parsedInvestors.length > 0
      ) {
        record.investors = parsedInvestors;
      }
    }
  } catch (err) {
    console.error('[pipeline] Gemini grounded call failed:', err?.message ?? err);
  }

  // ── Step 8: Geocode address ───────────────────────────────────────────────
  if (!isMissing(record.address)) {
    try {
      const geoResult = await geocodeAddress(record.address);
      if (geoResult !== null) {
        record.lat = geoResult.lat ?? null;
        record.lng = geoResult.lng ?? null;
        record.city = extractCity(geoResult) ?? null;

        // Default region to 'Utah' when the geocode result is in Utah
        const stateField =
          geoResult.address?.state ??
          geoResult.address?.state_code ??
          geoResult.address?.county ??
          '';
        const isUtah =
          typeof stateField === 'string' &&
          (stateField.toLowerCase() === 'utah' || stateField.toUpperCase() === 'UT');
        record.region = isUtah ? 'Utah' : null;
      }
    } catch (err) {
      console.error('[pipeline] geocodeAddress failed:', err?.message ?? err);
    }
  }

  // ── Step 9: Return normalized record ─────────────────────────────────────
  // Ensure array fields default to [] rather than null when their source ran
  if (record.job_titles === null) record.job_titles = null; // null means we didn't detect any ATS
  if (record.investors === null) record.investors = [];

  return record;
}
