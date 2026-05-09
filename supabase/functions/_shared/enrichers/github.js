/**
 * Shared enricher: GitHub public org search.
 */
export async function enrichFromGithub(domain) {
  try {
    if (!domain || typeof domain !== 'string') return {};
    const host = domain.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase().trim();
    if (!host) return {};
    const orgName = host.split('.')[0];
    if (!orgName) return {};
    const url = `https://api.github.com/search/repositories?q=org:${encodeURIComponent(orgName)}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Utah-GOED-Startup-Map/1.0' } });
    if (!response.ok) return {};
    const json = await response.json();
    const repo_count = typeof json.total_count === 'number' ? json.total_count : 0;
    const items = Array.isArray(json.items) ? json.items : [];
    const languageSet = new Set();
    let contributor_count = 0;
    for (const repo of items) {
      if (repo.language != null) languageSet.add(repo.language);
      if (typeof repo.stargazers_count === 'number') contributor_count += repo.stargazers_count;
    }
    return { repo_count, languages: Array.from(languageSet), contributor_count };
  } catch (_err) { return {}; }
}
