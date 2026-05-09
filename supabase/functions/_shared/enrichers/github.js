/**
 * Shared enricher: GitHub public org search.
 *
 * Unauthenticated GitHub Search API is limited to 10 requests/minute per IP.
 * This enricher makes no attempt to authenticate — it is designed for low-frequency
 * use (one call per submission). If the rate limit is hit (403 or 429), the function
 * returns `{}` silently and lets the pipeline continue without GitHub data.
 *
 * `contributor_count` is approximated as the sum of `stargazers_count` across the
 * first page of search results (up to 30 repos). This is a proxy only — it does not
 * reflect actual committer count, which would require per-repo contributor API calls
 * that would exhaust the unauthenticated rate limit. The field name is kept as
 * `contributor_count` for pipeline schema compatibility; consumers should treat it
 * as a relative popularity signal, not a headcount.
 */

/**
 * Enrich a company domain with GitHub organisation metadata.
 *
 * Derives an org name from the domain by stripping the TLD and taking the first
 * dot-separated segment (e.g. `zonos.com` → `zonos`, `acme.co.uk` → `acme`).
 * Queries the GitHub Search Repositories API for that org name.
 *
 * Rate limits: unauthenticated GitHub Search API = 10 requests/minute.
 * Returns `{}` silently on 403, 429, any non-2xx, network error, or empty domain.
 * Never throws.
 *
 * @param {string} domain - The company domain (e.g. `'zonos.com'`). May include
 *   a leading `https://` — it is stripped before parsing.
 * @returns {Promise<{ repo_count?: number, languages?: string[], contributor_count?: number }>}
 *   On success: `repo_count` (total org repos on GitHub), `languages` (unique non-null
 *   languages found across the first-page results), and `contributor_count` (sum of
 *   `stargazers_count` across first-page repos — used as a popularity proxy).
 *   On any failure: `{}`.
 */
export async function enrichFromGithub(domain) {
  try {
    if (!domain || typeof domain !== 'string') return {};

    // Strip protocol and path, leaving just the host
    const host = domain
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .toLowerCase()
      .trim();

    if (!host) return {};

    // Derive org name: take the first dot-separated segment (strips TLD)
    const orgName = host.split('.')[0];

    if (!orgName) return {};

    const url = `https://api.github.com/search/repositories?q=org:${encodeURIComponent(orgName)}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Utah-GOED-Startup-Map/1.0',
      },
    });

    // Silently return {} on rate limit or any non-success response
    if (!response.ok) return {};

    const json = await response.json();

    const repo_count = typeof json.total_count === 'number' ? json.total_count : 0;

    const items = Array.isArray(json.items) ? json.items : [];

    // Collect unique non-null language values from the first page of results
    const languageSet = new Set();
    let contributor_count = 0;

    for (const repo of items) {
      if (repo.language != null) {
        languageSet.add(repo.language);
      }
      // Sum stargazers_count as a proxy for contributor/popularity signal
      if (typeof repo.stargazers_count === 'number') {
        contributor_count += repo.stargazers_count;
      }
    }

    const languages = Array.from(languageSet);

    return { repo_count, languages, contributor_count };
  } catch (_err) {
    // Swallow all errors — never throw from an enricher
    return {};
  }
}
