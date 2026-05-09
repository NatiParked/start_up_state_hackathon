// Provides logo URLs from logo.dev CDN with domain-level memoization.
// Used by: CompanyDrawer, startup card components
const logoCache = new Map()

/**
 * Composable for resolving company logo URLs via the logo.dev service.
 * Results are memoized per domain across all callers.
 *
 * @returns {{ getLogoUrl: function }}
 */
export function useLogoDev() {
  /**
   * Returns a logo.dev image URL for the given website, or null if unavailable.
   *
   * @param {string|null|undefined} websiteUrl - The company website URL.
   * @returns {string|null} A logo.dev image URL, or null.
   */
  function getLogoUrl(websiteUrl) {
    if (!websiteUrl || typeof websiteUrl !== 'string') return null

    let hostname
    try {
      hostname = new URL(websiteUrl).hostname
    } catch {
      try {
        hostname = new URL('https://' + websiteUrl).hostname
      } catch {
        return null
      }
    }

    const domain = hostname.replace(/^www\./, '').toLowerCase()

    if (logoCache.has(domain)) return logoCache.get(domain)

    const token = import.meta.env.VITE_LOGO_DEV_TOKEN
    if (!token) {
      logoCache.set(domain, null)
      return null
    }

    const url = `https://img.logo.dev/${domain}?token=${token}`
    logoCache.set(domain, url)
    return url
  }

  return { getLogoUrl }
}
