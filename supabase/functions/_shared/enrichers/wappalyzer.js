/**
 * Stretch enricher: Wappalyzer tech-stack lookup (key-gated).
 *
 * When `WAPPALYZER_API_KEY` is absent — which is the expected demo state —
 * this function returns `{}` immediately with no network call and no console noise.
 * Set the env var to enable live lookups against the Wappalyzer v2 API.
 *
 * Usage: import { enrichFromWappalyzer } from './enrichers/wappalyzer.js'
 */

/**
 * Look up the technology stack for a given URL using the Wappalyzer API.
 *
 * Reads `WAPPALYZER_API_KEY` from `Deno.env`. If the key is absent or empty,
 * returns `{}` immediately — no fetch is issued and no log message is emitted.
 * This is the expected state for demo / hackathon deployments that have not
 * provisioned a Wappalyzer subscription.
 *
 * @param {string} url - The company website URL to analyse, e.g. 'https://zonos.com'
 * @returns {Promise<{ tech_stack: string[] } | {}>}
 *   On success: `{ tech_stack }` where each entry is a technology name string.
 *   On key-absent, non-2xx response, network error, or parse failure: `{}`.
 *   Never throws.
 */
export async function enrichFromWappalyzer(url) {
  try {
    const apiKey = Deno.env.get('WAPPALYZER_API_KEY');

    // Key absent or empty — return silently; this is the expected demo state.
    if (!apiKey) return {};

    const lookupUrl =
      `https://api.wappalyzer.com/v2/lookup/?urls=${encodeURIComponent(url)}`;

    const response = await fetch(lookupUrl, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) return {};

    const data = await response.json();

    // The API returns an array of result objects (one per URL submitted).
    // Each result has a `technologies` array with objects that include `.name`.
    const firstResult = Array.isArray(data) ? data[0] : data;
    const technologies = firstResult?.technologies ?? firstResult?.tech ?? [];

    const tech_stack = Array.isArray(technologies)
      ? technologies.map((t) => t.name).filter(Boolean)
      : [];

    return { tech_stack };
  } catch (_err) {
    // Never throw — degrade silently.
    return {};
  }
}
