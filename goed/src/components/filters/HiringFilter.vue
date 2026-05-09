<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'

const filtersStore = useFiltersStore()
const { isHiring } = storeToRefs(filtersStore)

const hiringChecked = computed({
  get: () => isHiring.value === true,
  set: (v) => { isHiring.value = v ? true : null },
})
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-[var(--fg)] mb-2">Hiring</p>
    <div class="space-y-1">
      <label class="flex items-center">
        <input
          v-model="hiringChecked"
          type="checkbox"
          class="mr-2 rounded accent-[var(--accent)]"
        />
        <span class="text-sm text-[var(--fg-2)]">Hiring now only</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
</style>
