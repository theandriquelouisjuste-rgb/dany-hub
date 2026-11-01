import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'))

export const supabase = createClient(
  isConfigured ? url : 'http://localhost:54321',
  isConfigured ? key : 'public-anon-key-placeholder',
  { auth: { persistSession: true, autoRefreshToken: true } }
)
