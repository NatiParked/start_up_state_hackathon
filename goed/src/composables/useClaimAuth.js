// Reactive auth composable for the founder claim flow. Consumers: router/guards.js (claimGuard), ClaimLoginView.vue, CompanyEditView.vue. Subscribes to onAuthStateChange once at module level.
import { ref, computed, watchEffect } from 'vue'
import { supabase } from '@/lib/supabase'

let subscribed = false
const session = ref(null)
const claimVerified = ref(false)
const isCheckingClaim = ref(false)

;(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
})()

if (!subscribed) {
  subscribed = true
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    if (!newSession) {
      claimVerified.value = false
    }
  })
}

export function useClaimAuth(startupId) {
  watchEffect(async () => {
    const email = session.value?.user?.email
    if (!email || !startupId) {
      claimVerified.value = false
      return
    }
    isCheckingClaim.value = true
    try {
      const { data } = await supabase
        .from('company_claims')
        .select('claimer_email')
        .eq('startup_id', startupId)
        .eq('claimer_email', email)
        .maybeSingle()
      claimVerified.value = !!data
    } finally {
      isCheckingClaim.value = false
    }
  })

  const isOwner = computed(() => claimVerified.value)

  async function requestClaim(id, email) {
    const { error } = await supabase.functions.invoke('claim-company', { body: { startup_id: id, claimer_email: email } })
    if (error) {
      try {
        const body = await error.context?.json()
        return { data: null, error: { message: body?.error ?? error.message } }
      } catch {
        return { data: null, error }
      }
    }
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/company/' + id + '/edit' },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    claimVerified.value = false
  }

  return { session, isOwner, isCheckingClaim, requestClaim, signOut }
}
