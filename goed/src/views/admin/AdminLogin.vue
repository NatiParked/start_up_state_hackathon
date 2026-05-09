<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAdminAuth } from '@/composables/useAdminAuth'

const router = useRouter()
const route = useRoute()
const { isAdmin, signInWithMagicLink } = useAdminAuth()

const email = ref('')
const isSubmitting = ref(false)
const submitError = ref(null)
const linkSent = ref(false)

const notAllowedNotice = computed(() =>
  route.query.reason === 'not-allowed' ? 'That email is not on the admin allow-list.' : null
)

const confirmationMessage = computed(() =>
  linkSent.value ? `Check your email — link sent to ${email.value}` : null
)

function redirectIfAdmin() {
  if (isAdmin.value) {
    router.replace({ name: 'AdminDashboard' })
  }
}

onMounted(redirectIfAdmin)
watch(isAdmin, redirectIfAdmin)

async function handleSubmit() {
  submitError.value = null
  isSubmitting.value = true
  try {
    const { error } = await signInWithMagicLink(email.value)
    if (error) {
      submitError.value = error.message
    } else {
      linkSent.value = true
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="bg-white p-8 rounded-lg shadow max-w-md w-full">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">Admin Sign In</h1>

      <div v-if="notAllowedNotice" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        {{ notAllowedNotice }}
      </div>

      <div v-if="submitError" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        {{ submitError }}
      </div>

      <div v-if="confirmationMessage" class="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
        {{ confirmationMessage }}
      </div>

      <form v-if="!linkSent" @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="you@example.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
        >
          {{ isSubmitting ? 'Sending…' : 'Send magic link' }}
        </button>
      </form>
    </div>
  </div>
</template>
