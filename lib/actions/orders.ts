'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createPublicClient, createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/constants/orders'
import { getAppUrl } from '@/lib/utils/app-url'
import { sendEmail } from '@/lib/utils/email'
import { trackingUrl, buildShipWhatsApp, buildShipmentEmailHtml } from '@/lib/utils/shipping'

export type { OrderStatus }

export interface StatusHistoryEntry {
  status: string
  at: string
  tracking_number?: string
  shipping_carrier?: string
}

export interface OnlineOrder {
  id: string
  order_no: string | null
  customer_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  payment_method: string | null
  items: { name: string; price: number; qty: number }[] | null
  total: number | null
  status: OrderStatus
  created_at: string
  online_reception_type?: string | null
  online_reception_value?: string | null
  // Indicadores de pago (migración 053). Opcionales por compatibilidad.
  payment_status?: string | null
  stripe_payment_intent?: string | null
  paid_at?: string | null
  // Seguimiento / envío (migración 054).
  tracking_number?: string | null
  shipping_carrier?: string | null
  shipped_at?: string | null
  status_history?: StatusHistoryEntry[] | null
}

// Un pedido cuenta como "pagado" si Stripe lo confirmó (payment_status='paid')
// o —para filas antiguas sin esa columna— si su estado ya pasó del pendiente.
const PAID_FULFILLMENT = ['pagado', 'preparando', 'enviado', 'entregado']
function isPaidOrder(o: { payment_status?: string | null; status: string }): boolean {
  if (o.payment_status) return o.payment_status === 'paid'
  return PAID_FULFILLMENT.includes(o.status)
}

export interface OnlineOrderInput {
  store_id: string
  customer_name: string
  phone: string
  email?: string
  address: string
  city?: string
  state?: string
  zip?: string
  notes?: string
  payment_method: string
  items?: unknown
  total?: number
}

/** Crea un pedido online desde el catálogo público (visitante anónimo). */
export async function createOnlineOrderAction(input: OnlineOrderInput): Promise<ActionResult> {
  try {
    if (!input.customer_name.trim() || !input.phone.trim() || !input.address.trim()) {
      return { success: false, error: 'Nombre, teléfono y dirección son obligatorios' }
    }
    const supabase = createPublicClient()
    const { error } = await supabase.from('online_orders').insert({
      store_id: input.store_id,
      customer_name: input.customer_name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address: input.address.trim(),
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
      notes: input.notes?.trim() || null,
      payment_method: input.payment_method || null,
      items: input.items ?? null,
      total: input.total ?? null,
    })
    if (error) return { success: false, error: 'No se pudo enviar el pedido (¿migración 037?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Lista los pedidos online de la tienda del dueño (solo los suyos por RLS). */
export async function listOnlineOrdersAction(): Promise<OnlineOrder[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
    if (!store) return []
    const { data, error } = await supabase.from('online_orders').select('*')
      .eq('store_id', store.id).order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []).map(o => ({
      id: o.id as string,
      order_no: (o.order_no as string) ?? null,
      customer_name: o.customer_name ?? null, phone: o.phone ?? null, email: o.email ?? null,
      address: o.address ?? null, city: o.city ?? null, state: o.state ?? null, zip: o.zip ?? null,
      notes: o.notes ?? null, payment_method: o.payment_method ?? null,
      items: (o.items as OnlineOrder['items']) ?? null, total: o.total == null ? null : Number(o.total),
      status: (o.status as OrderStatus) ?? 'pendiente', created_at: o.created_at as string,
      online_reception_type: (o.online_reception_type as string) ?? null,
      online_reception_value: (o.online_reception_value as string) ?? null,
      payment_status: (o.payment_status as string) ?? null,
      stripe_payment_intent: (o.stripe_payment_intent as string) ?? null,
      paid_at: (o.paid_at as string) ?? null,
      tracking_number: (o.tracking_number as string) ?? null,
      shipping_carrier: (o.shipping_carrier as string) ?? null,
      shipped_at: (o.shipped_at as string) ?? null,
      status_history: (o.status_history as StatusHistoryEntry[]) ?? null,
    }))
    // REGLA: Ventas Online SOLO muestra pedidos con pago confirmado por Stripe.
    // (En el flujo pago-primero ya nunca se crean pedidos sin pagar; el filtro
    // además oculta cualquier pedido "pendiente" heredado del flujo anterior.)
      .filter(isPaidOrder)
  } catch { return [] }
}

/**
 * Cambia el estado de un pedido. Al marcar "enviado" guarda la guía, la
 * paquetería y la fecha de envío, agrega el cambio al historial, envía un correo
 * automático al cliente (si tiene) y devuelve un mensaje de WhatsApp listo para
 * copiar. Resiliente si la migración 054 no se corrió (reintenta sin columnas).
 */
export async function updateOnlineOrderStatusAction(
  id: string,
  status: OrderStatus,
  tracking?: { trackingNumber?: string; carrier?: string },
): Promise<ActionResult & { whatsapp?: string }> {
  try {
    if (!ORDER_STATUSES.includes(status)) return { success: false, error: 'Estado inválido' }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: store } = await supabase.from('stores').select('id, name').eq('owner_id', user.id).single()
    if (!store) return { success: false, error: 'Sin tienda' }

    // Pedido actual (para historial + correo + WhatsApp).
    const { data: order } = await supabase.from('online_orders')
      .select('*').eq('id', id).eq('store_id', store.id).maybeSingle()
    if (!order) return { success: false, error: 'Pedido no encontrado' }

    const now = new Date().toISOString()
    const history: StatusHistoryEntry[] = Array.isArray(order.status_history) ? order.status_history : []
    const entry: StatusHistoryEntry = { status, at: now }
    const update: Record<string, unknown> = { status }

    if (status === 'enviado') {
      update.shipped_at = now
      const g = tracking?.trackingNumber?.trim()
      const c = tracking?.carrier?.trim()
      if (g) { update.tracking_number = g; entry.tracking_number = g }
      if (c) { update.shipping_carrier = c; entry.shipping_carrier = c }
    }
    update.status_history = [...history, entry]

    let upd = await supabase.from('online_orders').update(update).eq('id', id).eq('store_id', store.id)
    // Resiliencia si la migración 054 no se corrió: reintenta solo con el estado.
    if (upd.error && /tracking_number|shipping_carrier|shipped_at|status_history|column|schema cache/i.test(upd.error.message || '')) {
      upd = await supabase.from('online_orders').update({ status }).eq('id', id).eq('store_id', store.id)
    }
    if (upd.error) return { success: false, error: 'No se pudo actualizar' }
    revalidatePath('/orders')

    // Al enviar: correo automático (best-effort) + mensaje de WhatsApp.
    let whatsapp: string | undefined
    if (status === 'enviado') {
      const carrier = (update.shipping_carrier as string) || (order.shipping_carrier as string) || null
      const guide = (update.tracking_number as string) || (order.tracking_number as string) || null
      const trackUrl = `${getAppUrl()}/rastreo/${order.order_no ?? id}`
      const carrierUrl = trackingUrl(carrier, guide)
      whatsapp = buildShipWhatsApp({ store: store.name, orderNo: order.order_no as string, carrier, guide, carrierUrl, trackUrl })
      if (order.email) {
        // No bloquea la respuesta; si Resend no está configurado, se omite.
        void sendEmail(
          order.email as string,
          `Tu pedido ${order.order_no ?? ''} va en camino 📦`,
          buildShipmentEmailHtml({ storeName: store.name, orderNo: order.order_no as string, carrier, guide, carrierUrl, trackUrl }),
        )
      }
    }
    return { success: true, whatsapp }
  } catch { return { success: false, error: 'Error' } }
}

// ─── Rastreo PÚBLICO por número de orden (cliente sin cuenta) ────────────────
export interface PublicOrderTracking {
  order_no: string | null
  status: OrderStatus
  status_history: StatusHistoryEntry[]
  shipping_carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: string | null
  created_at: string
  paid_at: string | null
  total: number | null
  item_count: number
  store_name: string | null
  store_slug: string | null
}

/**
 * Devuelve el estado de un pedido para el cliente (página /rastreo). Usa
 * service-role filtrando por order_no y expone SOLO datos no sensibles (nada de
 * dirección, teléfono ni correo). Devuelve null si no existe.
 */
export async function getPublicOrderTrackingAction(orderNo: string): Promise<PublicOrderTracking | null> {
  try {
    const code = (orderNo || '').trim()
    if (!code) return null
    const admin = createAdminClient()
    const { data: o } = await admin.from('online_orders').select('*').eq('order_no', code).maybeSingle()
    if (!o) return null
    let storeName: string | null = null
    let storeSlug: string | null = null
    if (o.store_id) {
      const { data: s } = await admin.from('stores').select('name, slug').eq('id', o.store_id).maybeSingle()
      storeName = (s?.name as string) ?? null
      storeSlug = (s?.slug as string) ?? null
    }
    const carrier = (o.shipping_carrier as string) ?? null
    const guide = (o.tracking_number as string) ?? null
    const items = (o.items as { qty: number }[] | null) ?? []
    return {
      order_no: (o.order_no as string) ?? null,
      status: (o.status as OrderStatus) ?? 'pagado',
      status_history: Array.isArray(o.status_history) ? (o.status_history as StatusHistoryEntry[]) : [],
      shipping_carrier: carrier,
      tracking_number: guide,
      tracking_url: trackingUrl(carrier, guide),
      shipped_at: (o.shipped_at as string) ?? null,
      created_at: o.created_at as string,
      paid_at: (o.paid_at as string) ?? null,
      total: o.total == null ? null : Number(o.total),
      item_count: items.reduce((s, it) => s + (Number(it.qty) || 0), 0),
      store_name: storeName,
      store_slug: storeSlug,
    }
  } catch { return null }
}
