<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import gsap from 'gsap'
import { useStartupsStore } from '@/stores/startups'
import { useLogoDev } from '@/composables/useLogoDev'

const store = useStartupsStore()
const { selectedCompany } = storeToRefs(store)
const { clearSelection } = store

const { getLogoUrl } = useLogoDev()

const drawerEl = ref(null)

const isOpen = computed(() => selectedCompany.value !== null)
const company = computed(() => selectedCompany.value)
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

function handleClose() {
  clearSelection()
}

watch(isOpen, (open) => {
  if (!drawerEl.value) return
  if (open) {
    gsap.to(drawerEl.value, { x: 0, duration: 0.35, ease: 'power2.out' })
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
  <aside ref="drawerEl" class="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 overflow-y-auto">
    <div class="p-6">
      <button
        @click="handleClose"
        aria-label="Close"
        class="absolute top-4 right-4 text-2xl leading-none text-gray-500 hover:text-gray-800"
      >&times;</button>

      <div v-if="company">
        <div class="flex items-center gap-4 mb-4">
          <img
            v-if="showLogo"
            :src="logoUrl"
            :alt="company.name"
            class="w-16 h-16 rounded object-contain"
          />
          <div
            v-if="showMonogram"
            class="w-16 h-16 rounded bg-utah-blue text-white flex items-center justify-center text-2xl font-bold"
          >{{ monogram }}</div>

          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ company.name }}</h2>
            <div class="flex flex-wrap gap-2 mt-1">
              <span class="bg-utah-blue/10 text-utah-blue rounded-full px-2 py-1 text-xs">{{ sectorLabel }}</span>
              <span class="bg-gray-100 text-gray-700 rounded-full px-2 py-1 text-xs">{{ stageLabel }}</span>
              <span v-if="showHiringBadge" class="bg-hiring-green text-white rounded-full px-2 py-1 text-xs">Hiring now</span>
            </div>
          </div>
        </div>

        <p class="text-gray-700 text-sm leading-relaxed mb-4">{{ descriptionText }}</p>

        <section v-if="showJobsSection" class="mb-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-2">Open roles</h3>
          <ul class="space-y-1">
            <li
              v-for="title in jobTitlesPreview"
              :key="title"
              class="text-sm text-gray-700"
            >{{ title }}</li>
          </ul>
          <span v-if="showExtraJobs" class="text-xs text-utah-blue mt-1 block">+{{ extraJobsCount }} more</span>
        </section>

        <div class="flex gap-3 mb-4">
          <a
            v-if="showWebsite"
            :href="websiteHref"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-utah-blue underline hover:text-utah-blue-dark"
          >Website</a>
          <a
            v-if="showLinkedin"
            :href="linkedinHref"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-utah-blue underline hover:text-utah-blue-dark"
          >LinkedIn</a>
        </div>

        <section v-if="showInvestorsSection" class="mb-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-2">Investors</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="inv in investorsList"
              :key="inv"
              class="bg-gray-100 text-gray-700 rounded-full px-2 py-1 text-xs"
            >{{ inv }}</span>
          </div>
          <span v-if="showTotalRaised" class="text-xs text-gray-500 mt-2 block">{{ formattedTotalRaised }} total raised</span>
        </section>

        <p class="text-xs text-gray-400">{{ regionLabel }}</p>
      </div>
    </div>
  </aside>
</template>

<style scoped></style>
