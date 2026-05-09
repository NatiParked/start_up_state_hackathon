// Manages the list of Utah seed startups fetched from Supabase.
// Used by: MapView, EcosystemStatsBar, FilterSidebar, CompanyDrawer (in Feature 0002)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useFiltersStore } from '@/stores/filters'

export const useStartupsStore = defineStore('startups', () => {
  // state
  const companies = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const selectedCompany = ref(null)

  const filters = useFiltersStore()

  // getters
  const filteredCompanies = computed(() =>
    companies.value.filter(c => {
      // 0. searchQuery (name substring)
      const q = filters.searchQuery.trim()
      if (q) {
        if (!c.name) return false
        if (!c.name.toLowerCase().includes(q.toLowerCase())) return false
      }
      // 1. sectors
      if (filters.sectors.length > 0 && !filters.sectors.includes(c.sector)) return false
      // 2. stages
      if (filters.stages.length > 0 && !filters.stages.includes(c.stage)) return false
      // 3. employeeRanges
      if (filters.employeeRanges.length > 0 && !filters.employeeRanges.includes(c.employee_range)) return false
      // 4. isHiring (null or false = no filter; true = show hiring only)
      if (filters.isHiring === true && c.is_hiring !== true) return false
      // 5. foundedYearRange — only apply if both bounds are finite numbers
      if (Number.isFinite(c.founded_year)) {
        const [min, max] = filters.foundedYearRange
        if (Number.isFinite(min) && c.founded_year < min) return false
        if (Number.isFinite(max) && c.founded_year > max) return false
      }
      // 6. fundingStages
      if (filters.fundingStages.length > 0 && !filters.fundingStages.includes(c.funding_stage)) return false
      // 7. businessTypes
      if (filters.businessTypes.length > 0 && !filters.businessTypes.includes(c.business_type)) return false
      // 8. regions
      if (filters.regions.length > 0 && !filters.regions.includes(c.region)) return false
      // 9. investors (OR semantics — match if company has at least one selected investor)
      if (filters.investors.length > 0 && !filters.investors.some(i => (c.investors ?? []).includes(i))) return false
      return true
    })
  )

  // actions
  function selectCompany(id) {
    selectedCompany.value = companies.value.find(c => c.id === id) ?? null
  }

  function clearSelection() {
    selectedCompany.value = null
  }

  async function fetchAll() {
    isLoading.value = true
    error.value = null
    try {
      const { data, error: dbError } = await supabase
        .from('map_startups')
        .select('*')
      if (dbError) {
        error.value = dbError
        return
      }
      companies.value = data ?? []
    } catch (e) {
      error.value = e
    } finally {
      isLoading.value = false
    }
  }

  return { companies, isLoading, error, filteredCompanies, fetchAll, selectedCompany, selectCompany, clearSelection }
})
