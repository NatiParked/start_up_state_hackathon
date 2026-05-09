// Route guard for the /admin subtree and the /company/:id/edit claim subtree.
// Consumers: router/index.js (beforeEnter on /admin, /admin/dashboard, and /company/:id/edit).
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

/**
 * Navigation guard that enforces authentication and company_claims membership for the founder edit flow.
 * Redirects unauthenticated users to ClaimLogin; non-listed emails are signed out first.
 * @param {import('vue-router').RouteLocationNormalized} to
 * @param {import('vue-router').RouteLocationNormalized} _from
 * @param {Function} next
 * @returns {Promise<void>}
 */
export async function claimGuard(to, _from, next) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return next({ name: 'ClaimLogin', params: { id: to.params.id } })
  }

  const { data } = await supabase
    .from('company_claims')
    .select('claimer_email')
    .eq('startup_id', to.params.id)
    .eq('claimer_email', session.user.email)
    .maybeSingle()

  if (!data) {
    await supabase.auth.signOut()
    return next({ name: 'ClaimLogin', params: { id: to.params.id }, query: { reason: 'not-allowed' } })
  }

  return next()
}
