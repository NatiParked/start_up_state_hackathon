<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import { useStartupsStore } from '@/stores/startups'

const filtersStore = useFiltersStore()
const startupsStore = useStartupsStore()
const { companies } = storeToRefs(startupsStore)
const { foundedYearRange } = storeToRefs(filtersStore)

const yearBounds = computed(() => {
  const years = companies.value.map(c => c.founded_year).filter(Number.isFinite)
  if (years.length === 0) return { min: 2000, max: 2025 }
  return { min: Math.min(...years), max: Math.max(...years) }
})

const lowValue = computed({
  get: () => foundedYearRange.value[0] ?? yearBounds.value.min,
  set: (v) => {
    const num = Number(v)
    foundedYearRange.value = [num, foundedYearRange.value[1] ?? yearBounds.value.max]
  },
})

const highValue = computed({
  get: () => foundedYearRange.value[1] ?? yearBounds.value.max,
  set: (v) => {
    const num = Number(v)
    foundedYearRange.value = [foundedYearRange.value[0] ?? yearBounds.value.min, num]
  },
})

const rangeLabel = computed(() => `${lowValue.value} — ${highValue.value}`)

onMounted(() => {
  if (foundedYearRange.value[0] === null) {
    foundedYearRange.value = [yearBounds.value.min, yearBounds.value.max]
  }
})
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-[var(--fg)] mb-2">Founded Year</p>
    <div class="space-y-2">
      <div>
        <label class="text-sm text-[var(--fg-3)] block mb-1">From</label>
        <input
          v-model="lowValue"
          type="range"
          :min="yearBounds.min"
          :max="yearBounds.max"
          step="1"
          class="w-full accent-[var(--accent)]"
        />
      </div>
      <div>
        <label class="text-sm text-[var(--fg-3)] block mb-1">To</label>
        <input
          v-model="highValue"
          type="range"
          :min="yearBounds.min"
          :max="yearBounds.max"
          step="1"
          class="w-full accent-[var(--accent)]"
        />
      </div>
      <p class="text-sm text-[var(--fg)] font-medium">{{ rangeLabel }}</p>
    </div>
  </div>
</template>

<style scoped>
</style>
