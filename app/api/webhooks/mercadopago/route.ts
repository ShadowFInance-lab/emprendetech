import { NextRequest, NextResponse } from 'next/server'
import { getMercadoPagoClient } from '@/lib/mercadopago/client'
import { createAdminClient } from '@/lib/supabase/server'
import { Payment } from 'mercadopago'
import type { Plan } from '@/lib/types'

/**
 * Webhook de Mercado Pago.
 * Activa el plan del usuario cuando un pago queda aprobado.
 * Tolerante a los distintos formatos de notificación de MP (body JSON o query params).
 */
async function activateFromPayment(paymentId: string) {
  const client = getMercadoPagoClient()
  if (!client) {
    console.error('[WEBHOOK DEBUG] MP no configurado (falta MERCADOPAGO_ACCESS_TOKEN)')
    return
  }

  const payment = new Payment(client)
  const paymentData = await payment.get({ id: paymentId })
  console.log('[WEBHOOK DEBUG] datos del pago →', {
    id: paymentId,
    status: paymentData.status,
    external_reference: paymentData.external_reference,
    amount: paymentData.transaction_amount,
  })

  if (paymentData.status !== 'approved') {
    console.log('[WEBHOOK DEBUG] pago no aprobado todavía, status:', paymentData.status)
    return
  }

  // external_reference = "userId|plan"
  const externalRef = paymentData.external_reference
  if (!externalRef || !externalRef.includes('|')) {
    console.error('[WEBHOOK DEBUG] external_reference inválido:', externalRef)
    return
  }
  const [userId, plan] = externalRef.split('|') as [string, Plan]
  console.log('[WEBHOOK DEBUG] activando plan →', { userId, plan })

  const supabase = createAdminClient()
  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'vip_plus') periodEnd.setFullYear(periodEnd.getFullYear() + 100)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)

  // ─── Actualizar PERFIL (lo crítico) y CAPTURAR el error ───────────────────
  const { data: updated, error: updErr } = await supabase
    .from('profiles')
    .update({
      plan,
      plan_status: 'active',
      plan_expires_at: plan === 'vip_plus' ? null : periodEnd.toISOString(),
    })
    .eq('id', userId)
    .select('id, plan, plan_status')

  if (updErr) {
    console.error('[WEBHOOK DEBUG] ❌ ERROR actualizando profile:', updErr.code, updErr.message)
    console.error('[WEBHOOK DEBUG] (si dice "violates check constraint", corre la migración 019_fix_plan_check.sql)')
    return
  }
  if (!updated || updated.length === 0) {
    console.warn('[WEBHOOK DEBUG] ⚠️ 0 filas actualizadas. ¿Existe el userId? ¿SUPABASE_SERVICE_ROLE_KEY correcta?', userId)
    return
  }
  console.log('[WEBHOOK DEBUG] ✅ profile actualizado →', updated)

  // ─── Suscripción + pago (no críticos) ─────────────────────────────────────
  const { data: existing } = await supabase
    .from('subscriptions').select('id')
    .eq('profile_id', userId).eq('plan', plan).eq('status', 'active').maybeSingle()

  if (!existing) {
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        profile_id: userId, plan, status: 'active', provider: 'mercadopago',
        provider_sub_id: paymentId,
        current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
      })
      .select('id').single()
    if (subErr) console.error('[WEBHOOK DEBUG] error creando subscription (no crítico):', subErr.message)
    else if (sub) {
      const { error: payErr } = await supabase.from('payments').insert({
        subscription_id: sub.id,
        amount: paymentData.transaction_amount ?? 0,
        currency: 'MXN', status: 'succeeded', provider_txn_id: paymentId,
      })
      if (payErr) console.error('[WEBHOOK DEBUG] error registrando payment (no crítico):', payErr.message)
    }
  }

  console.log(`[WEBHOOK DEBUG] 🎉 Plan ${plan} activado para usuario ${userId}`)
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* MP a veces manda body vacío con query params */ }

    console.log('[WEBHOOK DEBUG] notificación recibida →', {
      query: Object.fromEntries(url.searchParams),
      body,
    })

    const type = (body.type as string) || url.searchParams.get('type') || url.searchParams.get('topic') || ''
    const data = body.data as { id?: string } | undefined
    const paymentId = data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || ''

    // Solo nos interesan notificaciones de pago
    if (!/payment/i.test(type) && !paymentId) {
      console.log('[WEBHOOK DEBUG] no es notificación de pago, se ignora (type:', type, ')')
      return NextResponse.json({ received: true }, { status: 200 })
    }
    if (!paymentId) {
      console.warn('[WEBHOOK DEBUG] notificación de pago sin id')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    await activateFromPayment(String(paymentId))
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[WEBHOOK DEBUG] Error procesando webhook MP:', err)
    // 200 para que MP no reintente infinitamente
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

// MP también valida/notifica por GET (IPN: ?topic=payment&id=...)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id') || url.searchParams.get('data.id')
  const topic = url.searchParams.get('topic') || url.searchParams.get('type') || ''
  if (id && /payment/i.test(topic)) {
    console.log('[WEBHOOK DEBUG] GET IPN →', { id, topic })
    try { await activateFromPayment(id) } catch (e) { console.error('[WEBHOOK DEBUG] GET activate error:', e) }
  }
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
