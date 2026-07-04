import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  const missingVars = []
  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabasePublishableKey) missingVars.push('SUPABASE_PUBLISHABLE_KEY')
  
  console.error('Missing Supabase environment variables:', missingVars.join(', '))
  console.error('Current env:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabasePublishableKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabasePublishableKey?.length || 0,
  })
  
  throw new Error(
    `Missing Supabase environment variables: ${missingVars.join(', ')}. Please set these in your Vercel environment variables.`
  )
}

export const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey)

