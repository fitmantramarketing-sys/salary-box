import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 15-second timeout for all Supabase fetch requests.
// Prevents infinite loading when a request stalls.
const fetchWithTimeout: typeof fetch = (url, init) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout))
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
})
