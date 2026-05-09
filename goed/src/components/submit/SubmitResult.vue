<script setup>
import { computed, onMounted } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  result: { type: Object, default: null },
  error: { type: String, default: null },
})

const emit = defineEmits(['retry'])

const view = computed(() => {
  if (props.error) return 'error'
  if (props.result?.status === 'auto_published') return 'auto_published'
  if (props.result?.status === 'pending') return 'pending'
  return 'error'
})

const mapLink = computed(() => {
  const id = props.result?.startup_id
  return id ? `/?startup=${id}` : '/'
})

const shareUrl = computed(() => {
  const id = props.result?.startup_id
  return id ? `${window.location.origin}/?startup=${id}` : window.location.origin
})

const rejectionReason = computed(() => props.result?.reason ?? '')

const errorMessage = computed(() => props.error ?? 'An unexpected error occurred.')

function copyShareLink() {
  navigator.clipboard.writeText(shareUrl.value)
}

function onRetry() {
  emit('retry')
}

onMounted(() => {
  gsap.from('.submit-result-heading', {
    opacity: 0,
    y: -16,
    duration: 0.5,
    ease: 'power2.out',
  })
})
</script>

<template>
  <div class="py-4">
    <section v-if="view === 'auto_published'" class="text-center space-y-4">
      <h1 class="submit-result-heading text-2xl font-bold text-utah-blue">You're on the map!</h1>
      <p class="text-gray-600">Your startup has been published to the Utah Startup Map.</p>
      <a
        :href="mapLink"
        class="inline-block rounded-md bg-utah-blue px-6 py-2 text-white font-semibold hover:bg-utah-blue-dark transition-colors"
      >
        View on map
      </a>
      <div>
        <button
          class="text-sm text-utah-blue underline underline-offset-2"
          @click="copyShareLink"
        >
          Copy share link
        </button>
      </div>
    </section>

    <section v-if="view === 'pending'" class="space-y-4">
      <h1 class="submit-result-heading text-2xl font-bold text-gray-800">
        Your submission is under review
      </h1>
      <p class="text-gray-600">GOED will review your submission within 48 hours.</p>
      <p v-if="rejectionReason" class="text-sm text-gray-500 bg-gray-100 rounded p-3">
        {{ rejectionReason }}
      </p>
      <router-link
        to="/admin"
        class="inline-block rounded-md border border-utah-blue px-6 py-2 text-utah-blue font-semibold hover:bg-utah-blue hover:text-white transition-colors"
      >
        Claim your listing
      </router-link>
    </section>

    <section v-if="view === 'error'" class="space-y-4">
      <h1 class="submit-result-heading text-2xl font-bold text-error-red">
        Something went wrong
      </h1>
      <p class="text-gray-600">{{ errorMessage }}</p>
      <button
        class="inline-block rounded-md bg-utah-blue px-6 py-2 text-white font-semibold hover:bg-utah-blue-dark transition-colors"
        @click="onRetry"
      >
        Try again
      </button>
    </section>
  </div>
</template>

<style scoped></style>
