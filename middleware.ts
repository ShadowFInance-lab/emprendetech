import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de autenticación y protección de rutas.
 *
 * Reglas:
 * - /dashboard/*, /inventory/*, /sales/*, /customers/*,
 *   /settings/*, /subscription/*, /onboarding → requieren sesión
 * - /login, /register, /forgot-password → redirigir si ya hay sesión
 * - /catalog/* → siempre público (SSR del catálogo)
 * - /api/webhooks/* → siempre público (webhooks externos)
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // Refrescar sesión (IMPORTANTE: no remover esto)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ─── Rutas protegidas ────────────────────────────────────
  const protectedPrefixes = [
    '/dashboard',
    '/inventory',
    '/sales',
    '/customers',
    '/settings',
    '/subscription',
    '/onboarding',
  ]

  const isProtected = protectedPrefixes.some(prefix =>
    pathname.startsWith(prefix)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // ─── Redirigir si ya está autenticado ────────────────────
  const authRoutes = ['/login', '/register', '/forgot-password']
  if (authRoutes.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ─── Onboarding guard ────────────────────────────────────
  // Si está autenticado pero no completó onboarding → forzar onboarding
  if (user && isProtected && pathname !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()

    if (profile && !profile.onboarding_done) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos)
     * - _next/image (imágenes optimizadas)
     * - favicon.ico
     * - catalog/* (catálogo público, sin auth)
     * - api/webhooks/* (webhooks externos)
     */
    '/((?!_next/static|_next/image|favicon.ico|catalog|api/webhooks).*)',
  ],
}
