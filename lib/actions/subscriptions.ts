'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getMercadoPagoClient, getMercadoPagoClientFor, isMercadoPagoConfigured, Preference } from '@/lib/mercadopago/client'
import { Payment } from 'mercadopago'
import type { Plan } from '@/lib/types'
import type { ActionResult } from './auth'

const PLAN_PRICES: Record<string, { amount: number; title: string; recurring: boolean }> = {
  emprendedor: { amount: 199, title: 'Mercanta Business — Plan Emprendedor (mensual)', recurring: true },
  negocio: { amount: 399, title: 'Mercanta Business — Plan Negocio (mensual)', recurring: true },
  vip_plus: { amount: 1599, title: 'Mercanta Business — VIP Plus (pago único)', recurring: false },
}

/**
 * Baja a Gratis los planes mensuales vencidos: fin de la prueba gratis de
 * 5 días o mes pagado no renovado. Se llama al cargar dashboard/ventas/
 * suscripción. Solo aplica a emprendedor/negocio con fecha de vencimiento;
 * vip_plus es de por vida (plan_expires_at null) y no se toca.
 */
export async function ensurePlanCurrentAction(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Lectura resiliente: si created_at/role no existieran, cae al select mínimo
    // (y solo se omite el respaldo del trial, nunca el vencimiento).
    let p: { plan?: string; plan_expires_at?: string | null; created_at?: string | null; role?: string | null } | null = null
    const sel = await supabase.from('profiles')
      .select('plan, plan_expires_at, created_at, role').eq('id', user.id).maybeSingle()
    if (sel.error) {
      const r2 = await supabase.from('profiles').select('plan, plan_expires_at').eq('id', user.id).maybeSingle()
      p = r2.data
    } else p = sel.data
    if (!p) return
    const plan = p.plan as string

    // RESPALDO del trial ("forzar"): si el perfil es recién creado (<24 h) y
    // sigue en 'free', el otorgamiento del registro/trigger falló (p. ej. sin
    // SUPABASE_SERVICE_ROLE_KEY o migración 043 no aplicada) — se auto-otorga
    // aquí con la sesión del propio usuario. Empleados fuera; cuentas viejas no.
    // plan_status CHECK: active|expired|cancelled|trial (NO 'trialing').
    const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000
    if (
      plan === 'free' && !p.plan_expires_at && p.role !== 'employee' &&
      p.created_at && Date.now() - new Date(p.created_at).getTime() < NEW_ACCOUNT_MS
    ) {
      const ends = new Date(Date.now() + 5 * 86400000).toISOString()
      let g = await supabase.from('profiles')
        .update({ plan: 'emprendedor', plan_status: 'trial', plan_expires_at: ends })
        .eq('id', user.id).eq('plan', 'free')
      if (g.error) {
        g = await supabase.from('profiles')
          .update({ plan: 'emprendedor', plan_status: 'active', plan_expires_at: ends })
          .eq('id', user.id).eq('plan', 'free')
      }
      if (!g.error) revalidatePath('/subscription')
      return
    }
    if (plan !== 'emprendedor' && plan !== 'negocio') return
    if (!p.plan_expires_at) return
    if (new Date(p.plan_expires_at as string).getTime() >= Date.now()) return
    let r = await supabase.from('profiles')
      .update({ plan: 'free', plan_status: 'expired', plan_expires_at: null }).eq('id', user.id)
    // Si plan_status tiene un CHECK que no admite 'expired', reintenta sin él.
    if (r.error) {
      r = await supabase.from('profiles').update({ plan: 'free', plan_expires_at: null }).eq('id', user.id)
    }
    if (!r.error) revalidatePath('/subscription')
  } catch { /* mejor no bloquear la página por esto */ }
}

// ========================================================
// TARJETAS DE PRUEBA MERCADO PAGO (SANDBOX - MXN)
// ========================================================
// Estas tarjetas hacen que el botón "Pagar" funcione (no gris) en modo test.
// Usa SIEMPRE email de comprador de prueba en el payer de la preferencia.
//
// Visa:          4509 9535 6623 3704   | CVV 123 | fecha futura (ej 11/30)
// Mastercard:    5031 7557 3453 0604   | CVV 123 | fecha futura
// Amex:          3711 803032 57522     | CVV 1234| fecha futura
// (Otras: ver dashboard MP Sandbox > Test accounts > Tarjetas)
//
// Email comprador prueba recomendado: test_user_12345678@testuser.com
// ========================================================

export interface MeteredUsage {
  salesThisMonth: number
  included: number
  extraSales: number
  feePerSale: number
  amountDue: number
}

/**
 * Calcula el uso medido del mes en curso para el plan VIP Plus:
 * (solo ventas del mes; comisión $0.50 solo aplica a VIP Plus después de las primeras 1,000 ventas).
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
    // Payer con email de PRUEBA (sandbox) — evita botón "Pagar" gris en MP
    // Usa un email de comprador de prueba de tu cuenta MP Sandbox
    payer: { email: 'test_user_12345678@testuser.com' },
    metadata: { user_id: user.id, plan },
    external_reference: `${user.id}|${plan}`,
    // installments + payment_methods para habilitar cuotas y métodos de pago en test
    payment_methods: {
      installments: 12,
      excluded_payment_methods: [],
      excluded_payment_types: [],
    },
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

  // Actualizar perfil (idempotente) — capturamos el error para diagnosticar
  const { data: updated, error: updErr } = await admin
    .from('profiles')
    .update({
      plan,
      plan_status: 'active',
      plan_expires_at: plan === 'vip_plus' ? null : periodEnd.toISOString(),
    })
    .eq('id', userId)
    .select('id, plan, plan_status')
  if (updErr) {
    console.error('[WEBHOOK DEBUG] activatePlanForUser ❌ error actualizando profile:', updErr.code, updErr.message)
    console.error('[WEBHOOK DEBUG] (si es check constraint, corre 019_fix_plan_check.sql)')
  } else {
    console.log('[WEBHOOK DEBUG] activatePlanForUser ✅ profile →', updated)
  }

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

/**
 * Activa Modo Gratis simple (para usuarios VIP Plus).
 * Cambia plan a "free" y da acceso completo a todas las funciones sin cobro.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function activateFreeModeAction(_formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Activar Modo Gratis simple: cambiar a "free" con acceso completo (para VIP Plus)
  const { error } = await supabase.from('profiles').update({
    plan: 'free',
    plan_status: 'active',
    plan_expires_at: null,
  }).eq('id', user.id)

  if (error) {
    console.error('activateFreeModeAction error:', error)
    return
  }

  revalidatePath('/subscription')
  revalidatePath('/dashboard')
  revalidatePath('/settings')
  revalidatePath('/sales')
}

export async function getMercadoPagoStatus(): Promise<{ configured: boolean }> {
  return { configured: isMercadoPagoConfigured() }
}

/** Token de Mercado Pago de la tienda (propia o del jefe) para cobrar ventas. */
async function getStoreSaleToken(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    let storeId: string | null = null
    const { data: own } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (own) storeId = own.id
    else {
      const { data: prof } = await supabase.from('profiles').select('boss_id').eq('id', user.id).maybeSingle()
      if (prof?.boss_id) {
        const { data: bs } = await supabase.from('stores').select('id').eq('owner_id', prof.boss_id).maybeSingle()
        storeId = bs?.id ?? null
      }
    }
    if (!storeId) return null
    const { data: cfg } = await supabase
      .from('store_payment_config').select('mercadopago_access_token').eq('store_id', storeId).maybeSingle()
    return cfg?.mercadopago_access_token ?? null
  } catch {
    return null
  }
}

/**
 * Genera un link de pago de Mercado Pago para una venta del POS.
 * Usa la cuenta de Mercado Pago de la TIENDA (no la de la plataforma).
 */
export async function createSalePaymentLink(
  amount: number,
  description = 'Venta'
): Promise<ActionResult & { checkoutUrl?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!amount || amount <= 0) return { success: false, error: 'Agrega productos al carrito primero' }

  // Token de la TIENDA para ventas (si está configurado); si no, el de la plataforma
  const storeToken = await getStoreSaleToken(supabase)
  const client = getMercadoPagoClientFor(storeToken)
  if (!client) {
    return { success: false, error: 'Configura tu cuenta de Mercado Pago para ventas en Configuración (o agrega MERCADOPAGO_ACCESS_TOKEN en Vercel).' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const httpsUrl = /^https:\/\//.test(appUrl)
  console.log('[MP DEBUG] createSalePaymentLink →', {
    amount, appUrl, httpsUrl,
    cuenta: storeToken ? 'tienda' : 'plataforma(env)',
  })

  const body = {
    items: [{
      id: 'venta',
      title: description.slice(0, 120),
      quantity: 1,
      unit_price: Math.round(amount * 100) / 100,
      currency_id: 'MXN',
    }],
    // Payer con email de PRUEBA (sandbox) — arregla botón "Pagar" gris
    payer: { email: 'test_user_12345678@testuser.com' },
    // installments + payment_methods habilitan cuotas y tarjetas de prueba
    payment_methods: {
      installments: 12,
      excluded_payment_methods: [],
      excluded_payment_types: [],
    },
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
