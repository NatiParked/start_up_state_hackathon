<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import UtahMap from '@/components/map/UtahMap.vue'
import EcosystemStatsBar from '@/components/map/EcosystemStatsBar.vue'

const store = useStartupsStore()
const { companies } = storeToRefs(store)

onMounted(() => {
  if (companies.value.length === 0) {
    store.fetchAll()
  }
})
</script>

<template>
  <div class="flex flex-col h-screen w-screen">
    <EcosystemStatsBar />
    <!-- TODO: FilterSidebar (Phase 3) and CompanyDrawer (Phase 2) -->
    <UtahMap class="flex-1 min-h-0" />
  </div>
</template>

<style scoped></style>
