import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase para uso en el SERVIDOR:
 * Server Components, Server Actions, Route Handlers.
 * Lee/escribe cookies para mantener la sesión.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {
            // Server Components no pueden escribir cookies — está bien,
            // el middleware se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}

/**
 * Cliente Supabase PÚBLICO (anon key, sin sesión ni cookies).
 * Para lectura del catálogo público en SSR/ISR.
 * Funciona gracias a las políticas RLS "public_read" — NO necesita service role.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Cliente Supabase con Service Role Key.
 * SOLO para operaciones administrativas en API Routes / webhooks (ej: webhook MP).
 * NUNCA exponer al cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
