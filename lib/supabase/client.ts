import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para uso en el NAVEGADOR (Client Components).
 * Crea una instancia singleton por llamada — internamente ya maneja el singleton.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
