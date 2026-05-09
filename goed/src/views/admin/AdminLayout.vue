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
  <div class="h-full flex">
    <!-- Sidebar -->
    <aside ref="sidebarEl" class="w-56 flex flex-col border-r" style="background: var(--bg-2); border-color: var(--hair);">
      <!-- Logo / brand area -->
      <div class="px-4 py-5 border-b" style="border-color: var(--hair);">
        <span class="kicker">GOED Admin</span>
      </div>

      <!-- Nav links -->
      <nav class="flex-1 px-2 py-4 space-y-1">
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="{ name: link.name }"
          class="admin-nav-link block px-3 py-2 rounded-md text-sm font-medium transition-colors"
          :class="{ 'admin-nav-link-active': isActive(link.name) }"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <!-- Sign out -->
      <div class="px-2 py-4 border-t" style="border-color: var(--hair);">
        <button
          @click="handleSignOut"
          class="admin-nav-link w-full px-3 py-2 rounded-md text-sm font-medium text-left"
        >
          Sign out
        </button>
      </div>
    </aside>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Sticky top bar -->
      <header
        class="sticky top-0 z-10 border-b px-6 py-3 flex items-center justify-between shrink-0"
        style="background: rgba(13,25,45,0.6); backdrop-filter: blur(8px); border-color: var(--hair);"
      >
        <span class="text-sm text-[var(--fg-2)]">
          Signed in as <strong class="text-[var(--fg)] font-semibold">{{ adminEmail }}</strong>
        </span>
        <span class="text-xs text-[var(--fg-3)]">Last login: {{ lastLogin }}</span>
      </header>

      <!-- Nested route content -->
      <main class="flex-1 min-h-0 overflow-hidden flex flex-col">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-nav-link {
  color: var(--fg-2);
  background: transparent;
  border: 0;
  cursor: pointer;
  text-decoration: none;
}
.admin-nav-link:hover {
  background: var(--surface);
  color: var(--fg);
}
.admin-nav-link-active {
  background: var(--accent-soft);
  color: var(--accent) !important;
  box-shadow: inset 2px 0 0 var(--accent);
}
</style>
