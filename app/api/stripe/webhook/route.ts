import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

// Runtime de Node: se necesita `crypto` y el body CRUDO para verificar la firma.
export const runtime = 'nodejs'

/**
 * Webhook de Stripe: registra la venta en el POS cuando un Checkout se paga.
 * - Verifica la firma con STRIPE_WEBHOOK_SECRET (esquema oficial, sin SDK).
 * - En `checkout.session.completed` (pagado) crea la venta y sus items (los
 *   triggers de Postgres descuentan stock) con la metadata del Checkout.
 * - Idempotente por `session.id` (columna sales.stripe_session_id, migración 048).
 *
 * Configuración: Stripe Dashboard → Developers → Webhooks → endpoint
 *   https://TU_APP/api/stripe/webhook  (eventos: checkout.session.completed y
 *   checkout.session.async_payment_succeeded para pagos diferidos tipo OXXO).
 * Copia el "Signing secret" (whsec_...) a STRIPE_WEBHOOK_SECRET en Vercel.
 */

// Firma de Stripe. Header: "t=<timestamp>,v1=<sig>[,v1=<sig2>]".
function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const parts = header.split(',').map(p => p.split('='))
  const t = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || sigs.length === 0) return false
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex')
  const expBuf = Buffer.from(expected)
  return sigs.some(s => {
    const sBuf = Buffer.from(s)
    return sBuf.length === expBuf.length && timingSafeEqual(sBuf, expBuf)
  })
}

interface StripeSession {
  id: string
  amount_total?: number | null
  payment_status?: string
  metadata?: Record<string, string> | null
}

async function registerSaleFromSession(session: StripeSession) {
  if (session.payment_status && session.payment_status !== 'paid') return
  const meta = session.metadata || {}
  const storeId = meta.store_id
  if (!storeId) { console.warn('[stripe webhook] sesión sin store_id, no se registra:', session.id); return }
  // Solo auto-registra ventas de checkouts que traen los items del carrito.
  // Los cobros libres (widget "Cobro rápido con Stripe") NO se auto-registran:
  // el cajero registra la venta con el botón "Cobrar" del POS — así no se duplica.
  if (!meta.items) { console.log('[stripe webhook] sesión sin items (cobro libre), no se registra venta:', session.id); return }

  const admin = createAdminClient()

  // Idempotencia: si ya registramos esta sesión, salir (Stripe reintenta eventos).
  const dup = await admin.from('sales').select('id').eq('stripe_session_id', session.id).maybeSingle()
  if (!dup.error) {
    if (dup.data) { console.log('[stripe webhook] venta ya registrada para', session.id); return }
  } else {
    // Sin la columna stripe_session_id (migración 048 no corrida): respaldo por la
    // nota de la venta, que incluye el id de la sesión — evita duplicados igual.
    const byNote = await admin.from('sales').select('id')
      .eq('store_id', storeId).ilike('notes', `%${session.id}%`).limit(1)
    if (byNote.data && byNote.data.length > 0) { console.log('[stripe webhook] venta ya registrada (por nota) para', session.id); return }
  }

  const amountTotal = (session.amount_total ?? 0) / 100
  const discount = Math.max(0, Number(meta.discount) || 0)

  // Items desde metadata: [[product_id, qty, unit_price, unit_cost], ...]
  interface Line { product_id: string; quantity: number; unit_price: number; unit_cost: number; product_name: string }
  let items: Line[] = []
  if (meta.items) {
    try {
      const compact = JSON.parse(meta.items) as [string, number, number, number][]
      const ids = compact.map(c => c[0])
      const { data: prods } = await admin.from('products').select('id, name').in('id', ids)
      const nameMap = new Map((prods ?? []).map(p => [p.id, p.name] as [string, string]))
      items = compact.map(c => ({
        product_id: c[0], quantity: Number(c[1]) || 0, unit_price: Number(c[2]) || 0, unit_cost: Number(c[3]) || 0,
        product_name: nameMap.get(c[0]) ?? 'Producto',
      }))
    } catch (e) { console.error('[stripe webhook] items inválidos en metadata:', e) }
  }

  const subtotal = items.length ? items.reduce((s, i) => s + i.unit_price * i.quantity, 0) : amountTotal + discount
  const total = items.length ? Math.max(0, subtotal - discount) : amountTotal
  const totalCost = items.reduce((s, i) => s + i.unit_cost * i.quantity, 0)
  const profit = total - totalCost

  // Cliente (opcional)
  let customerId: string | null = null
  if (meta.customer_name && meta.customer_name.trim()) {
    const { data: customer } = await admin.from('customers')
      .insert({ store_id: storeId, name: meta.customer_name.trim(), phone: meta.customer_phone?.trim() || null })
      .select('id').single()
    customerId = customer?.id ?? null
  }

  // Crear la venta (el folio lo genera el trigger). Resiliente si falta stripe_session_id.
  const salePayload: Record<string, unknown> = {
    store_id: storeId, customer_id: customerId, folio: 'TEMP',
    subtotal, discount_amt: discount, total, total_cost: totalCost, profit,
    payment_method: 'card', via_mercadopago: false, status: 'completed',
    // La nota lleva el id de la sesión: trazabilidad en el historial y respaldo
    // de idempotencia cuando falta la columna stripe_session_id.
    stripe_session_id: session.id, notes: `Cobro con Stripe · ${session.id}`,
  }
  let ins = await admin.from('sales').insert(salePayload).select('id, folio').single()
  if (ins.error && /stripe_session_id|column|schema cache/i.test(ins.error.message || '')) {
    delete salePayload.stripe_session_id
    ins = await admin.from('sales').insert(salePayload).select('id, folio').single()
  }
  if (ins.error || !ins.data) { console.error('[stripe webhook] error creando venta:', ins.error?.message); return }

  // Items (los triggers descuentan stock)
  if (items.length) {
    const { error: itemsErr } = await admin.from('sale_items').insert(items.map(i => ({
      sale_id: ins.data!.id, product_id: i.product_id, product_name: i.product_name,
      quantity: i.quantity, unit_price: i.unit_price, unit_cost: i.unit_cost,
      subtotal: i.unit_price * i.quantity,
    })))
    if (itemsErr) console.error('[stripe webhook] error insertando items (venta creada sin líneas):', itemsErr.message)
  }

  // Refresca las páginas cacheadas para que la venta aparezca al instante.
  revalidatePath('/sales'); revalidatePath('/dashboard'); revalidatePath('/inventory')

  console.log('[stripe webhook] ✅ venta registrada', ins.data.folio, 'sesión', session.id)
}

// ─── Activación de PLANES (metadata.type = 'plan') ──────────────────────────
// Espejo del webhook de Mercado Pago: al pagarse el checkout del plan, activa
// el plan del usuario (profiles) y registra subscription + payment.
const VALID_PLANS = ['emprendedor', 'negocio', 'vip_plus']

async function activatePlanFromSession(session: StripeSession) {
  if (session.payment_status && session.payment_status !== 'paid') return
  const meta = session.metadata || {}
  const userId = meta.user_id
  const plan = meta.plan
  if (!userId || !plan || !VALID_PLANS.includes(plan)) {
    console.warn('[stripe webhook] sesión de plan sin user_id/plan válidos:', session.id)
    return
  }

  const admin = createAdminClient()

  // Idempotencia: una subscription por sesión de checkout.
  const { data: existing } = await admin.from('subscriptions')
    .select('id').eq('provider_sub_id', session.id).maybeSingle()
  if (existing) { console.log('[stripe webhook] plan ya activado para sesión', session.id); return }

  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'vip_plus') periodEnd.setFullYear(periodEnd.getFullYear() + 100)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)

  const { error: updErr } = await admin.from('profiles').update({
    plan,
    plan_status: 'active',
    plan_expires_at: plan === 'vip_plus' ? null : periodEnd.toISOString(),
  }).eq('id', userId)
  if (updErr) { console.error('[stripe webhook] error activando plan:', updErr.message); return }

  const { data: sub, error: subErr } = await admin.from('subscriptions').insert({
    profile_id: userId, plan, status: 'active', provider: 'stripe',
    provider_sub_id: session.id,
    current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
  }).select('id').single()
  if (subErr) console.error('[stripe webhook] error creando subscription (no crítico):', subErr.message)
  else if (sub) {
    const { error: payErr } = await admin.from('payments').insert({
      subscription_id: sub.id, amount: (session.amount_total ?? 0) / 100,
      currency: 'MXN', status: 'succeeded', provider_txn_id: session.id,
    })
    if (payErr) console.error('[stripe webhook] error registrando payment (no crítico):', payErr.message)
  }

  revalidatePath('/subscription'); revalidatePath('/dashboard')
  console.log('[stripe webhook] ✅ plan', plan, 'activado para', userId)
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe webhook] falta STRIPE_WEBHOOK_SECRET en el entorno')
    return NextResponse.json({ error: 'webhook no configurado' }, { status: 400 })
  }

  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!verifyStripeSignature(payload, sig, secret)) {
    console.error('[stripe webhook] firma inválida')
    return NextResponse.json({ error: 'firma inválida' }, { status: 400 })
  }

  let event: { type?: string; data?: { object?: unknown } }
  try { event = JSON.parse(payload) } catch { return NextResponse.json({ error: 'payload inválido' }, { status: 400 }) }

  try {
    // completed = pago inmediato (tarjeta). async_payment_succeeded = métodos
    // diferidos: completed llega con payment_status 'unpaid' y el pago real se
    // confirma después. La idempotencia por session.id evita duplicados.
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data?.object as StripeSession
      // metadata.type='plan' → suscripción de la plataforma; si no, venta del POS.
      if (session?.metadata?.type === 'plan') await activatePlanFromSession(session)
      else await registerSaleFromSession(session)
    }
  } catch (err) {
    console.error('[stripe webhook] error procesando evento:', err)
    // Devolvemos 200 igual para que Stripe no reintente en bucle por un error nuestro.
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
