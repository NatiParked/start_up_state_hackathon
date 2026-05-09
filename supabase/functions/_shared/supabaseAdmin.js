/**
 * Shared factory: service-role Supabase client.
 *
 * Usage: import { createAdminClient } from '../_shared/supabaseAdmin.js'
 *
 * Required env vars:
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role secret (bypasses RLS)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Create a Supabase client authenticated as the service role.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Deno.env.
 * Throws a descriptive Error if either env var is missing.
 *
 * @returns {import('npm:@supabase/supabase-js@2').SupabaseClient}
 */
export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) {
    throw new Error('Missing required env var: SUPABASE_URL');
  }
  if (!key) {
    throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key);
}
