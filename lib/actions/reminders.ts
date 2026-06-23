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
  assigned_to: string | null
  products: string | null
  created_at: string
}

const ReminderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Escribe el recordatorio').max(200),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  products: z.string().max(500).optional(),
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

export interface DueReminder {
  id: string
  title: string
  due_date: string | null
  due_time: string | null
  customer_id: string | null
  customer_name: string | null
}

/**
 * Recordatorios pendientes (no hechos) con fecha — para la campana del JEFE.
 * Excluye los asignados a un empleado: ésos sólo alarman a ese empleado (migr. 027).
 * Si la columna assigned_to aún no existe, cae al comportamiento anterior.
 */
export async function getActiveReminders(): Promise<DueReminder[]> {
  const supabase = await createClient()
  const storeId = await getStoreId(supabase)
  if (!storeId) return []

  const run = (excludeAssigned: boolean) => {
    const q = supabase
      .from('reminders')
      .select('id, title, due_date, due_time, customer_id, customers(name)')
      .eq('store_id', storeId)
      .eq('done', false)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
    return excludeAssigned ? q.is('assigned_to', null) : q
  }

  let { data, error } = await run(true)
  if (error) ({ data, error } = await run(false)) // migración 027 pendiente
  if (error) return [] // tabla/columna faltante → sin notificaciones
  return (data ?? []).map((r) => {
    const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
    return {
      id: r.id as string,
      title: r.title as string,
      due_date: (r.due_date as string) ?? null,
      due_time: (r.due_time as string) ?? null,
      customer_id: (r.customer_id as string) ?? null,
      customer_name: (c as { name?: string } | null)?.name ?? null,
    }
  })
}

export async function createReminderAction(input: {
  customer_id?: string
  title: string
  due_date?: string
  due_time?: string
  assigned_to?: string
  products?: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const storeId = await getStoreId(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }

  const parsed = ReminderSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const baseRow: Record<string, unknown> = {
    store_id: storeId,
    customer_id: parsed.data.customer_id || null,
    title: parsed.data.title,
    due_date: parsed.data.due_date || null,
    due_time: parsed.data.due_time || null,
  }
  const row: Record<string, unknown> = { ...baseRow }
  if (parsed.data.assigned_to) row.assigned_to = parsed.data.assigned_to
  if (parsed.data.products?.trim()) row.products = parsed.data.products.trim()

  let { error } = await supabase.from('reminders').insert(row)
  // Si faltan columnas nuevas (assigned_to / products), reintenta con lo básico.
  if (error && (error.code === '42703' || error.code === 'PGRST204' || /column|schema cache/i.test(error.message ?? ''))) {
    ({ error } = await supabase.from('reminders').insert(baseRow))
  }

  if (error) {
    if (isMissingTable(error)) {
      return { success: false, error: 'Falta ejecutar la migración 008_reminders.sql en Supabase.' }
    }
    return { success: false, error: 'No se pudo guardar el recordatorio' }
  }

  // Notifica al empleado logueado asignado (mejor esfuerzo).
  if (parsed.data.assigned_to) {
    try {
      await supabase.from('employee_notifications').insert({
        employee_id: parsed.data.assigned_to,
        sender_id: user?.id ?? null,
        message: `📦 Recordatorio de entrega: ${parsed.data.title}${parsed.data.due_date ? ` · ${parsed.data.due_date}` : ''}${parsed.data.products?.trim() ? ` — ${parsed.data.products.trim()}` : ''}`,
      })
    } catch { /* best-effort */ }
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

/**
 * Empleado: recordatorios de entrega ASIGNADOS a él (pendientes, con fecha).
 * No usa store ownership — la RLS aditiva (migr. 027) deja ver assigned_to = uid.
 */
export async function getMyAssignedReminders(): Promise<DueReminder[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('reminders')
      .select('id, title, due_date, due_time, customer_id, customers(name)')
      .eq('assigned_to', user.id)
      .eq('done', false)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
    if (error) return [] // migración 027 pendiente o sin asignados
    return (data ?? []).map((r) => {
      const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
      return {
        id: r.id as string,
        title: r.title as string,
        due_date: (r.due_date as string) ?? null,
        due_time: (r.due_time as string) ?? null,
        customer_id: (r.customer_id as string) ?? null,
        customer_name: (c as { name?: string } | null)?.name ?? null,
      }
    })
  } catch { return [] }
}

/** Empleado: marca como hecho un recordatorio que le fue asignado. */
export async function markMyAssignedReminderDone(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase
      .from('reminders').update({ done: true }).eq('id', id).eq('assigned_to', user.id)
    if (error) return { success: false, error: 'No se pudo actualizar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
