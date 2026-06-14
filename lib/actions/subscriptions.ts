'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getMercadoPagoClient, isMercadoPagoConfigured, Preference } from '@/lib/mercadopago/client'
import { Payment } from 'mercadopago'
import type { Plan } from '@/lib/types'
import type { ActionResult } from './auth'

const PLAN_PRICES: Record<string, { amount: number; title: string; recurring: boolean }> = {
  emprendedor: { amount: 199, title: 'Mercanta Business — Plan Emprendedor (mensual)', recurring: true },
  negocio: { amount: 399, title: 'Mercanta Business — Plan Negocio (mensual)', recurring: true },
  vip_plus: { amount: 1599, title: 'Mercanta Business — VIP Plus (pago único)', recurring: false },
}

export interface MeteredUsage {
  salesThisMonth: number
  included: number
  extraSales: number
  feePerSale: number
  amountDue: number
}

/**
 * Calcula el uso medido del mes en curso para el plan VIP Plus:
 * cuántas ventas lleva, cuántas están incluidas (1000), y el cobro extra.
 */
export async function getMeteredUsage(): Promise<MeteredUsage> {
  const included = 1000
  const feePerSale = 0.5
  const empty: MeteredUsage = { salesThisMonth: 0, included, extraSales: 0, feePerSale, amountDue: 0 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return empty

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', monthStart)

  const salesThisMonth = count ?? 0
  const extraSales = Math.max(0, salesThisMonth - included)
  return {
    salesThisMonth,
    included,
    extraSales,
    feePerSale,
    amountDue: extraSales * feePerSale,
  }
}

/**
 * Crea una preferencia de pago en Mercado Pago y devuelve la URL de checkout.
 */
export async function createCheckoutAction(plan: Plan): Promise<ActionResult & { checkoutUrl?: string; preferenceId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  if (plan === 'free') return { success: false, error: 'El plan gratis no requiere pago' }

  const planConfig = PLAN_PRICES[plan]
  if (!planConfig) return { success: false, error: 'Plan inválido' }

  // ─── [MP DEBUG] diagnóstico de configuración (sin exponer el token) ────────
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const httpsUrl = /^https:\/\//.test(appUrl) // MP rechaza auto_return/back_urls si no son https válidos
  console.log('[MP DEBUG] createCheckoutAction →', {
    plan,
    userId: user.id,
    userEmail: user.email,
    amount: planConfig.amount,
    appUrl,
    httpsUrl,
    mpConfigured: isMercadoPagoConfigured(),
    tokenPresent: !!token,
    tokenType: token.startsWith('TEST-') ? 'test' : token.startsWith('APP_USR') ? 'produccion' : 'desconocido',
  })

  // Si MP no está configurado, devolver mensaje claro
  if (!isMercadoPagoConfigured()) {
    console.warn('[MP DEBUG] MP NO configurado: falta MERCADOPAGO_ACCESS_TOKEN en el entorno del servidor')
    return {
      success: false,
      error: 'Pagos en línea no activos. Si eres el dueño: agrega MERCADOPAGO_ACCESS_TOKEN en Vercel → Environment Variables y haz REDEPLOY (las variables solo aplican a deploys nuevos).',
    }
  }

  const client = getMercadoPagoClient()
  if (!client) {
    console.error('[MP DEBUG] getMercadoPagoClient() devolvió null')
    return { success: false, error: 'Error de configuración de pagos' }
  }

  const body = {
    items: [
      {
        id: `plan_${plan}`,
        title: planConfig.title,
        quantity: 1,
        unit_price: planConfig.amount,
        currency_id: 'MXN',
      },
    ],
    payer: { email: user.email ?? undefined },
    metadata: { user_id: user.id, plan },
    external_reference: `${user.id}|${plan}`,
    // Solo si hay URL https válida (si no, la preferencia se crea igual y abre el checkout)
    ...(httpsUrl ? {
      back_urls: {
        success: `${appUrl}/subscription?status=success`,
        failure: `${appUrl}/subscription?status=failure`,
        pending: `${appUrl}/subscription?status=pending`,
      },
      auto_return: 'approved' as const,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    } : {}),
  }
  console.log('[MP DEBUG] preference.body →', JSON.stringify(body))

  try {
    const preference = new Preference(client)
    const result = await preference.create({ body })
    console.log('[MP DEBUG] preferencia creada OK →', {
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    })
    return { success: true, checkoutUrl: result.init_point, preferenceId: result.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[MP DEBUG] preference.create FALLÓ →', msg)
    console.error('[MP DEBUG] error completo:', err)
    const cause = (err as { cause?: unknown })?.cause
    if (cause) console.error('[MP DEBUG] error.cause:', JSON.stringify(cause))
    return { success: false, error: `Mercado Pago rechazó el pago: ${msg}` }
  }
}

/**
 * Activa un plan (usado por el webhook y por la verificación de retorno).
 * Usa el cliente ADMIN (service role) para saltar RLS, y es IDEMPOTENTE:
 * no duplica la suscripción si ya hay una activa del mismo plan.
 */
export async function activatePlanForUser(userId: string, plan: Plan, providerSubId?: string): Promise<void> {
  const admin = createAdminClient()

  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'vip_plus') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 100) // pago único / vitalicio
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1) // mensual
  }

  // Actualizar perfil (idempotente)
  await admin
    .from('profiles')
    .update({
      plan,
      plan_status: 'active',
      plan_expires_at: plan === 'vip_plus' ? null : periodEnd.toISOString(),
    })
    .eq('id', userId)

  // Solo insertar suscripción si no hay una activa del mismo plan
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('profile_id', userId)
    .eq('plan', plan)
    .eq('status', 'active')
    .maybeSingle()

  if (!existing) {
    await admin.from('subscriptions').insert({
      profile_id: userId,
      plan,
      status: 'active',
      provider: 'mercadopago',
      ...(providerSubId ? { provider_sub_id: providerSubId } : {}),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
  }
}

/**
 * Verifica el pago directamente con Mercado Pago al volver del checkout
 * (back_urls). Activa el plan AUNQUE el webhook no haya llegado todavía o
 * esté mal configurado. Solo activa el plan del propio usuario logueado.
 */
export async function confirmCheckoutReturn(params: {
  payment_id?: string
  collection_id?: string
  status?: string
  collection_status?: string
}): Promise<{ activated: boolean; plan?: Plan }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { activated: false }
  if (!isMercadoPagoConfigured()) return { activated: false }

  const paymentId = params.payment_id || params.collection_id
  if (!paymentId || paymentId === 'null') return { activated: false }

  const client = getMercadoPagoClient()
  if (!client) return { activated: false }

  try {
    const payment = new Payment(client)
    const data = await payment.get({ id: paymentId })
    if (data.status !== 'approved') return { activated: false }

    const ref = data.external_reference // "userId|plan"
    if (!ref || !ref.includes('|')) return { activated: false }
    const [refUser, plan] = ref.split('|') as [string, Plan]

    // Seguridad: solo activa el plan si el pago pertenece a este usuario
    if (refUser !== user.id) return { activated: false }

    await activatePlanForUser(user.id, plan, String(paymentId))
    return { activated: true, plan }
  } catch (err) {
    console.error('confirmCheckoutReturn error:', err)
    return { activated: false }
  }
}

export async function getMercadoPagoStatus(): Promise<{ configured: boolean }> {
  return { configured: isMercadoPagoConfigured() }
}

/**
 * Genera un link de pago de Mercado Pago para una venta del POS.
 * El comercio muestra el link/QR al cliente; al aprobarse, registra la venta
 * con método "mercadopago".
 */
export async function createSalePaymentLink(
  amount: number,
  description = 'Venta'
): Promise<ActionResult & { checkoutUrl?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!amount || amount <= 0) return { success: false, error: 'Agrega productos al carrito primero' }

  if (!isMercadoPagoConfigured()) {
    return { success: false, error: 'Mercado Pago no está configurado. Agrega las variables en Vercel.' }
  }
  const client = getMercadoPagoClient()
  if (!client) return { success: false, error: 'Error de configuración de pagos' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const httpsUrl = /^https:\/\//.test(appUrl)
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
  console.log('[MP DEBUG] createSalePaymentLink →', {
    amount, appUrl, httpsUrl,
    tokenType: token.startsWith('TEST-') ? 'test' : token.startsWith('APP_USR') ? 'produccion' : 'desconocido',
  })

  const body = {
    items: [{
      id: 'venta',
      title: description.slice(0, 120),
      quantity: 1,
      unit_price: Math.round(amount * 100) / 100,
      currency_id: 'MXN',
    }],
    ...(httpsUrl ? {
      back_urls: { success: `${appUrl}/sales`, failure: `${appUrl}/sales/new`, pending: `${appUrl}/sales` },
      auto_return: 'approved' as const,
    } : {}),
  }
  console.log('[MP DEBUG] sale preference.body →', JSON.stringify(body))

  try {
    const preference = new Preference(client)
    const result = await preference.create({ body })
    console.log('[MP DEBUG] sale preferencia creada OK →', { id: result.id, init_point: result.init_point })
    return { success: true, checkoutUrl: result.init_point }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[MP DEBUG] sale preference.create FALLÓ →', msg)
    console.error('[MP DEBUG] error completo:', err)
    const cause = (err as { cause?: unknown })?.cause
    if (cause) console.error('[MP DEBUG] error.cause:', JSON.stringify(cause))
    return { success: false, error: `Mercado Pago rechazó el pago: ${msg}` }
  }
}
