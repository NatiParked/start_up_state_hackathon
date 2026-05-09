<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import { supabase } from '@/lib/supabase'

const store = useStartupsStore()
const { companies, isLoading } = storeToRefs(store)

const activeTab = ref('companies')
const isBulkRefreshing = ref(false)
const bulkResultMessage = ref(null)
const bulkResultIsError = ref(false)
const searchQuery = ref('')
const perRowRefreshing = ref(new Set())
const logEntries = ref([])
const logError = ref(null)
const logIntervalId = ref(null)

const filteredCompanies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return companies.value
  return companies.value.filter(c => (c.name ?? '').toLowerCase().includes(q))
})

const startupNameById = computed(() => Object.fromEntries(companies.value.map(c => [c.id, c.name])))

async function loadLogs() {
  const { data, error: dbError } = await supabase
    .from('map_refresh_log')
    .select('id, created_at, status, message, startup_id')
    .order('created_at', { ascending: false })
    .limit(20)
  if (dbError) {
    logError.value = dbError
  } else {
    logEntries.value = data ?? []
    logError.value = null
  }
}

async function handleRefreshAll() {
  isBulkRefreshing.value = true
  bulkResultMessage.value = null
  bulkResultIsError.value = false
  try {
    const { data, error } = await supabase.functions.invoke('refresh-jobs', { body: {} })
    if (error) {
      bulkResultMessage.value = error.message ?? 'Refresh failed.'
      bulkResultIsError.value = true
    } else {
      bulkResultMessage.value = data?.message ?? 'Refresh queued.'
      bulkResultIsError.value = false
    }
  } finally {
    isBulkRefreshing.value = false
    loadLogs()
  }
}

async function handleRefreshOne(startupId) {
  perRowRefreshing.value = new Set([...perRowRefreshing.value, startupId])
  try {
    const { error } = await supabase.functions.invoke('refresh-jobs', { body: { startup_id: startupId } })
    if (!error) {
      await store.fetchAll()
    }
  } finally {
    const next = new Set(perRowRefreshing.value)
    next.delete(startupId)
    perRowRefreshing.value = next
    loadLogs()
  }
}

onMounted(async () => {
  if (companies.value.length === 0) await store.fetchAll()
  await loadLogs()
  logIntervalId.value = window.setInterval(loadLogs, 5000)
})

onUnmounted(() => {
  if (logIntervalId.value !== null) {
    clearInterval(logIntervalId.value)
    logIntervalId.value = null
  }
})
</script>

<template>
  <div class="h-full flex flex-col p-6 gap-6">
    <h1 class="shrink-0 text-xl font-semibold text-gray-900">Refresh Control</h1>

    <!-- Section 1: Bulk Refresh -->
    <section class="shrink-0 bg-white rounded-lg border border-gray-200 p-5">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Bulk Refresh</h2>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-utah-blue text-white text-sm font-semibold hover:bg-utah-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="isBulkRefreshing"
        @click="handleRefreshAll"
      >
        <span v-if="isBulkRefreshing" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        {{ isBulkRefreshing ? 'Refreshing…' : 'Refresh All' }}
      </button>
      <p
        v-if="bulkResultMessage"
        class="mt-3 text-sm"
        :class="bulkResultIsError ? 'text-error-red' : 'text-hiring-green'"
      >
        {{ bulkResultMessage }}
      </p>
    </section>

    <!-- Tab strip -->
    <div class="shrink-0 flex gap-1 p-1 bg-gray-100 rounded-md w-fit">
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded transition-colors"
        :class="activeTab === 'companies' ? 'bg-utah-blue text-white' : 'text-gray-600 hover:bg-gray-200'"
        @click="activeTab = 'companies'"
      >
        Companies
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded transition-colors"
        :class="activeTab === 'log' ? 'bg-utah-blue text-white' : 'text-gray-600 hover:bg-gray-200'"
        @click="activeTab = 'log'"
      >
        Refresh Log
      </button>
    </div>

    <!-- Active tab panel -->
    <section class="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200">
      <!-- Companies tab -->
      <template v-if="activeTab === 'companies'">
        <div class="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Companies</h2>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name..."
            class="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-utah-blue"
          />
        </div>
        <div v-if="isLoading" class="flex-1 py-8 text-center text-gray-500 text-sm">Loading…</div>
        <div v-else class="flex-1 min-h-0 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
                <th class="px-4 py-2 text-left font-semibold text-gray-600">Last Refreshed</th>
                <th class="px-4 py-2 text-left font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="row in filteredCompanies" :key="row.id">
                <td class="px-4 py-2 font-medium text-gray-900">{{ row.name }}</td>
                <td class="px-4 py-2 text-gray-500">
                  {{ row.last_refreshed_at ? new Date(row.last_refreshed_at).toLocaleString() : '—' }}
                </td>
                <td class="px-4 py-2">
                  <button
                    class="px-3 py-1 text-xs font-medium rounded bg-utah-blue text-white hover:bg-utah-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="perRowRefreshing.has(row.id)"
                    @click="handleRefreshOne(row.id)"
                  >
                    {{ perRowRefreshing.has(row.id) ? 'Refreshing…' : 'Refresh' }}
                  </button>
                </td>
              </tr>
              <tr v-if="filteredCompanies.length === 0">
                <td colspan="3" class="px-4 py-6 text-center text-gray-400">No companies match.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Log tab -->
      <template v-else>
        <div class="shrink-0 px-5 py-3 border-b border-gray-200">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Refresh Log (last 20, polled every 5s)</h2>
          <div v-if="logError" class="mt-2 text-error-red text-sm">Failed to load log: {{ logError.message ?? logError }}</div>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 text-xs">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Time</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Startup</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Message</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-mono">
              <tr v-for="entry in logEntries" :key="entry.id">
                <td class="px-3 py-2 text-gray-500 whitespace-nowrap">{{ new Date(entry.created_at).toLocaleTimeString() }}</td>
                <td class="px-3 py-2 text-gray-700">{{ startupNameById[entry.startup_id] ?? '—' }}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    :class="{
                      'bg-hiring-green text-white': entry.status === 'success',
                      'bg-error-red text-white': entry.status === 'error',
                      'bg-warning-yellow text-utah-blue-dark': entry.status !== 'success' && entry.status !== 'error',
                    }"
                  >
                    {{ entry.status ?? '—' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-gray-600 truncate max-w-md">{{ (entry.message ?? '').slice(0, 200) }}</td>
              </tr>
              <tr v-if="logEntries.length === 0 && !logError">
                <td colspan="4" class="px-3 py-6 text-center text-gray-400">No log entries yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
</style>
