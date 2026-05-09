<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import { useStartupsStore } from '@/stores/startups'

const filtersStore = useFiltersStore()
const startupsStore = useStartupsStore()
const { companies } = storeToRefs(startupsStore)
const { investors } = storeToRefs(filtersStore)

const investorOptions = computed(() =>
  [...new Set(companies.value.flatMap(c => c.investors ?? []))].sort()
)

const isLongList = computed(() => investorOptions.value.length > 15)
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-[var(--fg)] mb-2">Investors</p>
    <div
      :class="isLongList ? 'max-h-64 overflow-y-auto space-y-1' : 'space-y-1'"
    >
      <label
        v-for="option in investorOptions"
        :key="option"
        class="flex items-center"
      >
        <input
          v-model="investors"
          type="checkbox"
          :value="option"
          class="mr-2 rounded accent-[var(--accent)]"
        />
        <span class="text-sm text-[var(--fg-2)]">{{ option }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
</style>
