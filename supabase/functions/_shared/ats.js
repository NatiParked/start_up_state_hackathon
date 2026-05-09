/**
 * Shared helper: ATS (Applicant Tracking System) detector.
 * Detects Greenhouse, Lever, and Ashby job boards from a careers URL,
 * fetches open job postings, and returns a normalized hiring record.
 *
 * Shared with Feature 0005 — do NOT move this file out of `_shared/`.
 * Usage: import { pollAts } from '../_shared/ats.js'
 */

/**
 * Extract the slug (first path segment after the host) from a URL string.
 *
 * @param {string} urlStr - a full URL, e.g. 'https://boards.greenhouse.io/acme/jobs/123'
 * @returns {string|null} first non-empty path segment, or null if none found
 */
function extractSlug(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length > 0 ? segments[0] : null;
  } catch (_) {
    return null;
  }
}

/**
 * Detect the ATS platform from a careers URL and return open job postings.
 *
 * Supported platforms:
 *  - Greenhouse (`greenhouse.io`)  → GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
 *  - Lever (`lever.co`)            → GET https://api.lever.co/v0/postings/{slug}?mode=json
 *  - Ashby (`ashbyhq.com`)         → GET https://api.ashbyhq.com/posting-api/job-board/{slug}
 *
 * The slug is extracted from the first path segment of the provided careers URL.
 *
 * @param {string|null|undefined} careersUrl - the company's careers page URL
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 *   Normalized hiring record, or null for:
 *   - null/empty input
 *   - unrecognized ATS host
 *   - network errors
 *   - non-2xx API responses
 * @throws never — all errors are caught internally and return null
 */
export async function pollAts(careersUrl) {
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

  try {
    if (host.includes('greenhouse.io')) {
      return await _pollGreenhouse(slug, careersUrl);
    }

    if (host.includes('lever.co')) {
      return await _pollLever(slug, careersUrl);
    }

    if (host.includes('ashbyhq.com')) {
      return await _pollAshby(slug, careersUrl);
    }

    // Unrecognized ATS host
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Poll the Greenhouse Jobs API for open postings.
 *
 * @param {string} slug - board slug extracted from the careers URL
 * @param {string} careersUrl - original careers URL (included in return value)
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 */
async function _pollGreenhouse(slug, careersUrl) {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

  let response;
  try {
    response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'goed-hackathon' },
    });
  } catch (_) {
    return null;
  }

  if (!response.ok) return null;

  let json;
  try {
    json = await response.json();
  } catch (_) {
    return null;
  }

  const jobs = Array.isArray(json.jobs) ? json.jobs : [];
  const job_titles = jobs.map((j) => j.title).filter(Boolean);

  return {
    job_titles,
    is_hiring: job_titles.length > 0,
    careers_url: careersUrl,
  };
}

/**
 * Poll the Lever Postings API for open postings.
 *
 * @param {string} slug - posting team slug extracted from the careers URL
 * @param {string} careersUrl - original careers URL (included in return value)
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 */
async function _pollLever(slug, careersUrl) {
  const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;

  let response;
  try {
    response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'goed-hackathon' },
    });
  } catch (_) {
    return null;
  }

  if (!response.ok) return null;

  let json;
  try {
    json = await response.json();
  } catch (_) {
    return null;
  }

  const postings = Array.isArray(json) ? json : [];
  const job_titles = postings.map((p) => p.text).filter(Boolean);

  return {
    job_titles,
    is_hiring: job_titles.length > 0,
    careers_url: careersUrl,
  };
}

/**
 * Poll the Ashby Job Board API for open postings.
 *
 * @param {string} slug - board slug extracted from the careers URL
 * @param {string} careersUrl - original careers URL (included in return value)
 * @returns {Promise<{job_titles: string[], is_hiring: boolean, careers_url: string}|null>}
 */
async function _pollAshby(slug, careersUrl) {
  const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;

  let response;
  try {
    response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'goed-hackathon',
        'Accept': 'application/json',
      },
    });
  } catch (_) {
    return null;
  }

  if (!response.ok) return null;

  let json;
  try {
    json = await response.json();
  } catch (_) {
    return null;
  }

  // Ashby response shape: { jobPostings: [...] } or { jobs: [...] }
  const postings = Array.isArray(json.jobPostings)
    ? json.jobPostings
    : Array.isArray(json.jobs)
    ? json.jobs
    : [];

  const job_titles = postings.map((p) => p.title).filter(Boolean);

  return {
    job_titles,
    is_hiring: job_titles.length > 0,
    careers_url: careersUrl,
  };
}
