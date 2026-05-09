<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true },
  icon: { type: String, required: true },
})

const statusBadgeClass = computed(() => {
  if (props.status === 'In Development') return 'bg-hiring-green text-white'
  if (props.status === 'Coming Soon') return 'bg-utah-blue text-white'
  return 'bg-warning-yellow text-utah-blue-dark'
})
</script>

<template>
  <article class="relative rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <div class="bg-utah-blue h-2 w-full" />
    <span
      class="absolute top-3 right-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      :class="statusBadgeClass"
    >
      {{ status }}
    </span>
    <div class="p-5 pt-6">
      <div class="text-3xl mb-3" aria-hidden="true">{{ icon }}</div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ title }}</h3>
      <p class="text-sm text-gray-600 leading-relaxed">{{ description }}</p>
    </div>
  </article>
</template>

<style scoped></style>
