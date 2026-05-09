<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useStartupsStore } from '@/stores/startups'
import { storeToRefs } from 'pinia'
import CompanyEditor from '@/components/admin/CompanyEditor.vue'
import gsap from 'gsap'

const store = useStartupsStore()
const { companies, isLoading } = storeToRefs(store)

const searchQuery = ref('')
const sortKey = ref('name')
const sortDir = ref('asc')
const selectedCompany = ref(null)
const panelRef = ref(null)

onMounted(() => store.fetchAll())

const displayedCompanies = computed(() => {
  let list = companies.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c => (c.name ?? '').toLowerCase().includes(q))
  }
  return [...list].sort((a, b) => {
    const av = a[sortKey.value] ?? ''
    const bv = b[sortKey.value] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function openEditor(company) {
  selectedCompany.value = company
}

function closeEditor() {
  selectedCompany.value = null
}

watch(selectedCompany, (val) => {
  if (val && panelRef.value) {
    gsap.from(panelRef.value, { x: '100%', duration: 0.3, ease: 'power2.out' })
  }
})
</script>

<template>
  <div class="p-6">
    <!-- Page header -->
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Companies</h1>
      <span class="bg-utah-blue text-white text-sm font-semibold px-2.5 py-0.5 rounded-full">
        {{ displayedCompanies.length }}
      </span>
    </div>

    <!-- Search -->
    <div class="mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name..."
        class="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
      />
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-16 text-gray-500">
      Loading companies...
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">
              <button
                class="flex items-center gap-1 hover:text-utah-blue"
                @click="toggleSort('name')"
              >
                Name
                <span v-if="sortKey === 'name'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">
              <button
                class="flex items-center gap-1 hover:text-utah-blue"
                @click="toggleSort('sector')"
              >
                Sector
                <span v-if="sortKey === 'sector'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">
              <button
                class="flex items-center gap-1 hover:text-utah-blue"
                @click="toggleSort('stage')"
              >
                Stage
                <span v-if="sortKey === 'stage'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">
              <button
                class="flex items-center gap-1 hover:text-utah-blue"
                @click="toggleSort('created_at')"
              >
                Created At
                <span v-if="sortKey === 'created_at'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-for="c in displayedCompanies"
            :key="c.id"
            class="cursor-pointer hover:bg-gray-50 transition-colors"
            @click="openEditor(c)"
          >
            <td class="px-4 py-3 font-medium text-gray-900">{{ c.name }}</td>
            <td class="px-4 py-3 text-gray-600">{{ c.sector ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-600">{{ c.stage ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-500">
              {{ c.created_at ? new Date(c.created_at).toLocaleDateString() : '—' }}
            </td>
          </tr>
          <tr v-if="displayedCompanies.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-400">No companies found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Slide-in editor panel -->
    <Teleport v-if="selectedCompany" to="body">
      <div class="fixed inset-0 bg-black/30 z-40" @click="closeEditor" />
      <div
        ref="panelRef"
        class="fixed top-0 right-0 h-full w-1/2 bg-white shadow-xl z-50 overflow-y-auto"
      >
        <CompanyEditor
          :company="selectedCompany"
          @close="closeEditor"
          @saved="closeEditor"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
