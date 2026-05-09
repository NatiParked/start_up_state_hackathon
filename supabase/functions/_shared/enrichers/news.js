/**
 * Stretch enricher: NewsAPI headlines for a startup name.
 *
 * Key-gated — when NEWS_API_KEY is absent (the expected demo state) this
 * module returns `{}` immediately with NO network call and NO console noise.
 *
 * Usage:
 *   import { enrichFromNews } from '../_shared/enrichers/news.js'
 *   const result = await enrichFromNews('Acme Corp')
 *   // => { headlines: ['Title 1', 'Title 2'] }  or  {}
 */

/**
 * Fetch recent news headlines mentioning the given startup name.
 *
 * Behaviour by state:
 *  - NEWS_API_KEY absent/empty  → returns `{}` with no fetch, no log (demo-safe)
 *  - API returns non-2xx        → returns `{}`
 *  - Network/parse error        → returns `{}`
 *  - No articles found          → returns `{}`
 *  - Articles found             → returns `{ headlines: string[] }` (up to 3 titles)
 *
 * @param {string} name - startup name to search for
 * @returns {Promise<{headlines?: string[]}>} enrichment payload, or `{}` on any failure/skip
 */
export async function enrichFromNews(name) {
  const apiKey = Deno.env.get('NEWS_API_KEY');
  if (!apiKey || apiKey.trim() === '') {
    // Expected state during demo — no key, no noise
    return {};
  }

  try {
    const encoded = encodeURIComponent(name);
    const url =
      `https://newsapi.org/v2/everything?q=${encoded}&pageSize=3&sortBy=publishedAt&apiKey=${apiKey}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'goed-hackathon' },
    });

    if (!response.ok) return {};

    const data = await response.json();

    const articles = Array.isArray(data.articles) ? data.articles : [];
    if (articles.length === 0) return {};

    const headlines = articles
      .slice(0, 3)
      .map((a) => a.title)
      .filter(Boolean);

    if (headlines.length === 0) return {};

    return { headlines };
  } catch (_) {
    return {};
  }
}
