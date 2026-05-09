<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const totalConfirmed = ref(0)
const filterBreakdown = ref({ sectors: [], stages: [] })
const lastDigestRun = ref(null)
const isLoading = ref(true)
const error = ref(null)

async function fetchStats() {
  isLoading.value = true
  error.value = null
  try {
    const [countRes, rowsRes, digestRes] = await Promise.all([
      supabase
        .from('map_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('confirmed', true),
      supabase
        .from('map_subscriptions')
        .select('filter_criteria')
        .eq('confirmed', true),
      supabase
        .from('map_digest_runs')
        .select('run_at, subscribers_sent, errors')
        .order('run_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (countRes.error) throw countRes.error
    if (rowsRes.error) throw rowsRes.error
    if (digestRes.error) throw digestRes.error

    totalConfirmed.value = countRes.count ?? 0

    const sectorMap = new Map()
    const stageMap = new Map()
    for (const row of rowsRes.data ?? []) {
      const fc = row.filter_criteria ?? {}
      for (const s of fc.sectors ?? []) sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1)
      for (const st of fc.stages ?? []) stageMap.set(st, (stageMap.get(st) ?? 0) + 1)
    }
    const toSortedTop5 = (m) => [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    filterBreakdown.value = {
      sectors: toSortedTop5(sectorMap),
      stages: toSortedTop5(stageMap),
    }

    lastDigestRun.value = digestRes.data ?? null
  } catch (err) {
    error.value = err.message ?? 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

const lastDigestDisplay = computed(() => {
  const ts = lastDigestRun.value?.run_at
  return ts ? new Date(ts).toLocaleString() : 'Never'
})

onMounted(fetchStats)
</script>

<template>
  <div class="h-full overflow-y-auto p-6 space-y-6">
    <!-- Header card -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-900">Subscriber Stats</h1>
      <button
        type="button"
        class="text-xs text-utah-blue hover:underline"
        @click="fetchStats"
      >
        Refresh
      </button>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="p-3 bg-red-50 border border-error-red text-error-red text-sm rounded">{{ error }}</div>

    <!-- Three metric tiles -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total confirmed subscribers</p>
        <div v-if="isLoading" class="h-7 w-24 bg-gray-200 rounded animate-pulse" />
        <p v-else class="text-2xl font-bold text-gray-900">{{ totalConfirmed }}</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last digest sent</p>
        <div v-if="isLoading" class="h-7 w-24 bg-gray-200 rounded animate-pulse" />
        <p v-else class="text-2xl font-bold text-gray-900">{{ lastDigestDisplay }}</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subscribers in last digest</p>
        <div v-if="isLoading" class="h-7 w-24 bg-gray-200 rounded animate-pulse" />
        <p v-else class="text-2xl font-bold text-gray-900">{{ lastDigestRun?.subscribers_sent ?? '—' }}</p>
      </div>
    </div>

    <!-- Breakdown tables -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">By Sector</h2>
        </div>
        <table class="min-w-full divide-y divide-gray-100 text-sm">
          <tbody>
            <tr v-if="filterBreakdown.sectors.length === 0">
              <td class="px-5 py-2 text-gray-400 italic" colspan="2">No data yet</td>
            </tr>
            <tr v-for="row in filterBreakdown.sectors" :key="row.label">
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
            <tr v-if="filterBreakdown.stages.length === 0">
              <td class="px-5 py-2 text-gray-400 italic" colspan="2">No data yet</td>
            </tr>
            <tr v-for="row in filterBreakdown.stages" :key="row.label">
              <td class="px-5 py-2 text-gray-700">{{ row.label }}</td>
              <td class="px-5 py-2 text-right text-gray-400 font-mono">{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer note -->
    <p class="text-xs text-gray-400 italic">Counts include confirmed subscribers only. Updated on page load.</p>
  </div>
</template>

<style scoped></style>
