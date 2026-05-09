<script setup>
import { useRouter } from 'vue-router'
import { useAdminAuth } from '@/composables/useAdminAuth'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const { session, signOut } = useAdminAuth()
const adminStore = useAdminStore()

async function handleSignOut() {
  await signOut()
  router.push({ name: 'AdminLogin' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
      <h1 class="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
      <p class="text-sm text-gray-500 mb-6">Signed in as {{ session?.user?.email }}</p>
      <button
        @click="handleSignOut"
        class="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-md transition-colors"
      >
        Sign out
      </button>
    </div>
  </div>
</template>
