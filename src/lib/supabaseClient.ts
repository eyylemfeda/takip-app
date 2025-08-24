import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Supabase env eksik:', { url, hasKey: Boolean(key) })
}

export const supabase = createClient(url!, key!)
