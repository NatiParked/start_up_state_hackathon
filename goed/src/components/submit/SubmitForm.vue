<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const urlValue = ref('')
const emailValue = ref('')
const validationError = ref('')

function onSubmit() {
  validationError.value = ''
  try {
    new URL(urlValue.value)
  } catch {
    validationError.value = 'Please enter a valid URL (e.g. https://yourstartup.com)'
    return
  }
  emit('submit', { url: urlValue.value, email: emailValue.value || undefined })
}

const buttonLabel = computed(() => (props.isLoading ? 'Submitting…' : 'Submit'))
const submitDisabled = computed(() => props.isLoading)
const inputDisabled = computed(() => props.isLoading)

const inputBaseClass = computed(() => 'input disabled:opacity-60 disabled:cursor-not-allowed')

const buttonBaseClass = computed(() => {
  const base = 'btn btn-primary justify-center w-full'
  const state = props.isLoading ? 'opacity-70 cursor-not-allowed' : ''
  return `${base} ${state}`
})
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="field-label" for="startup-url">
        Startup website URL <span class="req">*</span>
      </label>
      <input
        id="startup-url"
        v-model="urlValue"
        type="url"
        placeholder="https://yourstartup.com"
        required
        :class="inputBaseClass"
        :disabled="inputDisabled"
      />
      <p v-if="validationError" class="mt-1 text-xs text-[var(--warn)]">{{ validationError }}</p>
    </div>

    <div>
      <label class="field-label" for="founder-email">
        Founder email <span class="text-[var(--fg-3)] font-normal normal-case tracking-normal">(optional)</span>
      </label>
      <input
        id="founder-email"
        v-model="emailValue"
        type="email"
        placeholder="you@yourstartup.com"
        :class="inputBaseClass"
        :disabled="inputDisabled"
      />
    </div>

    <button type="submit" :class="buttonBaseClass" :disabled="submitDisabled">
      <span
        v-if="isLoading"
        class="inline-block w-4 h-4 border-2 border-[#07140A] border-t-transparent rounded-full animate-spin mr-2"
      ></span>
      {{ buttonLabel }}
    </button>
  </form>
</template>

<style scoped></style>
