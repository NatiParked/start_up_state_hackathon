<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import gsap from 'gsap'
import { useAdminAuth } from '@/composables/useAdminAuth'

const { session, signOut } = useAdminAuth()
const router = useRouter()
const route = useRoute()
const sidebarEl = ref(null)

async function handleSignOut() {
  await signOut()
  router.push({ name: 'AdminLogin' })
}

onMounted(() => {
  gsap.from(sidebarEl.value, { x: '-100%', duration: 0.2, ease: 'power2.out' })
})

const adminEmail = computed(() => session.value?.user?.email ?? '')
const lastLogin = computed(() => {
  const ts = session.value?.user?.last_sign_in_at
  return ts ? new Date(ts).toLocaleString() : '—'
})

const navLinks = [
  { label: 'Dashboard', name: 'AdminDashboard' },
  { label: 'Submissions', name: 'AdminSubmissions' },
  { label: 'Companies', name: 'AdminCompanies' },
  { label: 'Refresh', name: 'AdminRefresh' },
  { label: 'Subscribers', name: 'AdminSubscribers' },
]

function isActive(name) {
  return route.name === name
}
</script>

<template>
  <div class="min-h-screen flex bg-gray-100">
    <!-- Sidebar -->
    <aside ref="sidebarEl" class="w-56 bg-utah-blue flex flex-col">
      <!-- Logo / brand area -->
      <div class="px-4 py-5 border-b border-blue-700">
        <span class="text-white font-bold text-sm tracking-wide">GOED Admin</span>
      </div>

      <!-- Nav links -->
      <nav class="flex-1 px-2 py-4 space-y-1">
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="{ name: link.name }"
          class="block px-3 py-2 rounded text-sm font-medium text-blue-100 hover:bg-blue-700 hover:text-white transition-colors"
          :class="{ 'bg-blue-800 text-white': isActive(link.name) }"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <!-- Sign out -->
      <div class="px-2 py-4 border-t border-blue-700">
        <button
          @click="handleSignOut"
          class="w-full px-3 py-2 rounded text-sm font-medium text-blue-200 hover:bg-blue-700 hover:text-white transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </aside>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col">
      <!-- Sticky top bar -->
      <header class="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span class="text-sm text-gray-600">Signed in as <strong class="text-gray-900">{{ adminEmail }}</strong></span>
        <span class="text-xs text-gray-400">Last login: {{ lastLogin }}</span>
      </header>

      <!-- Nested route content -->
      <main class="flex-1 p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
