/**
 * Stretch enricher: Wappalyzer tech-stack lookup (key-gated).
 */
export async function enrichFromWappalyzer(url) {
  try {
    const apiKey = Deno.env.get('WAPPALYZER_API_KEY');
    if (!apiKey) return {};
    const lookupUrl = `https://api.wappalyzer.com/v2/lookup/?urls=${encodeURIComponent(url)}`;
    const response = await fetch(lookupUrl, { headers: { 'x-api-key': apiKey } });
    if (!response.ok) return {};
    const data = await response.json();
    const firstResult = Array.isArray(data) ? data[0] : data;
    const technologies = firstResult?.technologies ?? firstResult?.tech ?? [];
    const tech_stack = Array.isArray(technologies) ? technologies.map((t) => t.name).filter(Boolean) : [];
    return { tech_stack };
  } catch (_err) { return {}; }
}
