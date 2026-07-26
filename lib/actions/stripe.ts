'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/utils/app-url'
import type { ActionResult } from './auth'

/**
 * Pagos con Stripe vía Stripe Connect (OAuth) — SIN claves manuales.
 * El comercio conecta su cuenta con OAuth (/api/oauth/stripe/*) y guardamos su
 * account_id (acct_...). Los cobros se hacen con la clave de PLATAFORMA
 * (STRIPE_SECRET_KEY en el entorno) usando destination charges hacia ese account.
 */

const isMissingCol = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /column|schema cache|stripe_/i.test(e.message ?? ''))

/** ¿Cuenta de Stripe conectada? Devuelve el account_id (no es secreto). */
export async function getStripeConfigStatus(): Promise<{ connected: boolean; accountId: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { connected: false, accountId: null }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { connected: false, accountId: null }
    const { data, error } = await supabase
      .from('store_payment_config').select('stripe_account_id').eq('store_id', store.id).maybeSingle()
    if (error && isMissingCol(error)) return { connected: false, accountId: null }
    const accountId = (data?.stripe_account_id as string) ?? null
    return { connected: !!accountId, accountId }
  } catch {
    return { connected: false, accountId: null }
  }
}

/** Desconecta la cuenta de Stripe (borra el account_id y llaves manuales legadas). */
export async function clearStripeConfigAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'No autorizado' }
    const { error } = await supabase.from('store_payment_config')
      .update({ stripe_account_id: null, stripe_publishable_key: null, stripe_secret_key: null })
      .eq('store_id', store.id)
    if (error) return { success: false, error: 'No se pudo quitar' }
    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo desconectar Stripe' }
  }
}

/**
 * Genera un link de pago (Stripe Checkout Session) con destination charge: el
 * cliente paga y el dinero va a la cuenta conectada del comercio. Usa la clave
 * de PLATAFORMA (STRIPE_SECRET_KEY), que solo vive en el servidor.
 */
export async function createStripePaymentLinkAction(
  input: {
    amount: number; concept: string; currency?: string
    /** Datos de la venta para que el webhook la registre al completarse el pago (POS). */
    sale?: {
      items: { product_id: string; quantity: number; unit_price: number; unit_cost: number }[]
      discount?: number; customerName?: string; customerPhone?: string
    }
  }
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const amount = Number(input.amount)
    if (!(amount > 0)) return { success: false, error: 'Monto inválido' }
    const concept = (input.concept || 'Pago').trim().slice(0, 120)
    const currency = (input.currency || 'mxn').toLowerCase()

    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return { success: false, error: 'Falta STRIPE_SECRET_KEY en el entorno (Vercel).' }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'No autorizado' }

    // Comisión de la plataforma por venta con tarjeta, según el plan:
    //   Gratis                → 2.5% siempre
    //   Emprendedor / Negocio → 0%
    //   VIP Plus              → 0% hasta 1,000 ventas registradas de la tienda;
    //                           desde la venta 1,001 en adelante, 2.5%
    //                           (conteo REAL total de ventas, no mensual).
    // application_fee_amount va en centavos y Stripe la deposita en la cuenta
    // de la PLATAFORMA.
    const { data: prof } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
    const plan = (prof?.plan as string) ?? 'free'
    let feePct: number
    if (plan === 'emprendedor' || plan === 'negocio' || plan === 'lifetime') {
      feePct = 0
    } else if (plan === 'vip_plus') {
      const { count } = await supabase.from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id).eq('status', 'completed')
      feePct = (count ?? 0) >= 1000 ? 0.025 : 0
    } else {
      feePct = 0.025 // Gratis
    }
    const feeCents = Math.round(amount * 100 * feePct)

    const { data: cfg, error: cfgErr } = await supabase.from('store_payment_config')
      .select('stripe_account_id').eq('store_id', store.id).maybeSingle()
    if (cfgErr && isMissingCol(cfgErr)) return { success: false, error: 'Conecta tu cuenta de Stripe primero en Configuración → Cobros con Stripe.' }
    const accountId = cfg?.stripe_account_id as string | undefined
    if (!accountId) return { success: false, error: 'Conecta tu cuenta de Stripe primero en Configuración → Cobros con Stripe.' }

    // Comprobación SUAVE de la cuenta conectada: si no es usable, NO se bloquea
    // el cobro — se cobra a la cuenta de la PLATAFORMA (destinationOk = false).
    // Antes esto devolvía error y no dejaba cobrar ("cuenta no es válida").
    let destinationOk = true
    try {
      const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      if (!acctRes.ok) {
        destinationOk = false
        console.error('[stripe] cuenta conectada no usable (', acctRes.status, ') → se cobra a la plataforma:', accountId)
      } else {
        const acct = await acctRes.json() as { charges_enabled?: boolean }
        if (!acct?.charges_enabled) {
          destinationOk = false
          console.error('[stripe] cuenta conectada sin charges_enabled → se cobra a la plataforma')
        }
      }
    } catch (e) {
      destinationOk = false
      console.error('[stripe] no se pudo verificar la cuenta; se cobra a la plataforma:', e instanceof Error ? e.message : e)
    }

    const appUrl = getAppUrl()
    const body = new URLSearchParams({
      mode: 'payment',
      // El link caduca en 1 hora: un link viejo reabierto muestra "expirado" en
      // vez del confuso "ya está pagado" de Stripe al reusar sesiones cobradas.
      expires_at: String(Math.floor(Date.now() / 1000) + 3600),
      // Pago directo: el botón dice "Pagar" (sin pasos extra tipo "reservar").
      submit_type: 'pay',
      // SOLO tarjeta: al fijar payment_method_types no aparece Link de Stripe
      // (el prompt de "guarda tus datos" con teléfono+código que parece un
      // registro) ni métodos con vale. Página mínima: correo, tarjeta y nombre
      // del titular. (El correo no se puede quitar: Stripe lo exige para el recibo.)
      'payment_method_types[0]': 'card',
      // Checkout en español de inmediato para clientes de MX/LATAM.
      locale: 'es-419',
      // Sin registro: no crea cuenta salvo que Stripe lo requiera y solo pide
      // dirección si la tarjeta lo exige. NADA se guarda automáticamente:
      // sin setup_future_usage, Stripe no almacena la tarjeta del cliente.
      customer_creation: 'if_required',
      billing_address_collection: 'auto',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': concept,
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/settings?stripe=ok`,
      cancel_url: `${appUrl}/settings?stripe=cancel`,
    })
    // Destination charge SOLO si la cuenta conectada es usable; si no, el cobro
    // entra a la plataforma y la venta se realiza igual.
    if (destinationOk) {
      body.set('payment_intent_data[transfer_data][destination]', accountId)
      // La comisión solo aplica con destino (Stripe rechaza 0 y fee sin destino).
      if (feeCents > 0) body.set('payment_intent_data[application_fee_amount]', String(feeCents))
    }

    // Metadata para que /api/stripe/webhook registre la venta cuando el pago se complete.
    body.set('metadata[source]', 'pos')
    body.set('metadata[store_id]', store.id)
    if (input.sale) {
      body.set('metadata[discount]', String(Math.max(0, input.sale.discount ?? 0)))
      if (input.sale.customerName) body.set('metadata[customer_name]', input.sale.customerName.slice(0, 200))
      if (input.sale.customerPhone) body.set('metadata[customer_phone]', input.sale.customerPhone.slice(0, 40))
      // Items compactos [[product_id, qty, unit_price, unit_cost], ...] (límite 500 chars por valor).
      const compact = input.sale.items.map(i => [i.product_id, i.quantity, i.unit_price, i.unit_cost])
      const itemsJson = JSON.stringify(compact)
      if (itemsJson.length <= 480) body.set('metadata[items]', itemsJson)
    }

    const post = (b: URLSearchParams) => fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: b,
    })
    let res = await post(body)
    if (!res.ok) {
      const txt = await res.text()
      let stripeMsg = ''
      try { stripeMsg = (JSON.parse(txt)?.error?.message as string) || '' } catch { /* no json */ }
      console.error('[stripe] checkout session failed', res.status, txt.slice(0, 400))
      // REINTENTO: si falló por la cuenta conectada (destino inválido), se cobra
      // a la plataforma para que la venta NO se quede bloqueada.
      if (/destination|account|transfer_data|application_fee/i.test(txt)) {
        console.warn('[stripe] reintentando SIN destino (cobro a la plataforma)')
        body.delete('payment_intent_data[transfer_data][destination]')
        body.delete('payment_intent_data[application_fee_amount]')
        res = await post(body)
      }
      if (!res.ok) {
        return { success: false, error: `Stripe rechazó el cobro (HTTP ${res.status})${stripeMsg ? ': ' + stripeMsg : ''}` }
      }
    }
    const session = await res.json()
    if (!session?.url) return { success: false, error: 'Stripe no devolvió un link de pago.' }
    return { success: true, url: session.url as string }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe] excepción creando el link de pago:', msg)
    return { success: false, error: `No se pudo generar el link de pago: ${msg}` }
  }
}

// ─── Checkout de PLANES (suscripción de la plataforma) ──────────────────────
// El dinero va DIRECTO a la cuenta Stripe de la PLATAFORMA (sin transfer_data).
// El webhook /api/stripe/webhook activa el plan al completarse el pago
// (metadata.type = 'plan'). Reemplaza el flujo que antes hacía Mercado Pago.
// Mantener precios en sync con PLAN_PRICES de lib/actions/subscriptions.ts.
const PLAN_CHECKOUT: Record<string, { amount: number; title: string }> = {
  emprendedor: { amount: 199, title: 'Mercanta Business — Plan Emprendedor (1 mes)' },
  negocio: { amount: 399, title: 'Mercanta Business — Plan Negocio (1 mes)' },
  vip_plus: { amount: 1599, title: 'Mercanta Business — VIP Plus (pago único)' },
}

export async function createPlanCheckoutAction(plan: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const cfg = PLAN_CHECKOUT[plan]
    if (!cfg) return { success: false, error: 'Plan no válido' }

    // Anti "ya está pagado": si el usuario YA tiene este plan pagado y vigente,
    // no generamos otro checkout (evita el doble cobro). Quien está en PRUEBA
    // gratis sí puede pagar para convertir su trial en plan pagado.
    const { data: prof } = await supabase.from('profiles')
      .select('plan, plan_status, plan_expires_at').eq('id', user.id).maybeSingle()
    if (prof?.plan === plan) {
      const enTrial = ['trial', 'trialing'].includes(String(prof.plan_status))
      const vigente = plan === 'vip_plus' ||
        (!!prof.plan_expires_at && new Date(prof.plan_expires_at as string).getTime() > Date.now())
      if (!enTrial && vigente) {
        return { success: false, error: 'Este plan ya está pagado y activo en tu cuenta. No necesitas pagarlo de nuevo.' }
      }
    }

    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return { success: false, error: 'Pagos en configuración. Falta STRIPE_SECRET_KEY en el entorno.' }

    const appUrl = getAppUrl()
    const body = new URLSearchParams({
      mode: 'payment',
      // Caduca en 1 hora (evita reusar links viejos ya cobrados).
      expires_at: String(Math.floor(Date.now() / 1000) + 3600),
      submit_type: 'pay',
      'payment_method_types[0]': 'card',
      locale: 'es-419',
      customer_creation: 'if_required',
      billing_address_collection: 'auto',
      'line_items[0][price_data][currency]': 'mxn',
      'line_items[0][price_data][product_data][name]': cfg.title,
      'line_items[0][price_data][unit_amount]': String(cfg.amount * 100),
      'line_items[0][quantity]': '1',
      'metadata[type]': 'plan',
      'metadata[user_id]': user.id,
      'metadata[plan]': plan,
      success_url: `${appUrl}/subscription?status=success`,
      cancel_url: `${appUrl}/subscription?status=failure`,
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      const txt = await res.text()
      let stripeMsg = ''
      try { stripeMsg = (JSON.parse(txt)?.error?.message as string) || '' } catch { /* no json */ }
      console.error('[stripe] plan checkout failed', res.status, txt.slice(0, 400))
      return { success: false, error: `Stripe rechazó el pago del plan (HTTP ${res.status})${stripeMsg ? ': ' + stripeMsg : ''}` }
    }
    const session = await res.json()
    if (!session?.url) return { success: false, error: 'Stripe no devolvió el checkout.' }
    return { success: true, url: session.url as string }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe] excepción en el checkout del plan:', msg)
    return { success: false, error: `No se pudo iniciar el pago del plan: ${msg}` }
  }
}
