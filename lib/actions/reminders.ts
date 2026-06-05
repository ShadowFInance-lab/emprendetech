'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResult } from './auth'

export interface Reminder {
  id: string
  store_id: string
  customer_id: string | null
  title: string
  due_date: string | null
  due_time: string | null
  done: boolean
  created_at: string
}

const ReminderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Escribe el recordatorio').max(200),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
})

// Si la migración 008 no se ha corrido, la tabla no existe (código 42P01)
function isMissingTable(err: { code?: string } | null) {
  return err?.code === '42P01'
}

async function getStoreId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  return store?.id ?? null
}

/** Lista recordatorios de un cliente (o todos los pendientes de la tienda). */
export async function getReminders(customerId?: string): Promise<{ reminders: Reminder[]; missingTable: boolean }> {
  const supabase = await createClient()
  const storeId = await getStoreId(supabase)
  if (!storeId) return { reminders: [], missingTable: false }

  let q = supabase
    .from('reminders')
    .select('*')
    .eq('store_id', storeId)
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (customerId) q = q.eq('customer_id', customerId)

  const { data, error } = await q
  if (error) return { reminders: [], missingTable: isMissingTable(error) }
  return { reminders: (data ?? []) as Reminder[], missingTable: false }
}

export async function createReminderAction(input: {
  customer_id?: string
  title: string
  due_date?: string
  due_time?: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStoreId(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }

  const parsed = ReminderSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('reminders').insert({
    store_id: storeId,
    customer_id: parsed.data.customer_id || null,
    title: parsed.data.title,
    due_date: parsed.data.due_date || null,
    due_time: parsed.data.due_time || null,
  })

  if (error) {
    if (isMissingTable(error)) {
      return { success: false, error: 'Falta ejecutar la migración 008_reminders.sql en Supabase.' }
    }
    return { success: false, error: 'No se pudo guardar el recordatorio' }
  }

  if (parsed.data.customer_id) revalidatePath(`/customers/${parsed.data.customer_id}`)
  revalidatePath('/customers')
  return { success: true }
}

export async function toggleReminderAction(id: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStoreId(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('reminders').update({ done }).eq('id', id).eq('store_id', storeId)
  if (error) return { success: false, error: 'No se pudo actualizar' }

  revalidatePath('/customers')
  return { success: true }
}

export async function deleteReminderAction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStoreId(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('reminders').delete().eq('id', id).eq('store_id', storeId)
  if (error) return { success: false, error: 'No se pudo eliminar' }

  revalidatePath('/customers')
  return { success: true }
}
