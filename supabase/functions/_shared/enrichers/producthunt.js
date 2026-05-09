/**
 * Stretch enricher: ProductHunt launch data.
 */
const GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';
const SEARCH_URL = 'https://www.producthunt.com/search';

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function _enrichViaApi(name, token) {
  const slug = toSlug(name);
  const query = `query { post(slug: "${slug}") { createdAt votesCount } }`;
  let response;
  try { response = await fetch(GRAPHQL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'User-Agent': 'goed-hackathon' }, body: JSON.stringify({ query }) }); } catch (_) { return {}; }
  if (!response.ok) return {};
  let json;
  try { json = await response.json(); } catch (_) { return {}; }
  const post = json?.data?.post;
  if (!post) return {};
  const launch_date = post.createdAt ? new Date(post.createdAt).toISOString().split('T')[0] : null;
  const upvotes = typeof post.votesCount === 'number' ? post.votesCount : null;
  if (!launch_date && upvotes === null) return {};
  return { ...(launch_date !== null && { launch_date }), ...(upvotes !== null && { upvotes }) };
}

async function _enrichViaScrape(name) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(name)}`;
  let response;
  try { response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; goed-hackathon/1.0)', 'Accept': 'text/html,application/xhtml+xml' } }); } catch (_) { return {}; }
  if (!response.ok) return {};
  let html;
  try { html = await response.text(); } catch (_) { return {}; }
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const launch_date = item.datePublished ? String(item.datePublished).split('T')[0] : null;
        let upvotes = null;
        if (Array.isArray(item.interactionStatistic)) {
          for (const stat of item.interactionStatistic) {
            if (stat['@type'] === 'InteractionCounter' && typeof stat.userInteractionCount === 'number') { upvotes = stat.userInteractionCount; break; }
          }
        }
        if (launch_date || upvotes !== null) return { ...(launch_date && { launch_date }), ...(upvotes !== null && { upvotes }) };
      }
    } catch (_) {}
  }
  return {};
}

export async function enrichFromProductHunt(name) {
  if (!name || typeof name !== 'string' || name.trim() === '') return {};
  try {
    const token = Deno.env.get('PRODUCTHUNT_API_TOKEN');
    if (token && token.trim() !== '') return await _enrichViaApi(name.trim(), token.trim());
    return await _enrichViaScrape(name.trim());
  } catch (_) { return {}; }
}
