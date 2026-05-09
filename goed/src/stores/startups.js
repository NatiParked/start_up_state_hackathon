// Manages the list of Utah seed startups fetched from Supabase.
// Used by: MapView, EcosystemStatsBar, FilterSidebar, CompanyDrawer (in Feature 0002)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useStartupsStore = defineStore('startups', () => {
  // state
  const companies = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  // getters
  const filteredCompanies = computed(() => companies.value)

  // actions
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

  return { companies, isLoading, error, filteredCompanies, fetchAll }
})
