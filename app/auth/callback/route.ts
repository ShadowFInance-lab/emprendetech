import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { grantTrialIfNewProfile } from '@/lib/actions/auth'

/**
 * Callback de OAuth (Google / Facebook) y de los enlaces de correo.
 * Supabase redirige aquí con un ?code que intercambiamos por una sesión.
 *
 * FIX v7.122 — "después de Google me manda al inicio y tengo que iniciar sesión
 * de nuevo": la sesión no persistía porque las cookies que setea
 * exchangeCodeForSession no quedaban GARANTIZADAS en la respuesta del redirect,
 * así que el middleware veía "sin sesión" y rebotaba. Ahora:
 *  1. Acumulamos las cookies de sesión y las adjuntamos EXPLÍCITAMENTE a la
 *     respuesta de redirect final (persistencia garantizada).
 *  2. Con sesión válida SIEMPRE vamos a /dashboard (o /onboarding si es nuevo),
 *     NUNCA a la landing pública ni a /login.
 *  3. Logs detallados en cada paso para diagnóstico en Vercel.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Destino tras loguear. NUNCA la landing pública ni /login: si `next` apunta
  // ahí (o no es una ruta interna), lo forzamos a /dashboard.
  let next = searchParams.get('next') ?? '/dashboard'
  if (!next.startsWith('/') || next === '/' || next.startsWith('/login') || next.startsWith('/register')) {
    next = '/dashboard'
  }

  const providerErr = searchParams.get('error_description') || searchParams.get('error')
  if (providerErr) console.error('[oauth callback] el proveedor devolvió error:', providerErr)

  if (!code) {
    console.error('[oauth callback] llegó SIN ?code (cancelación del usuario o config de redirect).')
    return NextResponse.redirect(`${origin}/login?error=oauth_nocode`)
  }

  // Acumulador de cookies de sesión → se adjuntan a la respuesta de redirect.
  type PendingCookie = { name: string; value: string; options?: Record<string, unknown> }
  const pending: PendingCookie[] = []
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: PendingCookie[]) => {
          toSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]) } catch { /* SC no escribe */ }
            pending.push({ name, value, options })
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[oauth callback] exchangeCodeForSession FALLÓ:', error.message)
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('[oauth callback] exchange sin error pero getUser() vacío (sesión no establecida).')
    return NextResponse.redirect(`${origin}/login?error=oauth_nosession`)
  }

  // Prueba gratis para perfiles nuevos (idempotente; no bloquea el login).
  try { await grantTrialIfNewProfile(user.id) } catch (e) { console.error('[oauth callback] grantTrial (no crítico):', e) }

  // ¿Completó onboarding? Si no, a crear su tienda; si sí, al destino interno.
  const { data: profile } = await supabase.from('profiles').select('onboarding_done').eq('id', user.id).maybeSingle()
  const dest = profile?.onboarding_done ? next : '/onboarding'
  console.log('[oauth callback] ✅ sesión iniciada · user', user.id, '· →', dest)

  // Redirect final CON las cookies de sesión adjuntas (persistencia garantizada).
  const res = NextResponse.redirect(`${origin}${dest}`)
  pending.forEach(({ name, value, options }) =>
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]),
  )
  return res
}
