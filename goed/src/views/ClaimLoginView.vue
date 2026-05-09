<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useClaimAuth } from '@/composables/useClaimAuth'

const router = useRouter()
const route = useRoute()
const id = route.params.id

const companyName = ref(null)
const email = ref('')
const isSubmitting = ref(false)
const submitError = ref(null)
const linkSent = ref(false)

const { isOwner, requestClaim } = useClaimAuth(id)

const notAllowedNotice = computed(() =>
  route.query.reason === 'not-allowed' ? "That email isn't authorized to manage this listing." : null
)

const confirmationMessage = computed(() =>
  linkSent.value ? `Check your inbox — we sent a magic link to ${email.value}` : null
)

function redirectIfOwner() {
  if (isOwner.value) {
    router.replace({ name: 'CompanyEdit', params: { id } })
  }
}

onMounted(async () => {
  const { data } = await supabase
    .from('map_startups')
    .select('name')
    .eq('id', id)
    .maybeSingle()
  companyName.value = data?.name ?? null
  redirectIfOwner()
})

watch(isOwner, redirectIfOwner)

async function handleSubmit() {
  submitError.value = null
  isSubmitting.value = true
  try {
    const { error } = await requestClaim(id, email.value)
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
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">
        Claim {{ companyName ?? 'this listing' }}
      </h1>

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

      <div v-else class="text-sm text-gray-700 space-y-2">
        <p>We sent a magic link to your inbox. Click the link in that email to access your listing editor.</p>
        <p class="text-gray-500">Didn't receive it? Check your spam folder or try again.</p>
      </div>
    </div>
  </div>
</template>
