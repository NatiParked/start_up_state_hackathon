<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import UtahMap from '@/components/map/UtahMap.vue'
import EcosystemStatsBar from '@/components/map/EcosystemStatsBar.vue'
import CompanyDrawer from '@/components/drawer/CompanyDrawer.vue'
import FilterSidebar from '@/components/filters/FilterSidebar.vue'

const store = useStartupsStore()
const { companies } = storeToRefs(store)
const { clearSelection } = store

const layoutClasses = computed(() => 'flex flex-col h-screen w-screen overflow-hidden bg-gray-50')
const mapZoneClasses = computed(() => 'flex flex-col flex-1 min-w-0 min-h-0 relative')

function handleMapBackgroundClick() {
  clearSelection()
}

onMounted(() => {
  if (companies.value.length === 0) {
    store.fetchAll()
  }
})
</script>

<template>
  <div :class="layoutClasses">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
      <span class="text-utah-blue-dark font-bold text-lg">Utah Startup Map</span>
    </header>
    <main class="flex flex-1 min-h-0 overflow-hidden">
      <FilterSidebar />
      <div :class="mapZoneClasses">
        <EcosystemStatsBar />
        <div class="relative flex-1 min-h-0" @click="handleMapBackgroundClick">
          <UtahMap class="w-full h-full" />
          <CompanyDrawer />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped></style>
