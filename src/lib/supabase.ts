import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Supabase client seam.
 *
 * Production mode: when VITE_SUPABASE_* is set, every data
 * module routes through getSupabase() and all data lives in
 * Postgres.
 *
 * Demo mode: with no environment variables, the app runs
 * client-side on localStorage with seeded demo data. This is
 * a development convenience — production builds refuse to
 * start unconfigured (see assertProductionReady / isDemoMode),
 * so a misconfigured deploy can never silently run on browser
 * storage.
 */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY)
}

/**
 * Demo mode (localStorage) is available in development only.
 * In a production build without Supabase configured the app
 * shows a configuration error instead of the demo dataset.
 */
export function isDemoMode(): boolean {
  return !isSupabaseConfigured() && import.meta.env.DEV
}

export function configurationError(): Error {
  return new Error(
    "GymSOS isn't configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Demo mode is only available in development."
  )
}

let client: SupabaseClient | null = null

/**
 * Lazily creates the Supabase client.
 * Only call after checking isSupabaseConfigured().
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}
