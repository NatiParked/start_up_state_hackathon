<script setup>
const sectorBreakdown = [
  { label: 'AI / ML', count: '—' },
  { label: 'Climate', count: '—' },
  { label: 'FinTech', count: '—' },
]
const stageBreakdown = [
  { label: 'Pre-Seed', count: '—' },
  { label: 'Seed', count: '—' },
  { label: 'Series A+', count: '—' },
]
</script>

<template>
<div class="p-6 space-y-6">
  <!-- Header card with M9 badge -->
  <div class="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between">
    <h1 class="text-xl font-semibold text-gray-900">Subscriber Stats</h1>
    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-yellow text-utah-blue-dark">
      Populates in M9
    </span>
  </div>

  <!-- Three metric tiles -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total confirmed subscribers</p>
      <p class="text-2xl font-bold text-gray-900">0</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last digest sent</p>
      <p class="text-2xl font-bold text-gray-900">Never</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active filter saved searches</p>
      <p class="text-2xl font-bold text-gray-900">0</p>
    </div>
  </div>

  <!-- Breakdown table -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">By Sector</h2>
      </div>
      <table class="min-w-full divide-y divide-gray-100 text-sm">
        <tbody>
          <tr v-for="row in sectorBreakdown" :key="row.label">
            <td class="px-5 py-2 text-gray-700">{{ row.label }}</td>
            <td class="px-5 py-2 text-right text-gray-400 font-mono">{{ row.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">By Stage</h2>
      </div>
      <table class="min-w-full divide-y divide-gray-100 text-sm">
        <tbody>
          <tr v-for="row in stageBreakdown" :key="row.label">
            <td class="px-5 py-2 text-gray-700">{{ row.label }}</td>
            <td class="px-5 py-2 text-right text-gray-400 font-mono">{{ row.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Inline note -->
  <p class="text-xs text-gray-400 italic">
    This panel is a UI shell. M9 (Notifications) populates the live data.
  </p>
</div>
</template>

<style scoped></style>
