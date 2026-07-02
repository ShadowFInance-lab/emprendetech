import { NextRequest, NextResponse } from 'next/server'
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
 *   https://TU_APP/api/stripe/webhook  (evento: checkout.session.completed).
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

  const admin = createAdminClient()

  // Idempotencia: si ya registramos esta sesión, salir. Tolerante si falta la columna.
  const dup = await admin.from('sales').select('id').eq('stripe_session_id', session.id).maybeSingle()
  if (!dup.error && dup.data) { console.log('[stripe webhook] venta ya registrada para', session.id); return }

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
    stripe_session_id: session.id, notes: 'Cobro con Stripe',
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

  console.log('[stripe webhook] ✅ venta registrada', ins.data.folio, 'sesión', session.id)
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
    if (event.type === 'checkout.session.completed') {
      await registerSaleFromSession(event.data?.object as StripeSession)
    }
  } catch (err) {
    console.error('[stripe webhook] error procesando evento:', err)
    // Devolvemos 200 igual para que Stripe no reintente en bucle por un error nuestro.
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
