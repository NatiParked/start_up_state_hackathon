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
  <div
    class="inline-flex flex-nowrap items-center gap-x-6 px-4 py-3 rounded-xl border w-max max-w-[calc(100%-2rem)] overflow-x-auto whitespace-nowrap"
    style="background: rgba(13,25,45,0.78); backdrop-filter: blur(12px); border-color: var(--hair-2); box-shadow: 0 20px 40px -16px rgba(0,0,0,0.6);"
    @click.stop
  >
    <div class="metric text-center">
      <div class="num">{{ totalCount }}</div>
      <div class="lbl">Companies</div>
    </div>
    <div class="metric text-center">
      <div class="num">{{ hiringCount }}</div>
      <div class="lbl">Hiring</div>
    </div>
    <div class="metric text-center">
      <div class="num">{{ withInvestorsCount }}</div>
      <div class="lbl">With Investors</div>
    </div>
    <div v-if="hasTopSectors" class="flex flex-nowrap gap-x-6 items-end">
      <div
        v-for="sector in topSectorsDisplay"
        :key="sector.name"
        class="text-center"
      >
        <div class="text-sm font-semibold text-[var(--accent)]">{{ sector.name }}</div>
        <div class="lbl">{{ sector.count }} co.</div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
