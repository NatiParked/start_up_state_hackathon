// Route guard for the /admin subtree.
// Consumers: router/index.js (beforeEnter on /admin and /admin/dashboard).
import { supabase } from '@/lib/supabase'

/**
 * Navigation guard that enforces authentication and allow-list membership.
 * Redirects unauthenticated users to AdminLogin; non-listed emails are signed out first.
 * @param {import('vue-router').RouteLocationNormalized} _to
 * @param {import('vue-router').RouteLocationNormalized} _from
 * @param {Function} next
 * @returns {Promise<void>}
 */
export async function adminGuard(_to, _from, next) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return next({ name: 'AdminLogin' })
  }

  const { data } = await supabase
    .from('map_admin_users')
    .select('email')
    .eq('email', session.user.email)
    .maybeSingle()

  if (!data) {
    await supabase.auth.signOut()
    return next({ name: 'AdminLogin', query: { reason: 'not-allowed' } })
  }

  return next()
}
