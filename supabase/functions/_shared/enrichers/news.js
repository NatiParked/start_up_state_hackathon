/**
 * Stretch enricher: NewsAPI headlines for a startup name (key-gated).
 */
export async function enrichFromNews(name) {
  const apiKey = Deno.env.get('NEWS_API_KEY');
  if (!apiKey || apiKey.trim() === '') return {};
  try {
    const encoded = encodeURIComponent(name);
    const url = `https://newsapi.org/v2/everything?q=${encoded}&pageSize=3&sortBy=publishedAt&apiKey=${apiKey}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'goed-hackathon' } });
    if (!response.ok) return {};
    const data = await response.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];
    if (articles.length === 0) return {};
    const headlines = articles.slice(0, 3).map((a) => a.title).filter(Boolean);
    if (headlines.length === 0) return {};
    return { headlines };
  } catch (_) { return {}; }
}
