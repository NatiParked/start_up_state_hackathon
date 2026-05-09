<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import gsap from 'gsap'
import { useStartupsStore } from '@/stores/startups'
import { useLogoDev } from '@/composables/useLogoDev'
import { useShareCard } from '@/composables/useShareCard'
import { supabase } from '@/lib/supabase'

const store = useStartupsStore()
const { selectedCompany } = storeToRefs(store)
const { clearSelection } = store

const { getLogoUrl } = useLogoDev()

const drawerEl = ref(null)

const isOpen = computed(() => selectedCompany.value !== null)
const company = computed(() => selectedCompany.value)

const { copyLink } = useShareCard(company)
const copiedAt = ref(0)
const showCopied = computed(() => copiedAt.value > 0)

async function handleShareClick() {
  const ok = await copyLink()
  if (!ok) return
  copiedAt.value = Date.now()
  setTimeout(() => { copiedAt.value = 0 }, 2000)
}
const logoUrl = computed(() => company.value?.website ? getLogoUrl(company.value.website) : null)
const monogram = computed(() => company.value?.name ? company.value.name[0].toUpperCase() : '')
const showMonogram = computed(() => !logoUrl.value && Boolean(company.value?.name))
const showLogo = computed(() => Boolean(logoUrl.value))
const sectorLabel = computed(() => company.value?.sector ?? '')
const stageLabel = computed(() => company.value?.stage ?? '')
const regionLabel = computed(() => company.value?.region ?? 'Utah')
const descriptionText = computed(() => company.value?.description ?? '')
const showHiringBadge = computed(() => company.value?.is_hiring === true)
const jobTitlesPreview = computed(() => (company.value?.job_titles ?? []).slice(0, 3))
const extraJobsCount = computed(() => Math.max(0, (company.value?.job_titles?.length ?? 0) - 3))
const showExtraJobs = computed(() => extraJobsCount.value > 0)
const showJobsSection = computed(() => showHiringBadge.value && (company.value?.job_titles?.length ?? 0) > 0)
const investorsList = computed(() => company.value?.investors ?? [])
const showInvestorsSection = computed(() => investorsList.value.length > 0)
const formattedTotalRaised = computed(() => {
  if (typeof company.value?.total_raised === 'number') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(company.value.total_raised)
  }
  return ''
})
const showTotalRaised = computed(() => Boolean(company.value?.total_raised))
const websiteHref = computed(() => company.value?.website ?? null)
const linkedinHref = computed(() => company.value?.linkedin ?? null)
const showWebsite = computed(() => Boolean(websiteHref.value))
const showLinkedin = computed(() => Boolean(linkedinHref.value))

const sessionEmail = ref(null)
supabase.auth.getSession().then(({ data }) => {
  sessionEmail.value = data.session?.user?.email ?? null
})
supabase.auth.onAuthStateChange((_, session) => {
  sessionEmail.value = session?.user?.email ?? null
})

const isOwner = ref(false)
watch([company, sessionEmail], async ([c, email]) => {
  isOwner.value = false
  if (!c?.id || !email) return
  const { data } = await supabase
    .from('company_claims')
    .select('claimer_email')
    .eq('startup_id', c.id)
    .eq('claimer_email', email)
    .maybeSingle()
  isOwner.value = !!data
}, { immediate: true })

function getOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem('goed_session_id')
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem('goed_session_id', fresh)
    return fresh
  } catch {
    // Safari private mode / SSR fallback — return a one-shot UUID; not persisted, but tracking still works for the lifetime of this tab.
    return crypto.randomUUID()
  }
}

function handleClose() {
  clearSelection()
}

watch(isOpen, (open) => {
  if (!drawerEl.value) return
  if (open) {
    gsap.to(drawerEl.value, { x: 0, duration: 0.35, ease: 'power2.out' })
    const id = company.value?.id
    if (id) {
      const session_id = getOrCreateSessionId()
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-view`
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify({ startup_id: id, session_id }),
        keepalive: true,
      }).catch(() => {})
    }
  } else {
    gsap.to(drawerEl.value, { x: '100%', duration: 0.35, ease: 'power2.out' })
  }
})

onMounted(() => {
  if (drawerEl.value) {
    gsap.set(drawerEl.value, { x: '100%' })
  }
})
</script>

<template>
  <aside ref="drawerEl" class="fixed top-0 right-0 h-full w-full max-w-md z-40 overflow-y-auto" style="background: var(--bg-2); border-left: 1px solid var(--hair); box-shadow: -30px 0 60px -20px rgba(0,0,0,0.6);">
    <div class="p-6">
      <div v-if="company" class="absolute top-4 right-12 flex items-center gap-2">
        <button
          @click="handleShareClick"
          type="button"
          aria-label="Copy share link"
          class="px-3 py-1 text-sm rounded bg-utah-blue text-white hover:opacity-90 transition-colors"
        >Share</button>
        <span
          v-if="showCopied"
          role="status"
          class="px-2 py-1 text-xs rounded bg-utah-blue text-white"
        >Copied!</span>
      </div>
      <button
        @click="handleClose"
        aria-label="Close"
        class="absolute top-4 right-4 text-2xl leading-none text-[var(--fg-2)] hover:text-[var(--fg)]"
      >&times;</button>

      <div v-if="company">
        <div class="flex items-center gap-4 mb-4">
          <img
            v-if="showLogo"
            :src="logoUrl"
            :alt="company.name"
            class="w-16 h-16 rounded object-contain"
            style="background: var(--surface);"
          />
          <div
            v-if="showMonogram"
            class="w-16 h-16 rounded bg-[var(--accent)] text-[#07140A] flex items-center justify-center text-2xl font-bold"
          >{{ monogram }}</div>

          <div>
            <h2 class="display-sm text-[var(--fg)]">{{ company.name }}</h2>
            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge-cat accent">{{ sectorLabel }}</span>
              <span class="badge-cat outline">{{ stageLabel }}</span>
              <span v-if="showHiringBadge" class="chip-soft">Hiring now</span>
            </div>
          </div>
        </div>

        <p class="text-[var(--fg-2)] text-sm leading-relaxed mb-4">{{ descriptionText }}</p>

        <section v-if="showJobsSection" class="mb-4">
          <h3 class="kicker mb-2">Open roles</h3>
          <ul class="space-y-1">
            <li
              v-for="title in jobTitlesPreview"
              :key="title"
              class="text-sm text-[var(--fg)]"
            >{{ title }}</li>
          </ul>
          <span v-if="showExtraJobs" class="text-xs text-[var(--accent)] mt-1 block">+{{ extraJobsCount }} more</span>
        </section>

        <div class="flex gap-3 mb-4">
          <a
            v-if="showWebsite"
            :href="websiteHref"
            target="_blank"
            rel="noopener noreferrer"
            class="link-storm text-sm"
          >Website</a>
          <a
            v-if="showLinkedin"
            :href="linkedinHref"
            target="_blank"
            rel="noopener noreferrer"
            class="link-storm text-sm"
          >LinkedIn</a>
        </div>

        <section v-if="showInvestorsSection" class="mb-4">
          <h3 class="kicker mb-2">Investors</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="inv in investorsList"
              :key="inv"
              class="badge-cat outline"
            >{{ inv }}</span>
          </div>
          <span v-if="showTotalRaised" class="text-xs text-[var(--fg-3)] mt-2 block">{{ formattedTotalRaised }} total raised</span>
        </section>

        <p class="county-tag inline-block">{{ regionLabel }}</p>
        <router-link
          v-if="isOwner"
          :to="{ name: 'CompanyEdit', params: { id: company.id } }"
          class="btn btn-ghost mt-6 inline-block"
        >Edit your listing</router-link>
        <router-link
          v-else
          :to="{ name: 'ClaimLogin', params: { id: company.id } }"
          class="btn btn-ghost mt-6 inline-block"
        >Claim your listing</router-link>
      </div>
    </div>
  </aside>
</template>

<style scoped></style>
