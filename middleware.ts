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

  // ─── Blindaje: si faltan las variables de entorno (ej: deploy sin
  // configurar), NO tumbamos toda la app con 500. Dejamos pasar el
  // request para que al menos las páginas públicas carguen.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    console.error('⚠️ Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en el entorno')
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnon,
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

  // Refrescar sesión (IMPORTANTE: no remover esto). Resiliente a errores de red.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (e) {
    console.error('Middleware: error al obtener sesión', e)
  }

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
    '/quotes',
    '/employees',
    '/orders',
    '/mensajes',
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

  // ─── Rol (Jefe / Empleado) + onboarding ──────────────────
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarding_done')
      .eq('id', user.id)
      .single()

    // Empleados y supervisores: acceso restringido al POS / ventas y a Mensajes
    if (profile?.role === 'employee' || profile?.role === 'supervisor') {
      const allowed = pathname.startsWith('/sales') || pathname.startsWith('/mensajes')
      if (!allowed) {
        return NextResponse.redirect(new URL('/sales/new', request.url))
      }
    } else if (pathname !== '/onboarding' && profile && !profile.onboarding_done) {
      // Dueños: forzar onboarding si no lo completaron
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
