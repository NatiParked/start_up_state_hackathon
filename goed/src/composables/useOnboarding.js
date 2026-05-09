import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * Composable for submitting a startup URL to the onboard-company Edge Function.
 * Manages status, result, and error state reactively.
 *
 * @returns {{ status: import('vue').Ref<null|string>, result: import('vue').Ref<object|null>, error: import('vue').Ref<string|null>, isLoading: import('vue').Ref<boolean>, submit: function, reset: function }}
 */
export function useOnboarding() {
  const status = ref(null)
  const result = ref(null)
  const error = ref(null)
  const isLoading = ref(false)

  /**
   * Submits a URL (and optional email) to the onboard-company Edge Function.
   * Updates status, result, and error reactively.
   *
   * @param {{ url: string, email?: string }} payload
   * @returns {Promise<void>}
   */
  async function submit({ url, email }) {
    status.value = 'running'
    isLoading.value = true
    error.value = null
    result.value = null

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('onboard-company', {
        body: { url, email },
      })

      if (invokeError) {
        error.value = invokeError.message ?? 'Unexpected error'
        status.value = 'error'
      } else {
        result.value = data
        status.value = data?.status ?? 'error'
      }
    } catch (err) {
      error.value = err?.message ?? 'Network error'
      status.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Resets all state back to initial values so the form can be reused.
   */
  function reset() {
    status.value = null
    result.value = null
    error.value = null
    isLoading.value = false
  }

  return { status, result, error, isLoading, submit, reset }
}
