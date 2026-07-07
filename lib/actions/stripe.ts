'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

    // Comisión de la plataforma por venta, según el plan del negocio:
    // gratis (y demás planes) = 4% · VIP Plus = 2.5% del total.
    // application_fee_amount va en centavos y Stripe la deposita
    // automáticamente en la cuenta de la PLATAFORMA.
    const { data: prof } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
    const feePct = prof?.plan === 'vip_plus' ? 0.025 : 0.04
    const feeCents = Math.max(1, Math.round(amount * 100 * feePct))

    const { data: cfg, error: cfgErr } = await supabase.from('store_payment_config')
      .select('stripe_account_id').eq('store_id', store.id).maybeSingle()
    if (cfgErr && isMissingCol(cfgErr)) return { success: false, error: 'Conecta tu cuenta de Stripe primero.' }
    const accountId = cfg?.stripe_account_id as string | undefined
    if (!accountId) return { success: false, error: 'Conecta tu cuenta de Stripe primero.' }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://emprendetech.vercel.app'
    const body = new URLSearchParams({
      mode: 'payment',
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
      // Destination charge: los fondos van a la cuenta conectada del comercio,
      // menos la comisión de la plataforma (application_fee_amount → tu cuenta).
      'payment_intent_data[transfer_data][destination]': accountId,
      'payment_intent_data[application_fee_amount]': String(feeCents),
      success_url: `${appUrl}/settings?stripe=ok`,
      cancel_url: `${appUrl}/settings?stripe=cancel`,
    })

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

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error('[stripe] checkout session failed', res.status, txt.slice(0, 300))
      return { success: false, error: 'Stripe rechazó la solicitud. Revisa STRIPE_SECRET_KEY y la cuenta conectada.' }
    }
    const session = await res.json()
    if (!session?.url) return { success: false, error: 'Stripe no devolvió un link de pago.' }
    return { success: true, url: session.url as string }
  } catch {
    return { success: false, error: 'No se pudo generar el link de pago' }
  }
}
