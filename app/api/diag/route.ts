import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/utils/app-url'

// Runtime Node (fetch a Stripe) y SIEMPRE dinámico (lee el entorno en vivo).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Diagnóstico de configuración de PRODUCCIÓN — la "prueba real" que sí puedo
 * dejar corriendo sin tus secretos.
 *
 *   Ábrelo en:  https://TU_APP/api/diag
 *
 * Qué hace (sin exponer ningún secreto — solo presencia y validez):
 *  - Dice si NEXT_PUBLIC_APP_URL apunta a localhost (rompe Google Login).
 *  - Hace un PING REAL a Stripe con STRIPE_SECRET_KEY: confirma si la llave
 *    autentica de verdad (200) o el error exacto que devuelve Stripe.
 *  - Indica qué variables faltan (Supabase, Stripe, webhook).
 *
 * Seguridad: solo devuelve booleanos, hosts y un id de cuenta enmascarado.
 * Si defines DIAG_TOKEN en el entorno, exige ?token=<valor> para responder.
 */
export async function GET(req: Request) {
  const gate = process.env.DIAG_TOKEN?.trim()
  if (gate) {
    const token = new URL(req.url).searchParams.get('token')
    if (token !== gate) {
      return NextResponse.json({ ok: false, error: 'token requerido (?token=...)' }, { status: 401 })
    }
  }

  const has = (v?: string) => !!(v && v.trim())
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || ''
  const looksLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(rawAppUrl)

  // ── Stripe: ping REAL a la cuenta con la clave secreta ──
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  let stripe: Record<string, unknown> = { secretPresent: false }
  if (stripeKey) {
    const mode = stripeKey.startsWith('sk_live') ? 'live'
      : stripeKey.startsWith('sk_test') ? 'test'
      : stripeKey.startsWith('rk_') ? 'restricted' : 'desconocido'
    try {
      const r = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${stripeKey}` },
      })
      const j = await r.json().catch(() => ({} as Record<string, unknown>))
      if (r.ok) {
        stripe = {
          secretPresent: true, ok: true, mode,
          accountId: typeof j.id === 'string' ? `${j.id.slice(0, 10)}…` : null,
          chargesEnabled: (j as { charges_enabled?: boolean }).charges_enabled ?? null,
          country: (j as { country?: string }).country ?? null,
        }
      } else {
        const err = (j as { error?: { message?: string } })?.error?.message
        stripe = { secretPresent: true, ok: false, mode, status: r.status, error: err || 'la llave no autentica' }
      }
    } catch (e) {
      stripe = { secretPresent: true, ok: false, mode, error: e instanceof Error ? e.message : 'error de red al contactar Stripe' }
    }
  }

  let supaHost = ''
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    supaHost = u ? new URL(u).host : ''
  } catch { /* url inválida */ }

  return NextResponse.json(
    {
      ok: true,
      build: 'diag-v1',
      now: new Date().toISOString(),

      appUrl: {
        resuelta_por_la_app: getAppUrl(),
        NEXT_PUBLIC_APP_URL: rawAppUrl || '(sin definir)',
        apunta_a_localhost: looksLocal,
        diagnostico: looksLocal
          ? '❌ NEXT_PUBLIC_APP_URL apunta a localhost. Esto rompe Google Login y los redirects de Stripe/correo. Cámbiala en Vercel → Settings → Environment Variables a https://emprendetech.vercel.app y vuelve a desplegar.'
          : '✅ OK',
        VERCEL_URL_presente: has(process.env.VERCEL_URL),
      },

      supabase: {
        NEXT_PUBLIC_SUPABASE_URL: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
        host: supaHost,
        google_login_checklist:
          'Además del código, Google Login exige en Supabase → Authentication: (1) URL Configuration → Site URL = https://emprendetech.vercel.app; (2) Redirect URLs incluye https://emprendetech.vercel.app/auth/callback (y un comodín para previews); (3) Providers → Google ACTIVADO con Client ID/Secret; (4) en Google Cloud, Authorized redirect URI = https://' + (supaHost || '<tu-proyecto>.supabase.co') + '/auth/v1/callback.',
      },

      stripe: {
        ...stripe,
        STRIPE_WEBHOOK_SECRET_presente: has(process.env.STRIPE_WEBHOOK_SECRET),
        nota_publishable:
          'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY NO se usa en esta app (el checkout es hospedado por Stripe con la llave secreta del servidor). No la necesitas.',
        nota_flujo:
          'El botón "Pagar" necesita STRIPE_SECRET_KEY. Crear el pedido tras pagar necesita STRIPE_WEBHOOK_SECRET + el webhook registrado en Stripe (checkout.session.completed y checkout.session.async_payment_succeeded).',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
