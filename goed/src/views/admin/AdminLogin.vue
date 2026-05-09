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
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="form-section max-w-md w-full">
      <div class="kicker">— Admin</div>
      <h1 class="display-sm mt-2 mb-6 text-[var(--fg)]">Sign in</h1>

      <div
        v-if="notAllowedNotice"
        class="mb-4 p-3 rounded-md text-sm"
        style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
      >
        {{ notAllowedNotice }}
      </div>

      <div
        v-if="submitError"
        class="mb-4 p-3 rounded-md text-sm"
        style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
      >
        {{ submitError }}
      </div>

      <div
        v-if="confirmationMessage"
        class="mb-4 p-3 rounded-md text-sm"
        style="background: var(--accent-soft); border: 1px solid rgba(17,223,129,0.3); color: var(--accent);"
      >
        {{ confirmationMessage }}
      </div>

      <form v-if="!linkSent" @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="email" class="field-label">Email address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="you@example.com"
            class="input"
          />
        </div>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="btn btn-primary w-full justify-center"
          :class="{ 'opacity-60 cursor-not-allowed': isSubmitting }"
        >
          {{ isSubmitting ? 'Sending…' : 'Send magic link' }}
        </button>
      </form>
    </div>
  </div>
</template>
