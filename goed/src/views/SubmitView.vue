<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import gsap from 'gsap'
import { useOnboarding } from '@/composables/useOnboarding'
import SubmitForm from '@/components/submit/SubmitForm.vue'
import SubmitProgress from '@/components/submit/SubmitProgress.vue'
import SubmitResult from '@/components/submit/SubmitResult.vue'

const { status, result, error, isLoading, submit, reset } = useOnboarding()

const simulatedStage = ref('idle')

let stageInterval = null

const STAGE_SEQUENCE = ['scrape', 'crunchbase', 'dcc', 'ats', 'logo', 'geocode', 'publish']
const STAGE_INTERVAL_MS = 8500

function clearStageInterval() {
  if (stageInterval !== null) {
    clearInterval(stageInterval)
    stageInterval = null
  }
}

function onFormSubmit({ url, email }) {
  simulatedStage.value = 'scrape'
  let stageIndex = 0
  clearStageInterval()
  stageInterval = setInterval(() => {
    stageIndex++
    if (stageIndex < STAGE_SEQUENCE.length) {
      simulatedStage.value = STAGE_SEQUENCE[stageIndex]
    } else {
      clearStageInterval()
    }
  }, STAGE_INTERVAL_MS)
  submit({ url, email })
}

function onRetry() {
  clearStageInterval()
  simulatedStage.value = 'idle'
  reset()
}

watch(status, (newStatus) => {
  const terminal = ['auto_published', 'pending', 'error']
  if (terminal.includes(newStatus)) {
    clearStageInterval()
  }
})

const view = computed(() => {
  if (status.value === null) return 'form'
  if (status.value === 'running') return 'running'
  return 'result'
})

onMounted(() => {
  gsap.from('.submit-card', {
    opacity: 0,
    y: 20,
    duration: 0.5,
    ease: 'power2.out',
  })
})
</script>

<template>
  <div class="min-h-screen flex items-start justify-center pt-16 px-4">
    <div class="submit-card form-section w-full max-w-lg">
      <div class="mb-6">
        <div class="kicker">— Submit</div>
        <h1 class="display-sm mt-2 text-[var(--fg)]">Add Your Startup</h1>
        <p class="text-sm text-[var(--fg-2)] mt-2">
          Submit a Utah startup URL and we'll add it to the map automatically.
        </p>
      </div>

      <SubmitForm
        v-if="view === 'form'"
        :is-loading="isLoading"
        @submit="onFormSubmit"
      />
      <SubmitProgress
        v-if="view === 'running'"
        :stage="simulatedStage"
      />
      <SubmitResult
        v-if="view === 'result'"
        :result="result"
        :error="error"
        @retry="onRetry"
      />
    </div>
  </div>
</template>

<style scoped></style>
