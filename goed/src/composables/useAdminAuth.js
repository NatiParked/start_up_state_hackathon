// Reactive auth composable for the admin section.
// Consumers: router/guards.js (session check), AdminLogin.vue (sign-in form), AdminDashboard.vue (sign-out).
// Subscribes to onAuthStateChange once at module level to avoid duplicate listeners.
import { ref, computed, watchEffect } from 'vue'
import { supabase } from '@/lib/supabase'

let subscribed = false
const session = ref(null)
const adminVerified = ref(false)
const isCheckingAdmin = ref(false)

;(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
})()

if (!subscribed) {
  subscribed = true
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    if (!newSession) {
      adminVerified.value = false
    }
  })
}

watchEffect(async () => {
  const email = session.value?.user?.email
  if (!email) {
    adminVerified.value = false
    return
  }
  isCheckingAdmin.value = true
  try {
    const { data } = await supabase
      .from('map_admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    adminVerified.value = !!data
  } finally {
    isCheckingAdmin.value = false
  }
})

/**
 * Admin auth composable — provides reactive session state and magic-link helpers.
 * Safe to call from multiple components; subscription is module-level.
 * @returns {{ session: import('vue').Ref, isAdmin: import('vue').ComputedRef<boolean>, isCheckingAdmin: import('vue').Ref<boolean>, signInWithMagicLink: (email: string) => Promise<{data: any, error: any}>, signOut: () => Promise<void> }}
 */
export function useAdminAuth() {
  const isAdmin = computed(() => adminVerified.value)

  /**
   * Send a magic-link OTP to the given email. Redirects to /admin/dashboard on click.
   * @param {string} email
   * @returns {Promise<{data: any, error: any}>}
   */
  async function signInWithMagicLink(email) {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/admin/dashboard' },
    })
  }

  /**
   * Sign the current user out and reset local admin state.
   * @returns {Promise<void>}
   */
  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    adminVerified.value = false
  }

  return { session, isAdmin, isCheckingAdmin, signInWithMagicLink, signOut }
}
