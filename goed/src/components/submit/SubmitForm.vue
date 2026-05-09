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

const inputBaseClass = computed(
  () =>
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed',
)

const buttonBaseClass = computed(() => {
  const base =
    'inline-flex items-center justify-center w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors'
  const color = props.isLoading
    ? 'bg-utah-blue opacity-70 cursor-not-allowed'
    : 'bg-utah-blue hover:bg-utah-blue-dark active:scale-95'
  return `${base} ${color}`
})
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="startup-url">
        Startup website URL <span class="text-error-red">*</span>
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
      <p v-if="validationError" class="mt-1 text-xs text-error-red">{{ validationError }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="founder-email">
        Founder email <span class="text-gray-400 font-normal">(optional)</span>
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
        class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
      ></span>
      {{ buttonLabel }}
    </button>
  </form>
</template>

<style scoped></style>
