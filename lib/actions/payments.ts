'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

/**
 * Cuenta de Mercado Pago de la TIENDA (solo para cobrar ventas de productos).
 * Las suscripciones de plan NO usan esto: usan el token de la plataforma.
 * Nunca devolvemos el token al cliente, solo si está configurado.
 */
export async function getStorePaymentStatus(): Promise<{ configured: boolean }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { configured: false }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { configured: false }
    const { data } = await supabase
      .from('store_payment_config').select('mercadopago_access_token').eq('store_id', store.id).maybeSingle()
    return { configured: !!data?.mercadopago_access_token }
  } catch {
    return { configured: false }
  }
}

export async function saveStorePaymentTokenAction(token: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const t = token.trim()
    if (!t || (!t.startsWith('APP_USR-') && !t.startsWith('TEST-'))) {
      return { success: false, error: 'Pega tu Access Token de Mercado Pago (empieza con APP_USR- o TEST-).' }
    }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'Solo el dueño puede configurar la cuenta de cobros' }

    const { error } = await supabase
      .from('store_payment_config')
      .upsert({ store_id: store.id, mercadopago_access_token: t, updated_at: new Date().toISOString() })
    if (error) return { success: false, error: 'No se pudo guardar (¿migración 020 aplicada?).' }
    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo guardar la cuenta de cobros' }
  }
}

export async function clearStorePaymentTokenAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return { success: false, error: 'No autorizado' }
    const { error } = await supabase
      .from('store_payment_config').update({ mercadopago_access_token: null }).eq('store_id', store.id)
    if (error) return { success: false, error: 'No se pudo quitar' }
    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo quitar la cuenta' }
  }
}
