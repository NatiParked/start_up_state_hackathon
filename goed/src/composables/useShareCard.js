// Builds a shareable deep-link URL + OG/Twitter meta tags for a company record.
// Consumers: CompanyDrawer.vue
import { computed, watch, onUnmounted, toValue } from 'vue'

/** Six meta tags managed by this composable (property= for OG, name= for Twitter). */
const META_KEYS = [
  { kind: 'property', key: 'og:image' },
  { kind: 'property', key: 'og:title' },
  { kind: 'property', key: 'og:description' },
  { kind: 'name', key: 'twitter:card' },
  { kind: 'name', key: 'twitter:image' },
  { kind: 'name', key: 'twitter:title' },
]

/**
 * Upserts a single meta tag in document.head.
 * Tags created here are marked with dataset.useShareCard so cleanup never
 * removes tags placed by index.html or another composable.
 *
 * @param {'property'|'name'} kind - The attribute type of the meta tag.
 * @param {string} key - The attribute value (e.g. 'og:image').
 * @param {string} content - The content attribute value.
 */
function upsertMeta(kind, key, content) {
  let el = document.head.querySelector(`meta[${kind}="${key}"]`)
  if (el) {
    el.setAttribute('content', content)
  } else {
    el = document.createElement('meta')
    el.setAttribute(kind, key)
    el.setAttribute('content', content)
    el.dataset.useShareCard = 'true'
    document.head.appendChild(el)
  }
}

/**
 * Removes all meta tags that were created by this composable instance.
 * Only removes tags whose dataset.useShareCard === 'true'; never removes
 * tags placed by index.html or other composables.
 */
function removeManagedTags() {
  META_KEYS.forEach(({ kind, key }) => {
    const el = document.head.querySelector(`meta[${kind}="${key}"]`)
    if (el && el.dataset.useShareCard === 'true') {
      el.remove()
    }
  })
}

/**
 * Composable that builds a shareable URL and upserts OG/Twitter meta tags
 * for the given company. Tags are updated on company change and cleaned up
 * when the company is cleared or the consuming component unmounts.
 *
 * @param {object|import('vue').Ref<object>} company - A company record or a Ref to one.
 * @returns {{ shareUrl: import('vue').Ref<string>, ogImageUrl: import('vue').Ref<string>, copyLink: function(): Promise<boolean> }}
 */
export function useShareCard(company) {
  const shareUrl = computed(() => {
    const c = toValue(company)
    const id = c?.id
    if (!id) return window.location.origin + '/'
    return `${window.location.origin}/?company=${id}`
  })

  const ogImageUrl = computed(() => {
    const c = toValue(company)
    const id = c?.id
    if (!id) return ''
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image/og/${id}.png`
  })

  watch(
    () => toValue(company)?.id,
    (id) => {
      if (!id) {
        removeManagedTags()
        return
      }
      const c = toValue(company)
      const name = c?.name
      const description = c?.description

      const title = name ? `${name} — Utah Startup Map` : 'Utah Startup Map'
      const desc = description
        ? description.slice(0, 200)
        : 'Discover Utah startups on the Utah Startup Map.'
      const img = ogImageUrl.value

      upsertMeta('property', 'og:image', img)
      upsertMeta('property', 'og:title', title)
      upsertMeta('property', 'og:description', desc)
      upsertMeta('name', 'twitter:card', 'summary_large_image')
      upsertMeta('name', 'twitter:image', img)
      upsertMeta('name', 'twitter:title', title)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    removeManagedTags()
  })

  /**
   * Copies the share URL to the system clipboard.
   * Returns true on success, false if clipboard is unavailable or the write fails.
   * Never throws.
   *
   * @returns {Promise<boolean>}
   */
  async function copyLink() {
    if (!navigator.clipboard) return false
    try {
      await navigator.clipboard.writeText(shareUrl.value)
      return true
    } catch {
      return false
    }
  }

  return { shareUrl, ogImageUrl, copyLink }
}
