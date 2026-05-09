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

const topSectorsLabel = computed(() =>
  topSectors.value.map(s => s.name).join(' · ') || '—',
)
</script>

<template>
  <div class="flex items-center gap-8 bg-white border-b border-gray-200 px-6 py-3 shrink-0">
    <div class="text-center">
      <div class="text-2xl font-bold text-utah-blue">{{ totalCount }}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wide">Companies</div>
    </div>
    <div class="text-center">
      <div class="text-2xl font-bold text-utah-blue">{{ hiringCount }}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wide">Hiring</div>
    </div>
    <div class="text-center">
      <div class="text-sm font-semibold text-utah-blue">{{ topSectorsLabel }}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wide">Top Sectors</div>
    </div>
    <div class="text-center">
      <div class="text-2xl font-bold text-utah-blue">{{ withInvestorsCount }}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wide">With Investors</div>
    </div>
  </div>
</template>

<style scoped></style>
