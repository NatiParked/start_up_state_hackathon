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
    <div class="card card-pad flex items-center justify-between">
      <div>
        <div class="kicker">— Subscribers</div>
        <h1 class="display-sm mt-1 text-[var(--fg)]">Subscriber Stats</h1>
      </div>
      <button type="button" class="btn-text" @click="fetchStats">Refresh</button>
    </div>

    <!-- Error banner -->
    <div
      v-if="error"
      class="p-3 rounded-md text-sm"
      style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
    >
      {{ error }}
    </div>

    <!-- Three metric tiles -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card card-pad">
        <p class="lbl mb-2">Total confirmed subscribers</p>
        <div v-if="isLoading" class="h-7 w-24 rounded animate-pulse" style="background: var(--hair-2);" />
        <p v-else class="text-[var(--fg)]" style="font-family: var(--display); font-weight: 600; font-size: clamp(1.6rem, 2.6vw, 2.1rem); line-height: 1.05; letter-spacing: -0.02em;">{{ totalConfirmed }}</p>
      </div>
      <div class="card card-pad">
        <p class="lbl mb-2">Last digest sent</p>
        <div v-if="isLoading" class="h-7 w-24 rounded animate-pulse" style="background: var(--hair-2);" />
        <p v-else class="text-[var(--fg)]" style="font-family: var(--display); font-weight: 600; font-size: clamp(1rem, 1.4vw, 1.1rem); line-height: 1.2; letter-spacing: -0.01em;">{{ lastDigestDisplay }}</p>
      </div>
      <div class="card card-pad">
        <p class="lbl mb-2">Subscribers in last digest</p>
        <div v-if="isLoading" class="h-7 w-24 rounded animate-pulse" style="background: var(--hair-2);" />
        <p v-else class="text-[var(--fg)]" style="font-family: var(--display); font-weight: 600; font-size: clamp(1.6rem, 2.6vw, 2.1rem); line-height: 1.05; letter-spacing: -0.02em;">{{ lastDigestRun?.subscribers_sent ?? '—' }}</p>
      </div>
    </div>

    <!-- Breakdown tables -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="rounded-xl border overflow-hidden" style="background: var(--surface); border-color: var(--hair);">
        <div class="px-5 py-3 border-b" style="background: var(--surface-2); border-color: var(--hair);">
          <h2 class="kicker">By Sector</h2>
        </div>
        <table class="min-w-full text-sm">
          <tbody>
            <tr v-if="filterBreakdown.sectors.length === 0">
              <td class="px-5 py-2 text-[var(--fg-3)] italic" colspan="2">No data yet</td>
            </tr>
            <tr v-for="row in filterBreakdown.sectors" :key="row.label" class="border-t" style="border-color: var(--hair);">
              <td class="px-5 py-2 text-[var(--fg-2)]">{{ row.label }}</td>
              <td class="px-5 py-2 text-right text-[var(--fg-3)]" style="font-family: var(--mono);">{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-xl border overflow-hidden" style="background: var(--surface); border-color: var(--hair);">
        <div class="px-5 py-3 border-b" style="background: var(--surface-2); border-color: var(--hair);">
          <h2 class="kicker">By Stage</h2>
        </div>
        <table class="min-w-full text-sm">
          <tbody>
            <tr v-if="filterBreakdown.stages.length === 0">
              <td class="px-5 py-2 text-[var(--fg-3)] italic" colspan="2">No data yet</td>
            </tr>
            <tr v-for="row in filterBreakdown.stages" :key="row.label" class="border-t" style="border-color: var(--hair);">
              <td class="px-5 py-2 text-[var(--fg-2)]">{{ row.label }}</td>
              <td class="px-5 py-2 text-right text-[var(--fg-3)]" style="font-family: var(--mono);">{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer note -->
    <p class="text-xs text-[var(--fg-3)] italic">Counts include confirmed subscribers only. Updated on page load.</p>
  </div>
</template>

<style scoped></style>
