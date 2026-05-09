// Manages active filter state for the Utah Startup Map sidebar.
// 9 filter dimensions, all client-side (the 96-row dataset is small enough).
// URL-sync wiring is stubbed and intentionally deferred to Feature 0002.
// Used by: FilterSidebar and individual *Filter components (in Feature 0002)
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFiltersStore = defineStore('filters', () => {
  // state — 9 filter dimensions + name search
  const sectors = ref([])
  const stages = ref([])
  const employeeRanges = ref([])
  const isHiring = ref(null)
  const foundedYearRange = ref([null, null])
  const fundingStages = ref([])
  const businessTypes = ref([])
  const regions = ref([])
  const investors = ref([])
  const searchQuery = ref('')

  // convention-required
  const isLoading = ref(false)
  const error = ref(null)

  // actions
  function clearAll() {
    sectors.value = []
    stages.value = []
    employeeRanges.value = []
    isHiring.value = null
    foundedYearRange.value = [null, null]
    fundingStages.value = []
    businessTypes.value = []
    regions.value = []
    investors.value = []
    searchQuery.value = ''
  }

  // TODO: wire URL query-string sync (push/replace on change, read on mount) — Feature 0002.
  function syncFromUrl() { /* stub */ }
  function syncToUrl() { /* stub */ }

  return {
    sectors,
    stages,
    employeeRanges,
    isHiring,
    foundedYearRange,
    fundingStages,
    businessTypes,
    regions,
    investors,
    searchQuery,
    isLoading,
    error,
    clearAll,
    syncFromUrl,
    syncToUrl,
  }
})
