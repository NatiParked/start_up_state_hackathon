<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import { useStartupsStore } from '@/stores/startups'

const filtersStore = useFiltersStore()
const startupsStore = useStartupsStore()
const { companies } = storeToRefs(startupsStore)
const { regions } = storeToRefs(filtersStore)

const regionOptions = computed(() =>
  [...new Set(companies.value.map(c => c.region).filter(Boolean))].sort()
)
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-gray-700 mb-2">Region</p>
    <div class="space-y-1">
      <label
        v-for="option in regionOptions"
        :key="option"
        class="flex items-center"
      >
        <input
          v-model="regions"
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
