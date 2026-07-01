'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

/**
 * Pagos con Stripe de la TIENDA (para generar links de pago de las ventas).
 * La Secret Key vive server-side (store_payment_config) y NUNCA se devuelve al
 * cliente: getStripeConfigStatus solo expone si está configurada + la Publishable
 * Key (que es pública por diseño). La Secret solo se usa en estas server actions.
 */

const isMissingCol = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /column|schema cache|stripe_/i.test(e.message ?? ''))

/** ¿Stripe configurado? Devuelve la Publishable Key (pública) pero NUNCA la Secret. */
export async function getStripeConfigStatus(): Promise<{ configured: boolean; publishableKey: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { configured: false, publishableKey: null }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { configured: false, publishableKey: null }
    const { data, error } = await supabase
      .from('store_payment_config')
      .select('stripe_publishable_key, stripe_secret_key')
      .eq('store_id', store.id).maybeSingle()
    if (error && isMissingCol(error)) return { configured: false, publishableKey: null }
    return {
      configured: !!data?.stripe_secret_key,
      publishableKey: (data?.stripe_publishable_key as string) ?? null,
    }
  } catch {
    return { configured: false, publishableKey: null }
  }
}

/** Guarda las llaves de Stripe del comercio (Publishable + Secret). */
export async function saveStripeConfigAction(publishableKey: string, secretKey: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const pk = publishableKey.trim()
    const sk = secretKey.trim()
    if (!pk.startsWith('pk_')) return { success: false, error: 'La Publishable Key debe empezar con pk_test_ o pk_live_.' }
    if (!(sk.startsWith('sk_') || sk.startsWith('rk_'))) return { success: false, error: 'La Secret Key debe empezar con sk_test_ o sk_live_.' }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'Solo el dueño puede configurar los pagos' }

    const { error } = await supabase.from('store_payment_config').upsert({
      store_id: store.id,
      stripe_publishable_key: pk,
      stripe_secret_key: sk,
      updated_at: new Date().toISOString(),
    })
    if (error) return { success: false, error: isMissingCol(error) ? 'Corre la migración 046 en Supabase (columnas de Stripe).' : 'No se pudo guardar' }
    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo guardar la configuración de Stripe' }
  }
}

/** Desconecta Stripe (borra ambas llaves). */
export async function clearStripeConfigAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'No autorizado' }
    const { error } = await supabase.from('store_payment_config')
      .update({ stripe_publishable_key: null, stripe_secret_key: null }).eq('store_id', store.id)
    if (error) return { success: false, error: 'No se pudo quitar' }
    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo desconectar Stripe' }
  }
}

/**
 * Genera un link de pago de Stripe (Checkout Session) con la Secret Key del
 * comercio. Devuelve la URL para compartir con el cliente. La Secret nunca sale
 * del servidor.
 */
export async function createStripePaymentLinkAction(
  input: { amount: number; concept: string; currency?: string }
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const amount = Number(input.amount)
    if (!(amount > 0)) return { success: false, error: 'Monto inválido' }
    const concept = (input.concept || 'Pago').trim().slice(0, 120)
    const currency = (input.currency || 'mxn').toLowerCase()

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'No autorizado' }

    const { data: cfg, error: cfgErr } = await supabase.from('store_payment_config')
      .select('stripe_secret_key').eq('store_id', store.id).maybeSingle()
    if (cfgErr && isMissingCol(cfgErr)) return { success: false, error: 'Configura y guarda tus llaves de Stripe primero.' }
    const secret = cfg?.stripe_secret_key as string | undefined
    if (!secret) return { success: false, error: 'Configura y guarda tus llaves de Stripe primero.' }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://emprendetech.vercel.app'
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': concept,
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/settings?stripe=ok`,
      cancel_url: `${appUrl}/settings?stripe=cancel`,
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error('[stripe] checkout session failed', res.status, txt.slice(0, 300))
      return { success: false, error: 'Stripe rechazó la solicitud. Revisa que la Secret Key sea válida.' }
    }
    const session = await res.json()
    if (!session?.url) return { success: false, error: 'Stripe no devolvió un link de pago.' }
    return { success: true, url: session.url as string }
  } catch {
    return { success: false, error: 'No se pudo generar el link de pago' }
  }
}
