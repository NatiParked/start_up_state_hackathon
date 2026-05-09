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
  const minVal = foundedYearRange.value[0]
  const maxVal = foundedYearRange.value[1]
  if (minVal != null && minVal !== '') q.foundedYearMin = String(minVal)
  if (maxVal != null && maxVal !== '') q.foundedYearMax = String(maxVal)
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
    :class="['flex-shrink-0 border-r flex flex-col transition-all duration-200', sidebarClass]"
    style="background: var(--bg-2); border-color: var(--hair);"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-3 border-b shrink-0" style="background: var(--bg-2); border-color: var(--hair);">
      <span v-if="bodyVisible" class="kicker">Filters</span>
      <button
        @click="isCollapsed = !isCollapsed"
        class="text-[var(--fg-2)] hover:text-[var(--accent)] text-xs px-1 py-1 rounded hover:bg-[var(--surface)]"
        :title="toggleLabel"
      >
        {{ isCollapsed ? '→' : '←' }}
      </button>
    </div>

    <!-- Filter body: only this region scrolls -->
    <div v-if="bodyVisible" class="flex-1 overflow-y-auto min-h-0 flex flex-col p-3 space-y-0" style="--divide-color: var(--hair);">
      <div class="py-3 border-b" style="border-color: var(--hair);"><SectorFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair);"><StageFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair);"><EmployeeRangeFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair);"><HiringFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair);"><RegionFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair);"><InvestorFilter /></div>
      <div class="py-3"><FoundedYearFilter /></div>
    </div>

    <!-- Clear all: always visible at bottom -->
    <div v-if="bodyVisible" class="p-3 border-t shrink-0" style="background: var(--bg-2); border-color: var(--hair);">
      <button
        @click="handleClearAll"
        class="btn btn-ghost w-full justify-center"
      >
        Clear all
      </button>
    </div>
  </aside>
</template>

<style scoped></style>
