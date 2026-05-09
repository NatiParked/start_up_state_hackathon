// Admin domain store — session state + submission queue.
// Consumers: AdminDashboard.vue, AdminQueue (Phase 2+).
// useAdminAuth composable drives session via setSession().
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAdminStore = defineStore('admin', () => {
  const session = ref(null)
  const submissions = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const adminVerified = ref(false)

  const isAdmin = computed(() => adminVerified.value && !!session.value?.user?.email)

  /**
   * Sync session from onAuthStateChange; runs map_admin_users lookup on email change.
   * @param {import('@supabase/supabase-js').Session|null} newSession
   * @returns {Promise<void>}
   */
  async function setSession(newSession) {
    session.value = newSession
    const email = newSession?.user?.email
    if (!email) {
      adminVerified.value = false
      return
    }
    const { data } = await supabase
      .from('map_admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    adminVerified.value = !!data
  }

  /**
   * Fetch pending startup submissions ordered newest-first.
   * @returns {Promise<{data: Array|null, error: any}>}
   */
  async function fetchSubmissions() {
    isLoading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('map_startup_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
      if (fetchError) throw fetchError
      submissions.value = data ?? []
      return { data, error: null }
    } catch (err) {
      error.value = err
      return { data: null, error: err }
    } finally {
      isLoading.value = false
    }
  }

  return {
    session,
    submissions,
    isLoading,
    error,
    isAdmin,
    adminVerified,
    setSession,
    fetchSubmissions,
  }
})
