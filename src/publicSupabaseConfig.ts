// Browser-safe project configuration. This is a publishable key, not an admin secret.
// Data access is enforced by Supabase Auth and the gd_* RLS policies in supabase/setup.sql.
// VITE_SUPABASE_* environment variables can override these deployment defaults.
export const publicSupabaseConfig = {
  url: 'https://bdzjubtludjcujsygywr.supabase.co',
  publishableKey: 'sb_publishable_PfrqUSJyFkmkDS5EaSxxGQ_Tg_siiBe',
}
