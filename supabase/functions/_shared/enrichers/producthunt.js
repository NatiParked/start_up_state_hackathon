/**
 * Shared helper: ProductHunt stretch enricher.
 *
 * Looks up a company/product by name on ProductHunt and returns launch date
 * and upvote count.
 *
 * Strategy:
 *  1. If `PRODUCTHUNT_API_TOKEN` env var is set, use the ProductHunt GraphQL
 *     API (https://api.producthunt.com/v2/api/graphql) with bearer auth,
 *     querying posts by `slug: name` (slugified from the input name).
 *  2. Otherwise, fetch the public search page
 *     (https://www.producthunt.com/search?q={encoded name}) and extract the
 *     first product hit via best-effort regex over JSON-LD / meta tags.
 *
 * Returns `{}` silently when:
 *  - `name` is empty or null
 *  - No API token is set AND the scrape yields no match
 *  - The API responds with a rate-limit (429) or any non-2xx status
 *  - Any fetch or parse error occurs
 *
 * This is a stretch enricher — the expected demo state is no API token, in
 * which case only the public scrape path is attempted and `{}` on any failure
 * is the acceptable result.
 *
 * Usage: import { enrichFromProductHunt } from '../_shared/enrichers/producthunt.js'
 */

const GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';
const SEARCH_URL = 'https://www.producthunt.com/search';

/**
 * Convert a plain string to a ProductHunt-style slug.
 * e.g. "My Cool App" → "my-cool-app"
 *
 * @param {string} name
 * @returns {string}
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Try to extract launch_date and upvotes from the ProductHunt GraphQL API.
 *
 * @param {string} name - product name or slug
 * @param {string} token - bearer token
 * @returns {Promise<{launch_date: string, upvotes: number}|{}>}
 */
async function _enrichViaApi(name, token) {
  const slug = toSlug(name);

  const query = `
    query {
      post(slug: "${slug}") {
        createdAt
        votesCount
      }
    }
  `;

  let response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'goed-hackathon',
      },
      body: JSON.stringify({ query }),
    });
  } catch (_) {
    return {};
  }

  if (!response.ok) return {};

  let json;
  try {
    json = await response.json();
  } catch (_) {
    return {};
  }

  const post = json?.data?.post;
  if (!post) return {};

  const launch_date = post.createdAt
    ? new Date(post.createdAt).toISOString().split('T')[0]
    : null;
  const upvotes = typeof post.votesCount === 'number' ? post.votesCount : null;

  if (!launch_date && upvotes === null) return {};

  return {
    ...(launch_date !== null && { launch_date }),
    ...(upvotes !== null && { upvotes }),
  };
}

/**
 * Try to extract launch_date and upvotes by scraping the ProductHunt public
 * search page for the given name.
 *
 * Parsing is best-effort regex over the raw HTML — looks for:
 *  - JSON-LD `<script type="application/ld+json">` blocks that contain
 *    datePublished / interactionStatistic fields.
 *  - OG/meta tags as a secondary fallback for the date.
 *
 * @param {string} name - product/company name to search for
 * @returns {Promise<{launch_date: string, upvotes: number}|{}>}
 */
async function _enrichViaScrape(name) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(name)}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; goed-hackathon/1.0; +https://goed.utah.gov)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
  } catch (_) {
    return {};
  }

  // Treat 429 and non-2xx as silent failures
  if (!response.ok) return {};

  let html;
  try {
    html = await response.text();
  } catch (_) {
    return {};
  }

  // --- Attempt 1: JSON-LD blocks ---
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const launch_date = item.datePublished
          ? String(item.datePublished).split('T')[0]
          : null;

        // interactionStatistic may hold vote/review counts
        let upvotes = null;
        if (Array.isArray(item.interactionStatistic)) {
          for (const stat of item.interactionStatistic) {
            if (
              stat['@type'] === 'InteractionCounter' &&
              typeof stat.userInteractionCount === 'number'
            ) {
              upvotes = stat.userInteractionCount;
              break;
            }
          }
        }

        if (launch_date || upvotes !== null) {
          return {
            ...(launch_date && { launch_date }),
            ...(upvotes !== null && { upvotes }),
          };
        }
      }
    } catch (_) {
      // malformed JSON-LD block — keep scanning
    }
  }

  // --- Attempt 2: og:article:published_time meta tag ---
  const ogDateMatch = html.match(
    /<meta[^>]+property=["']og:article:published_time["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogDateMatch) {
    return { launch_date: ogDateMatch[1].split('T')[0] };
  }

  // --- Attempt 3: inline __NEXT_DATA__ or similar JSON blobs ---
  const nextDataMatch = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Walk a known path structure — PH uses various shapes; try a few
      const posts =
        nextData?.props?.pageProps?.posts ||
        nextData?.props?.pageProps?.searchResults?.posts ||
        [];
      const firstPost = Array.isArray(posts) ? posts[0] : null;
      if (firstPost) {
        const launch_date = firstPost.createdAt
          ? new Date(firstPost.createdAt).toISOString().split('T')[0]
          : null;
        const upvotes =
          typeof firstPost.votesCount === 'number' ? firstPost.votesCount : null;
        if (launch_date || upvotes !== null) {
          return {
            ...(launch_date && { launch_date }),
            ...(upvotes !== null && { upvotes }),
          };
        }
      }
    } catch (_) {
      // ignore parse failure
    }
  }

  return {};
}

/**
 * Enrich a company record with ProductHunt launch data.
 *
 * Prefers the GraphQL API when `PRODUCTHUNT_API_TOKEN` is set in the
 * environment. Falls back to scraping the public search page otherwise.
 *
 * @param {string|null|undefined} name - the product or company name to look up
 * @returns {Promise<{launch_date?: string, upvotes?: number}|{}>}
 *   An object with `launch_date` (ISO date string) and/or `upvotes` (integer)
 *   if found, or an empty object `{}` on any failure, no match, or empty input.
 * @throws never — all errors are caught internally and return `{}`
 */
export async function enrichFromProductHunt(name) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return {};
  }

  try {
    const token = Deno.env.get('PRODUCTHUNT_API_TOKEN');

    if (token && token.trim() !== '') {
      return await _enrichViaApi(name.trim(), token.trim());
    }

    return await _enrichViaScrape(name.trim());
  } catch (_) {
    return {};
  }
}
