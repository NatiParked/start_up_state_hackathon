/**
 * Shared enricher: Crunchbase scraper for investor and funding data.
 *
 * Fetches the Crunchbase organization page for a given domain, extracts
 * the embedded `__NEXT_DATA__` JSON blob, and walks it for funding/investor
 * information. Falls back to `og:description` meta tag if the JSON blob is
 * absent or unparseable — but ONLY for surface-level text; funding fields
 * are never populated from the fallback. Returns `{}` on any failure.
 *
 * Usage:
 *   import { enrichFromCrunchbase } from '../_shared/enrichers/crunchbase.js'
 */

/**
 * Convert a domain string into a Crunchbase organization slug.
 * Strips the TLD and any leading "www.", lowercases, and replaces
 * internal dots with dashes.
 *
 * Examples:
 *   "zonos.com"       → "zonos"
 *   "my.company.io"   → "my-company"
 *   "www.example.org" → "example"
 *
 * @param {string} domain
 * @returns {string} slug, or empty string if input is blank
 */
function domainToSlug(domain) {
  if (!domain || typeof domain !== 'string') return '';

  let slug = domain.trim().toLowerCase();

  // Strip protocol if accidentally included
  slug = slug.replace(/^https?:\/\//, '');

  // Strip leading "www."
  slug = slug.replace(/^www\./, '');

  // Strip TLD: remove the last dot-segment (e.g. ".com", ".io", ".co.uk")
  // For multi-part TLDs like ".co.uk" this removes only the last segment;
  // that is acceptable — Crunchbase slugs are best-effort.
  slug = slug.replace(/\.[^.]+$/, '');

  // Replace remaining dots with dashes
  slug = slug.replace(/\./g, '-');

  return slug;
}

/**
 * Walk a nested object/array looking for the first value that appears to
 * contain funding round data. Crunchbase's __NEXT_DATA__ shape changes
 * occasionally, so we probe several known paths before giving up.
 *
 * @param {object} data - Parsed __NEXT_DATA__ JSON
 * @returns {{ investors: string[], total_raised: string, funding_rounds: object[] }}
 */
function extractFundingData(data) {
  const result = { investors: [], total_raised: '', funding_rounds: [] };

  try {
    // Try common paths in __NEXT_DATA__
    const pageProps =
      data?.props?.pageProps ?? data?.pageProps ?? {};

    // Path 1: entity.properties (common for organization pages)
    const entityProps =
      pageProps?.entity?.properties ??
      pageProps?.entity?.entityDef?.properties ??
      {};

    // total_raised: funding_total.value_usd or funding_total.converted_value
    const fundingTotal =
      entityProps?.funding_total ??
      entityProps?.funding_total_usd ??
      null;

    if (fundingTotal) {
      const rawValue =
        fundingTotal?.value_usd ??
        fundingTotal?.converted_value ??
        fundingTotal?.value ??
        null;
      if (rawValue != null) {
        result.total_raised = String(rawValue);
      }
    }

    // funding_rounds: look for an array under several possible keys
    const roundsRaw =
      entityProps?.funding_rounds?.entities ??
      entityProps?.funding_rounds ??
      pageProps?.fundingRounds ??
      null;

    if (Array.isArray(roundsRaw)) {
      result.funding_rounds = roundsRaw.map((r) => {
        const p = r?.properties ?? r ?? {};
        return {
          announced_on: p.announced_on ?? p.announced_on_trust_code ?? null,
          investment_type: p.investment_type ?? null,
          money_raised: p.money_raised?.value_usd ?? p.money_raised?.value ?? null,
        };
      });
    }

    // investors: look for lead_investors or investors arrays
    const investorsRaw =
      entityProps?.investors?.entities ??
      entityProps?.lead_investors?.entities ??
      pageProps?.investors ??
      null;

    if (Array.isArray(investorsRaw)) {
      result.investors = investorsRaw
        .map((inv) => {
          const p = inv?.properties ?? inv ?? {};
          return (
            p?.investor?.properties?.identifier?.value ??
            p?.investor?.value ??
            p?.name ??
            p?.identifier?.value ??
            null
          );
        })
        .filter(Boolean);
    }

    // Path 2: searchResults (some page layouts use this)
    const searchResults = pageProps?.searchResults ?? [];
    if (Array.isArray(searchResults) && result.investors.length === 0) {
      for (const item of searchResults) {
        const props = item?.properties ?? {};
        if (props?.investor_identifiers) {
          const ids = props.investor_identifiers;
          if (Array.isArray(ids)) {
            result.investors = ids.map((id) => id?.value ?? id).filter(Boolean);
          }
          break;
        }
      }
    }
  } catch (_err) {
    // Extraction failed — return whatever was collected so far
  }

  return result;
}

/**
 * Enrich a company record with investor and funding data from Crunchbase.
 *
 * Fetches `https://www.crunchbase.com/organization/{slug}`, where `{slug}`
 * is derived from the supplied `domain` (e.g. `"zonos.com"` → `"zonos"`).
 *
 * Primary parse path:
 *   Extracts the `<script id="__NEXT_DATA__" …>` JSON blob embedded in the
 *   HTML and walks known property paths for funding totals, funding rounds,
 *   and investor names.
 *
 * Fallback:
 *   If `__NEXT_DATA__` is absent or unparseable, reads `<meta property="og:description">`
 *   for a one-line summary, but does NOT populate any funding fields from it.
 *   Returns `{}` for funding in this case.
 *
 * Failure modes that silently return `{}`:
 *   - `domain` is null, empty, or not a string
 *   - Network / fetch error
 *   - Non-2xx HTTP response
 *   - JSON parse failure
 *   - Any unhandled exception inside the function
 *
 * @param {string} domain - Company domain, e.g. `"zonos.com"` or `"my.company.io"`
 * @returns {Promise<{ investors?: string[], total_raised?: string, funding_rounds?: object[] }>}
 *   A plain object with funding fields populated from structured data, or `{}`
 *   when no data could be extracted. Never throws.
 */
export async function enrichFromCrunchbase(domain) {
  try {
    const slug = domainToSlug(domain);
    if (!slug) return {};

    const url = `https://www.crunchbase.com/organization/${slug}`;

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (_fetchErr) {
      // Network error — return empty
      return {};
    }

    if (!response.ok) {
      return {};
    }

    let html;
    try {
      html = await response.text();
    } catch (_readErr) {
      return {};
    }

    // --- Primary path: extract __NEXT_DATA__ JSON blob ---
    const nextDataMatch = html.match(
      /<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/
    );

    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const funding = extractFundingData(nextData);
        return funding;
      } catch (_parseErr) {
        // Fall through to og:description fallback
      }
    }

    // --- Fallback: og:description meta tag ---
    // We extract the description text for surface-level information only.
    // Funding fields are intentionally NOT populated from this source.
    const ogDescMatch = html.match(
      /<meta\s+property="og:description"\s+content="([^"]*)"[^>]*>/i
    ) ?? html.match(
      /<meta\s+content="([^"]*)"\s+property="og:description"[^>]*>/i
    );

    if (ogDescMatch && ogDescMatch[1]) {
      // Description available but we deliberately return empty funding object
      // per spec: "DO NOT populate funding fields from og:description"
      return {};
    }

    return {};
  } catch (_outerErr) {
    // Catch-all: never throw out of this function
    return {};
  }
}
