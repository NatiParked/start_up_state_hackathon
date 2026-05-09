/**
 * Shared helper: logo.dev image URL builder.
 * Usage: import { fetchLogo, normalizeDomain } from '../_shared/logo-dev.js'
 *
 * NOTE: fetchLogo does NOT make an HTTP request — it returns a URL string
 * for the browser/client to resolve directly against img.logo.dev.
 */

/**
 * Strip protocol, www, path, port, and lowercase a URL to obtain a bare domain.
 *
 * @param {string} url - e.g. 'https://www.zonos.com/pricing' or 'http://Example.COM/'
 * @returns {string|null} bare domain e.g. 'zonos.com', or null if input is falsy or unparseable
 */
export function normalizeDomain(url) {
  if (!url) return null;
  try {
    let s = String(url).trim();
    // Strip protocol
    s = s.replace(/^https?:\/\//i, '');
    // Strip leading www.
    s = s.replace(/^www\./i, '');
    // Strip path and query (everything from the first / onward)
    s = s.split('/')[0];
    // Strip trailing :port
    s = s.split(':')[0];
    // Lowercase
    s = s.toLowerCase();
    if (!s) return null;
    return s;
  } catch (_) {
    return null;
  }
}

/**
 * Build a logo.dev image URL for a company website URL.
 * Reads LOGO_DEV_TOKEN from Deno.env; returns null if the token is absent
 * or the domain cannot be parsed. Does NOT make an HTTP request.
 *
 * @param {string} url - company website URL e.g. 'https://www.zonos.com/pricing'
 * @returns {string|null} logo.dev image URL e.g.
 *   'https://img.logo.dev/zonos.com?token=abc&size=128', or null
 */
export function fetchLogo(url) {
  const token = Deno.env.get('LOGO_DEV_TOKEN');
  if (!token) return null;

  const domain = normalizeDomain(url);
  if (!domain) return null;

  return `https://img.logo.dev/${domain}?token=${token}&size=128`;
}
