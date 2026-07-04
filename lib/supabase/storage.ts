import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for storage operations
 * Uses service role key if available (for server-side uploads), otherwise uses publishable key
 */
export function createStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }

  // Prefer service role key for storage operations (bypasses RLS)
  // If not available, use publishable key (requires proper RLS policies)
  const key = serviceRoleKey || publishableKey

  if (!key) {
    throw new Error('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY is required')
  }

  return createSupabaseClient(supabaseUrl, key)
}

