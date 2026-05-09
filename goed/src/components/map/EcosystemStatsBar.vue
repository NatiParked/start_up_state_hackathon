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
    class="flex flex-nowrap items-center gap-x-5 whitespace-nowrap overflow-x-auto"
    @click.stop
  >
    <div class="flex items-baseline gap-1.5 shrink-0">
      <span class="font-display font-semibold text-[var(--fg)] tabular-nums" style="font-size: 22px; line-height: 1;">{{ totalCount }}</span>
      <span class="lbl">Companies</span>
    </div>
    <div class="flex items-baseline gap-1.5 shrink-0">
      <span class="font-display font-semibold text-[var(--fg)] tabular-nums" style="font-size: 22px; line-height: 1;">{{ hiringCount }}</span>
      <span class="lbl">Hiring</span>
    </div>
    <div class="flex items-baseline gap-1.5 shrink-0">
      <span class="font-display font-semibold text-[var(--fg)] tabular-nums" style="font-size: 22px; line-height: 1;">{{ withInvestorsCount }}</span>
      <span class="lbl">With Investors</span>
    </div>
    <div
      v-if="hasTopSectors"
      class="flex flex-nowrap items-baseline gap-x-4 pl-5 border-l shrink-0"
      style="border-color: var(--hair-2);"
    >
      <div
        v-for="sector in topSectorsDisplay"
        :key="sector.name"
        class="flex items-baseline gap-1.5"
      >
        <span class="font-semibold text-[var(--accent)]" style="font-size: 13px;">{{ sector.name }}</span>
        <span class="lbl">{{ sector.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
