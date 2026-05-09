/**
 * Shared helper: ATS (Applicant Tracking System) detector.
 * Detects Greenhouse, Lever, and Ashby job boards from a careers URL,
 * fetches open job postings, and returns a normalized hiring record.
 *
 * Usage: import pollAts from '../_shared/ats.js'
 */

/**
 * Shared fetch wrapper: sets User-Agent, applies a 10-second AbortController
 * timeout, and returns null on any thrown error (network failure, abort, etc.).
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response|null>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'goed-startup-map',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract the slug (first non-empty path segment) from a URL string.
 *
 * @param {string} urlStr
 * @returns {string|null}
 */
function extractSlug(urlStr) {
  try {
    const segments = new URL(urlStr).pathname.split('/').filter(Boolean);
    return segments.length > 0 ? segments[0] : null;
  } catch (_) {
    return null;
  }
}

/**
 * Detect the ATS platform from a careers URL and return open job postings.
 *
 * Supported platforms:
 *  - Greenhouse (`greenhouse.io`)  → GET boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=false
 *  - Lever (`lever.co`)            → GET api.lever.co/v0/postings/{slug}?mode=json
 *  - Ashby (`ashbyhq.com`)         → POST jobs.ashbyhq.com/api/non-user-graphql (GraphQL)
 *
 * @param {string|null|undefined} careersUrl - the company's careers page URL
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 *   Normalized hiring record, or null for: null/undefined/empty/non-string input,
 *   invalid URL, unrecognized ATS host, network errors, non-2xx responses,
 *   or Ashby 401/403. This function never throws.
 */
export default async function pollAts(careersUrl) {
  if (!careersUrl || typeof careersUrl !== 'string' || careersUrl.trim() === '') {
    return null;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(careersUrl);
  } catch (_) {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const slug = extractSlug(careersUrl);
  if (!slug) return null;

  if (host.includes('greenhouse.io')) return _pollGreenhouse(slug, careersUrl);
  if (host.includes('lever.co')) return _pollLever(slug, careersUrl);
  if (host.includes('ashbyhq.com')) return _pollAshby(slug, careersUrl);

  return null;
}

/**
 * @param {string} slug
 * @param {string} careersUrl
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 */
async function _pollGreenhouse(slug, careersUrl) {
  const response = await fetchWithTimeout(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`,
  );
  if (!response || !response.ok) return null;

  let json;
  try { json = await response.json(); } catch (_) { return null; }

  const jobs = Array.isArray(json.jobs) ? json.jobs : [];
  const job_titles = jobs.map(j => j.title).filter(Boolean);
  return { job_titles, is_hiring: job_titles.length > 0, careers_url: careersUrl };
}

/**
 * @param {string} slug
 * @param {string} careersUrl
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 */
async function _pollLever(slug, careersUrl) {
  const response = await fetchWithTimeout(
    `https://api.lever.co/v0/postings/${slug}?mode=json`,
  );
  if (!response || !response.ok) return null;

  let json;
  try { json = await response.json(); } catch (_) { return null; }

  const postings = Array.isArray(json) ? json : [];
  const job_titles = postings.map(p => p.text).filter(Boolean);
  return { job_titles, is_hiring: job_titles.length > 0, careers_url: careersUrl };
}

/**
 * @param {string} slug
 * @param {string} careersUrl
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 */
async function _pollAshby(slug, careersUrl) {
  const response = await fetchWithTimeout('https://jobs.ashbyhq.com/api/non-user-graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operationName: 'ApiJobBoardWithTeams',
      variables: { organizationHostedJobsPageName: slug },
      query: '{ jobBoard { jobPostings { title } } }',
    }),
  });

  if (!response) return null;
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) return null;

  let json;
  try { json = await response.json(); } catch (_) { return null; }

  const postings = Array.isArray(json?.data?.jobBoard?.jobPostings)
    ? json.data.jobBoard.jobPostings
    : [];
  const job_titles = postings.map(p => p.title).filter(Boolean);
  return { job_titles, is_hiring: job_titles.length > 0, careers_url: careersUrl };
}
