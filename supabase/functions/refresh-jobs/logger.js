/**
 * refresh-jobs logger — inserts one row into refresh_log per invocation.
 * Usage: import { logRun } from './logger.js'
 */

/**
 * Insert a single audit row into refresh_log.
 * Never throws — returns the { error } shape from the Supabase insert call.
 *
 * @param {import('npm:@supabase/supabase-js@2').SupabaseClient} supabase
 * @param {{ startup_id: string|null, source: 'cron'|'manual', success: boolean, error_message: string|null, jobs_updated: number }} payload
 * @returns {Promise<{ error: import('npm:@supabase/supabase-js@2').PostgrestError|null }>}
 */
export async function logRun(supabase, { startup_id, source, success, error_message, jobs_updated }) {
  const { error } = await supabase
    .from('map_refresh_log')
    .insert({
      startup_id: startup_id ?? null,
      source,
      success,
      error_message: error_message ?? null,
      jobs_updated: jobs_updated ?? 0,
    });

  return { error };
}
