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
    <div class="shrink-0">
      <div class="kicker">— Operations</div>
      <h1 class="display-sm mt-1 text-[var(--fg)]">Refresh Control</h1>
    </div>

    <!-- Section 1: Bulk Refresh -->
    <section class="shrink-0 card card-pad">
      <h2 class="kicker mb-3">Bulk Refresh</h2>
      <button
        class="btn btn-primary"
        :class="{ 'opacity-60 cursor-not-allowed': isBulkRefreshing }"
        :disabled="isBulkRefreshing"
        @click="handleRefreshAll"
      >
        <span v-if="isBulkRefreshing" class="inline-block w-4 h-4 border-2 border-[#07140A] border-t-transparent rounded-full animate-spin" />
        {{ isBulkRefreshing ? 'Refreshing…' : 'Refresh All' }}
      </button>
      <p
        v-if="bulkResultMessage"
        class="mt-3 text-sm"
        :style="{ color: bulkResultIsError ? 'var(--warn)' : 'var(--accent)' }"
      >
        {{ bulkResultMessage }}
      </p>
    </section>

    <!-- Tab strip -->
    <div
      class="shrink-0 flex gap-1 p-1 rounded-md w-fit"
      style="background: var(--surface);"
    >
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded transition-colors"
        :class="activeTab === 'companies' ? 'is-active' : ''"
        :style="activeTab === 'companies' ? 'background: var(--accent); color: #07140A;' : 'color: var(--fg-2);'"
        @click="activeTab = 'companies'"
      >
        Companies
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded transition-colors"
        :class="activeTab === 'log' ? 'is-active' : ''"
        :style="activeTab === 'log' ? 'background: var(--accent); color: #07140A;' : 'color: var(--fg-2);'"
        @click="activeTab = 'log'"
      >
        Refresh Log
      </button>
    </div>

    <!-- Active tab panel -->
    <section
      class="flex-1 min-h-0 flex flex-col rounded-xl border"
      style="background: var(--surface); border-color: var(--hair);"
    >
      <!-- Companies tab -->
      <template v-if="activeTab === 'companies'">
        <div class="shrink-0 flex items-center justify-between px-5 py-3 border-b" style="border-color: var(--hair);">
          <h2 class="kicker">Companies</h2>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name..."
            class="input w-64"
          />
        </div>
        <div v-if="isLoading" class="flex-1 py-8 text-center text-[var(--fg-2)] text-sm">Loading…</div>
        <div v-else class="flex-1 min-h-0 overflow-y-auto">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0" style="background: var(--surface-2);">
              <tr>
                <th class="px-4 py-2 text-left lbl">Name</th>
                <th class="px-4 py-2 text-left lbl">Last Refreshed</th>
                <th class="px-4 py-2 text-left lbl">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredCompanies" :key="row.id" class="border-t" style="border-color: var(--hair);">
                <td class="px-4 py-2 font-medium text-[var(--fg)]">{{ row.name }}</td>
                <td class="px-4 py-2 text-[var(--fg-3)]">
                  {{ row.last_refreshed_at ? new Date(row.last_refreshed_at).toLocaleString() : '—' }}
                </td>
                <td class="px-4 py-2">
                  <button
                    class="btn btn-primary py-[0.35rem] px-3 text-xs"
                    :class="{ 'opacity-60 cursor-not-allowed': perRowRefreshing.has(row.id) }"
                    :disabled="perRowRefreshing.has(row.id)"
                    @click="handleRefreshOne(row.id)"
                  >
                    {{ perRowRefreshing.has(row.id) ? 'Refreshing…' : 'Refresh' }}
                  </button>
                </td>
              </tr>
              <tr v-if="filteredCompanies.length === 0">
                <td colspan="3" class="px-4 py-6 text-center text-[var(--fg-3)]">No companies match.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Log tab -->
      <template v-else>
        <div class="shrink-0 px-5 py-3 border-b" style="border-color: var(--hair);">
          <h2 class="kicker">Refresh Log (last 20, polled every 5s)</h2>
          <div v-if="logError" class="mt-2 text-sm" style="color: var(--warn);">Failed to load log: {{ logError.message ?? logError }}</div>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto">
          <table class="min-w-full text-xs">
            <thead class="sticky top-0" style="background: var(--surface-2);">
              <tr>
                <th class="px-3 py-2 text-left lbl">Time</th>
                <th class="px-3 py-2 text-left lbl">Startup</th>
                <th class="px-3 py-2 text-left lbl">Status</th>
                <th class="px-3 py-2 text-left lbl">Message</th>
              </tr>
            </thead>
            <tbody style="font-family: var(--mono);">
              <tr v-for="entry in logEntries" :key="entry.id" class="border-t" style="border-color: var(--hair);">
                <td class="px-3 py-2 text-[var(--fg-3)] whitespace-nowrap">{{ new Date(entry.created_at).toLocaleTimeString() }}</td>
                <td class="px-3 py-2 text-[var(--fg-2)]">{{ startupNameById[entry.startup_id] ?? '—' }}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    :style="entry.status === 'success'
                      ? 'background: var(--accent); color: #07140A;'
                      : entry.status === 'error'
                        ? 'background: var(--warn); color: #07140A;'
                        : 'background: var(--surface-2); color: var(--fg-2); border: 1px solid var(--hair-2);'"
                  >
                    {{ entry.status ?? '—' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-[var(--fg-2)] truncate max-w-md">{{ (entry.message ?? '').slice(0, 200) }}</td>
              </tr>
              <tr v-if="logEntries.length === 0 && !logError">
                <td colspan="4" class="px-3 py-6 text-center text-[var(--fg-3)]">No log entries yet.</td>
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
