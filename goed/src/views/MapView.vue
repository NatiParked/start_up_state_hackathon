<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import UtahMap from '@/components/map/UtahMap.vue'
import EcosystemStatsBar from '@/components/map/EcosystemStatsBar.vue'
import CompanyDrawer from '@/components/drawer/CompanyDrawer.vue'

const store = useStartupsStore()
const { companies } = storeToRefs(store)
const { clearSelection } = store

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
  <div class="relative flex flex-col h-screen w-screen">
    <EcosystemStatsBar />
    <div @click="handleMapBackgroundClick" class="relative flex-1 min-h-0 z-10">
      <UtahMap class="w-full h-full" />
    </div>
    <CompanyDrawer />
  </div>
</template>

<style scoped></style>
