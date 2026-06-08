'use server'

import { createClient } from '@/lib/supabase/server'
import { getMercadoPagoClient, isMercadoPagoConfigured, Preference } from '@/lib/mercadopago/client'
import type { Plan } from '@/lib/types'
import type { ActionResult } from './auth'

const PLAN_PRICES: Record<string, { amount: number; title: string; recurring: boolean }> = {
  emprendedor: { amount: 199, title: 'EmprendeTech — Plan Emprendedor (mensual)', recurring: true },
  negocio: { amount: 399, title: 'EmprendeTech — Plan Negocio (mensual)', recurring: true },
  vip_plus: { amount: 1599, title: 'EmprendeTech — VIP Plus (pago único)', recurring: false },
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

  // Si MP no está configurado, devolver mensaje claro
  if (!isMercadoPagoConfigured()) {
    return {
      success: false,
      error: 'Pagos en línea no activos. Si eres el dueño: agrega MERCADOPAGO_ACCESS_TOKEN en Vercel → Environment Variables y haz REDEPLOY (las variables solo aplican a deploys nuevos).',
    }
  }

  const client = getMercadoPagoClient()
  if (!client) return { success: false, error: 'Error de configuración de pagos' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const preference = new Preference(client)
    const result = await preference.create({
      body: {
        items: [
          {
            id: `plan_${plan}`,
            title: planConfig.title,
            quantity: 1,
            unit_price: planConfig.amount,
            currency_id: 'MXN',
          },
        ],
        payer: {
          email: user.email ?? undefined,
        },
        metadata: {
          user_id: user.id,
          plan,
        },
        external_reference: `${user.id}|${plan}`,
        back_urls: {
          success: `${appUrl}/subscription?status=success`,
          failure: `${appUrl}/subscription?status=failure`,
          pending: `${appUrl}/subscription?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
      },
    })

    return { success: true, checkoutUrl: result.init_point, preferenceId: result.id }
  } catch (err) {
    console.error('Error creando preferencia MP:', err)
    return { success: false, error: 'Error al generar el pago. Intenta de nuevo.' }
  }
}

/**
 * Activa un plan manualmente (usado por webhook o admin).
 */
export async function activatePlanForUser(userId: string, plan: Plan): Promise<void> {
  const supabase = await createClient()

  const now = new Date()
  const periodEnd = new Date(now)

  if (plan === 'vip_plus') {
    // Vitalicio: 100 años
    periodEnd.setFullYear(periodEnd.getFullYear() + 100)
  } else {
    // Mensual: +1 mes
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  // Actualizar perfil
  await supabase
    .from('profiles')
    .update({
      plan,
      plan_status: 'active',
      plan_expires_at: plan === 'vip_plus' ? null : periodEnd.toISOString(),
    })
    .eq('id', userId)

  // Crear/actualizar suscripción
  await supabase.from('subscriptions').insert({
    profile_id: userId,
    plan,
    status: 'active',
    provider: 'mercadopago',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
  })
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const preference = new Preference(client)
    const result = await preference.create({
      body: {
        items: [{
          id: 'venta',
          title: description.slice(0, 120),
          quantity: 1,
          unit_price: Math.round(amount * 100) / 100,
          currency_id: 'MXN',
        }],
        back_urls: {
          success: `${appUrl}/sales`,
          failure: `${appUrl}/sales/new`,
          pending: `${appUrl}/sales`,
        },
        auto_return: 'approved',
      },
    })
    return { success: true, checkoutUrl: result.init_point }
  } catch (err) {
    console.error('Error creando link de pago de venta:', err)
    return { success: false, error: 'No se pudo generar el link de pago. Intenta de nuevo.' }
  }
}
