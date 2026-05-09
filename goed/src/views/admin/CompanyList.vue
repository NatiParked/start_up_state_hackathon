<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useStartupsStore } from '@/stores/startups'
import { storeToRefs } from 'pinia'
import CompanyEditor from '@/components/admin/CompanyEditor.vue'
import gsap from 'gsap'
import { supabase } from '@/lib/supabase'

const store = useStartupsStore()
const { companies, isLoading } = storeToRefs(store)

const searchQuery = ref('')
const sortKey = ref('name')
const sortDir = ref('asc')
const selectedCompany = ref(null)
const panelRef = ref(null)
const actionError = ref(null)

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

async function toggleHidden(company) {
  actionError.value = null
  try {
    const { error } = await supabase
      .from('map_startups')
      .update({ is_hidden: !company.is_hidden })
      .eq('id', company.id)
    if (error) throw error
    await store.fetchAll()
  } catch (err) {
    actionError.value = err.message
  }
}

async function softDelete(company) {
  actionError.value = null
  const confirmed = window.confirm('Soft-delete this company? It will be hidden from the public map but recoverable.')
  if (!confirmed) return
  try {
    const { error } = await supabase
      .from('map_startups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', company.id)
    if (error) throw error
    await store.fetchAll()
  } catch (err) {
    actionError.value = err.message
  }
}

watch(selectedCompany, (val) => {
  if (val && panelRef.value) {
    gsap.from(panelRef.value, { x: '100%', duration: 0.3, ease: 'power2.out' })
  }
})
</script>

<template>
  <div class="h-full flex flex-col p-6">
    <!-- Page header -->
    <div class="flex items-center gap-3 mb-6 shrink-0">
      <div>
        <div class="kicker">— Directory</div>
        <h1 class="display-sm mt-1 text-[var(--fg)]">Companies</h1>
      </div>
      <span class="chip-soft">{{ displayedCompanies.length }}</span>
    </div>

    <!-- Search -->
    <div class="mb-4 shrink-0">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name..."
        class="input max-w-sm"
      />
      <div
        v-if="actionError"
        class="mt-2 max-w-sm rounded-md px-3 py-2 text-sm"
        style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
      >
        {{ actionError }}
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-16 text-[var(--fg-2)]">
      Loading companies...
    </div>

    <!-- Table: scrolls independently -->
    <div
      v-else
      class="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-xl border"
      style="background: var(--surface); border-color: var(--hair);"
    >
      <table class="min-w-full text-sm">
        <thead class="sticky top-0" style="background: var(--surface-2);">
          <tr>
            <th class="px-4 py-3 text-left lbl">
              <button
                class="flex items-center gap-1 hover:text-[var(--accent)]"
                @click="toggleSort('name')"
              >
                Name
                <span v-if="sortKey === 'name'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left lbl">
              <button
                class="flex items-center gap-1 hover:text-[var(--accent)]"
                @click="toggleSort('sector')"
              >
                Sector
                <span v-if="sortKey === 'sector'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left lbl">
              <button
                class="flex items-center gap-1 hover:text-[var(--accent)]"
                @click="toggleSort('stage')"
              >
                Stage
                <span v-if="sortKey === 'stage'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left lbl">
              <button
                class="flex items-center gap-1 hover:text-[var(--accent)]"
                @click="toggleSort('created_at')"
              >
                Created At
                <span v-if="sortKey === 'created_at'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-left lbl">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in displayedCompanies"
            :key="c.id"
            class="cursor-pointer transition-colors border-t"
            style="border-color: var(--hair);"
            @click="openEditor(c)"
            @mouseenter="(e) => e.currentTarget.style.background = 'var(--surface-2)'"
            @mouseleave="(e) => e.currentTarget.style.background = 'transparent'"
          >
            <td class="px-4 py-3 font-medium text-[var(--fg)]">
              <span>{{ c.name }}</span>
              <span
                v-if="c.deleted_at"
                class="ml-2 badge-cat"
                style="background: rgba(244,162,97,0.12); color: var(--warn); border-color: rgba(244,162,97,0.35);"
              >Deleted</span>
              <span
                v-else-if="c.is_hidden"
                class="ml-2 badge-cat outline"
              >Hidden</span>
            </td>
            <td class="px-4 py-3 text-[var(--fg-2)]">{{ c.sector ?? '—' }}</td>
            <td class="px-4 py-3 text-[var(--fg-2)]">{{ c.stage ?? '—' }}</td>
            <td class="px-4 py-3 text-[var(--fg-3)]">
              {{ c.created_at ? new Date(c.created_at).toLocaleDateString() : '—' }}
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <button
                  class="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
                  @click.stop="toggleHidden(c)"
                >
                  {{ c.is_hidden ? 'Show' : 'Hide' }}
                </button>
                <button
                  class="text-xs font-medium hover:underline whitespace-nowrap"
                  style="color: var(--warn);"
                  @click.stop="softDelete(c)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="displayedCompanies.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-[var(--fg-3)]">No companies found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Slide-in editor panel -->
    <Teleport v-if="selectedCompany" to="body">
      <div
        class="fixed inset-0 z-40"
        style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);"
        @click="closeEditor"
      />
      <div
        ref="panelRef"
        class="fixed top-0 right-0 h-full w-1/2 z-50 overflow-y-auto border-l"
        style="background: var(--bg-2); border-color: var(--hair); box-shadow: -30px 0 60px -20px rgba(0,0,0,0.6);"
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
