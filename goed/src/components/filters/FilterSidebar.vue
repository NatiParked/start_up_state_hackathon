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
const { sectors, stages, employeeRanges, isHiring, foundedYearRange, fundingStages, businessTypes, regions, investors, searchQuery } = storeToRefs(filtersStore)

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
    :class="['flex-shrink-0 flex flex-col transition-all duration-200 overflow-y-auto rounded-xl border', sidebarClass]"
    style="background: rgba(13,25,45,0.78); backdrop-filter: blur(12px); border-color: var(--hair-2); box-shadow: 0 20px 40px -16px rgba(0,0,0,0.6);"
    @click.stop
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-3 border-b sticky top-0 z-10 rounded-t-xl" style="background: rgba(13,25,45,0.92); backdrop-filter: blur(12px); border-color: var(--hair-2);">
      <span v-if="bodyVisible" class="kicker">Filters</span>
      <button
        @click="isCollapsed = !isCollapsed"
        class="text-[var(--fg-2)] hover:text-[var(--accent)] text-xs px-1 py-1 rounded hover:bg-[var(--surface)]"
        :title="toggleLabel"
      >
        {{ isCollapsed ? '→' : '←' }}
      </button>
    </div>

    <!-- Name search -->
    <div v-if="bodyVisible" class="px-3 py-2 border-b sticky top-[49px] z-10" style="background: rgba(13,25,45,0.92); backdrop-filter: blur(12px); border-color: var(--hair-2);">
      <div class="flex items-center gap-1">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by name…"
          class="flex-1 text-xs px-2 py-1 rounded border focus:outline-none focus:border-[var(--accent)]"
          style="background: transparent; border-color: var(--hair-2); color: var(--fg);"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="text-[var(--fg-2)] hover:text-[var(--accent)] text-xs px-1 py-1 rounded hover:bg-[var(--surface)] flex-shrink-0"
          title="Clear search"
        >✕</button>
      </div>
    </div>

    <!-- Filter body -->
    <div v-if="bodyVisible" class="flex flex-col p-3 space-y-0">
      <div class="py-3 border-b" style="border-color: var(--hair-2);"><SectorFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair-2);"><StageFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair-2);"><EmployeeRangeFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair-2);"><HiringFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair-2);"><RegionFilter /></div>
      <div class="py-3 border-b" style="border-color: var(--hair-2);"><InvestorFilter /></div>
      <div class="py-3"><FoundedYearFilter /></div>
    </div>

    <!-- Clear all -->
    <div v-if="bodyVisible" class="p-3 border-t sticky bottom-0 rounded-b-xl" style="background: rgba(13,25,45,0.92); backdrop-filter: blur(12px); border-color: var(--hair-2);">
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
