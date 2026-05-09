<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useClaimAuth } from '@/composables/useClaimAuth'

const router = useRouter()
const route = useRoute()
const id = route.params.id

const { signOut } = useClaimAuth(id)

async function handleSignOut() {
  await signOut()
  router.push({ name: 'Map' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="bg-white p-8 rounded-lg shadow max-w-md w-full space-y-4">
      <h1 class="text-2xl font-semibold text-gray-900">Edit your listing</h1>
      <p class="text-sm text-gray-600">
        The full listing editor is coming in the next phase. Check back soon!
      </p>
      <button
        type="button"
        @click="handleSignOut"
        class="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-md transition-colors"
      >
        Sign out
      </button>
    </div>
  </div>
</template>
