import { NextRequest, NextResponse } from 'next/server'
import { getMercadoPagoClient } from '@/lib/mercadopago/client'
import { createAdminClient } from '@/lib/supabase/server'
import { Payment } from 'mercadopago'
import type { Plan } from '@/lib/types'

/**
 * Webhook de Mercado Pago.
 * MP notifica aquí cuando un pago cambia de estado.
 * Documentación: https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications/webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP envía: { type: "payment", data: { id: "..." } }
    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const client = getMercadoPagoClient()
    if (!client) {
      console.error('MP webhook recibido pero MP no está configurado')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Obtener detalles del pago
    const payment = new Payment(client)
    const paymentData = await payment.get({ id: body.data.id })

    // Solo procesar pagos aprobados
    if (paymentData.status !== 'approved') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // external_reference = "userId|plan"
    const externalRef = paymentData.external_reference
    if (!externalRef || !externalRef.includes('|')) {
      console.error('external_reference inválido:', externalRef)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const [userId, plan] = externalRef.split('|') as [string, Plan]

    // Activar el plan
    const supabase = createAdminClient()

    const now = new Date()
    const periodEnd = new Date(now)
    if (plan === 'vip_plus') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 100)
    } else {
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

    // Crear suscripción
    const { data: sub } = await supabase
      .from('subscriptions')
      .insert({
        profile_id: userId,
        plan,
        status: 'active',
        provider: 'mercadopago',
        provider_sub_id: String(body.data.id),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select('id')
      .single()

    // Registrar el pago
    if (sub) {
      await supabase.from('payments').insert({
        subscription_id: sub.id,
        amount: paymentData.transaction_amount ?? 0,
        currency: 'MXN',
        status: 'succeeded',
        provider_txn_id: String(body.data.id),
      })
    }

    console.log(`✅ Plan ${plan} activado para usuario ${userId}`)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('Error procesando webhook MP:', err)
    // Devolver 200 para que MP no reintente infinitamente
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

// MP a veces hace GET para validar la URL
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
