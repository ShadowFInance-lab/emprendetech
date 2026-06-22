'use server'

import { createPublicClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

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
