<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useFiltersStore } from '@/stores/filters'
import SectorFilter from '@/components/filters/SectorFilter.vue'
import StageFilter from '@/components/filters/StageFilter.vue'
import EmployeeRangeFilter from '@/components/filters/EmployeeRangeFilter.vue'
import HiringFilter from '@/components/filters/HiringFilter.vue'
import RegionFilter from '@/components/filters/RegionFilter.vue'
import InvestorFilter from '@/components/filters/InvestorFilter.vue'
import FoundedYearFilter from '@/components/filters/FoundedYearFilter.vue'

const route = useRoute()
const router = useRouter()
const filtersStore = useFiltersStore()
const { sectors, stages, employeeRanges, isHiring, foundedYearRange, fundingStages, businessTypes, regions, investors } = storeToRefs(filtersStore)

const isCollapsed = ref(false)

const sidebarClass = computed(() =>
  isCollapsed.value
    ? 'w-12 overflow-hidden'
    : 'w-72'
)
const bodyVisible = computed(() => !isCollapsed.value)
const toggleLabel = computed(() => isCollapsed.value ? 'Expand' : 'Collapse')

function handleClearAll() {
  filtersStore.clearAll()
}

function buildQueryFromFilters() {
  const q = {}
  if (sectors.value.length) q.sectors = [...sectors.value]
  if (stages.value.length) q.stages = [...stages.value]
  if (employeeRanges.value.length) q.employeeRanges = [...employeeRanges.value]
  if (isHiring.value === true) q.isHiring = 'true'
  if (fundingStages.value.length) q.fundingStages = [...fundingStages.value]
  if (businessTypes.value.length) q.businessTypes = [...businessTypes.value]
  if (regions.value.length) q.regions = [...regions.value]
  if (investors.value.length) q.investors = [...investors.value]
  q.foundedYearMin = String(foundedYearRange.value[0] ?? '')
  q.foundedYearMax = String(foundedYearRange.value[1] ?? '')
  return q
}

function toArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function hydrateFromQuery() {
  const q = route.query
  sectors.value = toArray(q.sectors)
  stages.value = toArray(q.stages)
  employeeRanges.value = toArray(q.employeeRanges)
  isHiring.value = q.isHiring === 'true' ? true : null
  fundingStages.value = toArray(q.fundingStages)
  businessTypes.value = toArray(q.businessTypes)
  regions.value = toArray(q.regions)
  investors.value = toArray(q.investors)
  const min = Number(q.foundedYearMin)
  const max = Number(q.foundedYearMax)
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
    foundedYearRange.value = [min, max]
  }
}

let hydrating = true

onMounted(() => {
  hydrateFromQuery()
  setTimeout(() => { hydrating = false }, 0)
})

watch(
  [sectors, stages, employeeRanges, isHiring, foundedYearRange, fundingStages, businessTypes, regions, investors],
  () => {
    if (hydrating) return
    const newQuery = buildQueryFromFilters()
    if (JSON.stringify(newQuery) === JSON.stringify(route.query)) return
    router.push({ query: newQuery }).catch(() => {})
  },
  { deep: true },
)
</script>

<template>
  <aside
    :class="['flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 overflow-y-auto', sidebarClass]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-3 border-b border-gray-200 sticky top-0 bg-white z-10">
      <span v-if="bodyVisible" class="text-sm font-bold text-utah-blue">Filters</span>
      <button
        @click="isCollapsed = !isCollapsed"
        class="text-gray-500 hover:text-utah-blue text-xs px-1 py-1 rounded hover:bg-gray-100"
        :title="toggleLabel"
      >
        {{ isCollapsed ? '→' : '←' }}
      </button>
    </div>

    <!-- Filter body -->
    <div v-if="bodyVisible" class="flex flex-col divide-y divide-gray-100 p-3 space-y-0">
      <div class="py-3"><SectorFilter /></div>
      <div class="py-3"><StageFilter /></div>
      <div class="py-3"><EmployeeRangeFilter /></div>
      <div class="py-3"><HiringFilter /></div>
      <div class="py-3"><RegionFilter /></div>
      <div class="py-3"><InvestorFilter /></div>
      <div class="py-3"><FoundedYearFilter /></div>
    </div>

    <!-- Clear all -->
    <div v-if="bodyVisible" class="p-3 border-t border-gray-200 sticky bottom-0 bg-white">
      <button
        @click="handleClearAll"
        class="w-full text-sm text-center text-utah-blue hover:text-utah-blue-dark border border-utah-blue rounded px-3 py-1 hover:bg-blue-50"
      >
        Clear all
      </button>
    </div>
  </aside>
</template>

<style scoped></style>
