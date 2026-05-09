<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import { useStartupsStore } from '@/stores/startups'

const filtersStore = useFiltersStore()
const startupsStore = useStartupsStore()
const { companies } = storeToRefs(startupsStore)
const { employeeRanges } = storeToRefs(filtersStore)

function parseLowerBound(rangeStr) {
  const match = String(rangeStr).match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

const employeeRangeOptions = computed(() => {
  const unique = [...new Set(companies.value.map(c => c.employee_range).filter(Boolean))]
  return unique.sort((a, b) => {
    const numA = parseLowerBound(a)
    const numB = parseLowerBound(b)
    if (numA !== null && numB !== null) return numA - numB
    return String(a).localeCompare(String(b))
  })
})
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-gray-700 mb-2">Company Size</p>
    <div class="space-y-1">
      <label
        v-for="option in employeeRangeOptions"
        :key="option"
        class="flex items-center"
      >
        <input
          v-model="employeeRanges"
          type="checkbox"
          :value="option"
          class="mr-2 rounded border-gray-300 text-utah-blue focus:ring-utah-blue"
        />
        <span class="text-sm text-gray-700">{{ option }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
</style>
