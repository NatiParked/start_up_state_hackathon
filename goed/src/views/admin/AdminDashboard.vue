<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const pendingCount = ref(null)
const totalCompanies = ref(null)
const hiringCount = ref(null)
const lastCronRun = ref(null)
const isLoading = ref(true)
const loadError = ref(null)

async function loadMetrics() {
  isLoading.value = true
  loadError.value = null
  try {
    const [pendingRes, totalRes, hiringRes, cronRes] = await Promise.all([
      supabase.from('map_startup_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('map_startups').select('*', { count: 'exact', head: true }),
      supabase.from('map_startups').select('*', { count: 'exact', head: true }).eq('is_hiring', true),
      supabase.from('map_refresh_log').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (pendingRes.error) throw pendingRes.error
    if (totalRes.error) throw totalRes.error
    if (hiringRes.error) throw hiringRes.error
    pendingCount.value = pendingRes.count ?? 0
    totalCompanies.value = totalRes.count ?? 0
    hiringCount.value = hiringRes.count ?? 0
    lastCronRun.value = cronRes.data?.created_at
      ? new Date(cronRes.data.created_at).toLocaleString()
      : 'Never'
  } catch (err) {
    loadError.value = err.message ?? 'Failed to load metrics'
  } finally {
    isLoading.value = false
  }
}

const metrics = computed(() => [
  { label: 'Pending Submissions', value: pendingCount.value, loading: isLoading.value, m9: false },
  { label: 'Total Companies', value: totalCompanies.value, loading: isLoading.value, m9: false },
  { label: 'Hiring Companies', value: hiringCount.value, loading: isLoading.value, m9: false },
  { label: 'Last Cron Run', value: lastCronRun.value, loading: isLoading.value, m9: false },
  { label: 'Subscribers', value: '0', loading: false, m9: true },
  { label: 'Last Digest Sent', value: '—', loading: false, m9: true },
])

onMounted(loadMetrics)
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="kicker">— Overview</div>
    <h1 class="display-sm mt-2 mb-6 text-[var(--fg)]">Dashboard</h1>

    <div
      v-if="loadError"
      class="mb-4 p-3 rounded-md text-sm"
      style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
    >
      {{ loadError }}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="card card-pad"
      >
        <p class="lbl mb-2">{{ metric.label }}</p>
        <div
          v-if="metric.loading"
          class="h-7 w-24 rounded animate-pulse"
          style="background: var(--hair-2);"
        />
        <p v-else class="num text-[var(--fg)]" style="font-family: var(--display); font-weight: 600; font-size: clamp(1.6rem, 2.6vw, 2.1rem); line-height: 1.05; letter-spacing: -0.02em;">{{ metric.value }}</p>
        <p v-if="metric.m9" class="mt-1 text-xs text-[var(--fg-3)]">Populates in M9</p>
      </div>
    </div>
  </div>
</template>
