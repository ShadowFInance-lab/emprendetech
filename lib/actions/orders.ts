'use server'

import { createClient, createPublicClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/constants/orders'

export type { OrderStatus }

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
    }))
  } catch { return [] }
}

/** Cambia el estado de un pedido (auto-guardado). */
export async function updateOnlineOrderStatusAction(id: string, status: OrderStatus): Promise<ActionResult> {
  try {
    if (!ORDER_STATUSES.includes(status)) return { success: false, error: 'Estado inválido' }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
    if (!store) return { success: false, error: 'Sin tienda' }
    const { error } = await supabase.from('online_orders').update({ status }).eq('id', id).eq('store_id', store.id)
    if (error) return { success: false, error: 'No se pudo actualizar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
