import { createClient } from '@supabase/supabase-js'
import { publicSupabaseConfig } from './publicSupabaseConfig'

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
export const supabase = createClient(
  env.VITE_SUPABASE_URL || publicSupabaseConfig.url,
  env.VITE_SUPABASE_PUBLISHABLE_KEY || publicSupabaseConfig.publishableKey,
)
