<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'

const { filteredCompanies } = storeToRefs(useStartupsStore())

const totalCount = computed(() => filteredCompanies.value.length)

const hiringCount = computed(() =>
  filteredCompanies.value.filter(c => c.is_hiring).length,
)

const topSectors = computed(() => {
  const sectorCounts = new Map()
  for (const c of filteredCompanies.value) {
    if (!c.sector) continue
    sectorCounts.set(c.sector, (sectorCounts.get(c.sector) ?? 0) + 1)
  }
  return [...sectorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))
})

const withInvestorsCount = computed(() =>
  filteredCompanies.value.filter(c => {
    if (Array.isArray(c.investors)) return c.investors.length > 0
    if (typeof c.investors === 'string') return c.investors.trim().length > 0
    return false
  }).length,
)

const topSectorsDisplay = computed(() =>
  topSectors.value.length > 0 ? topSectors.value : [],
)

const hasTopSectors = computed(() => topSectorsDisplay.value.length > 0)
</script>

<template>
  <div class="bg-white border-b border-gray-200 px-6 py-3 shrink-0 flex flex-wrap items-center gap-x-8 gap-y-2">
    <div class="text-center">
      <div class="text-3xl font-bold text-utah-blue-dark">{{ totalCount }}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500">Companies</div>
    </div>
    <div class="text-center">
      <div class="text-3xl font-bold text-utah-blue-dark">{{ hiringCount }}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500">Hiring</div>
    </div>
    <div class="text-center">
      <div class="text-3xl font-bold text-utah-blue-dark">{{ withInvestorsCount }}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500">With Investors</div>
    </div>
    <div v-if="hasTopSectors" class="flex flex-wrap gap-x-6 gap-y-2 items-end">
      <div
        v-for="sector in topSectorsDisplay"
        :key="sector.name"
        class="text-center"
      >
        <div class="text-sm font-semibold text-utah-blue">{{ sector.name }}</div>
        <div class="text-xs uppercase tracking-wide text-gray-500">{{ sector.count }} co.</div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
