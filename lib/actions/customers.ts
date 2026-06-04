'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResult } from './auth'

const CustomerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
})

export async function createCustomerAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const raw = {
    name: formData.get('name') as string,
    phone: (formData.get('phone') as string) || undefined,
    email: (formData.get('email') as string) || undefined,
    address: (formData.get('address') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  }
  const parsed = CustomerSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('customers').insert({
    store_id: store.id,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
  })
  if (error) return { success: false, error: 'Error al crear el cliente' }

  revalidatePath('/customers')
  return { success: true }
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const { error } = await supabase
    .from('customers').delete().eq('id', id).eq('store_id', store.id)
  if (error) return { success: false, error: 'Error al eliminar' }

  revalidatePath('/customers')
  return { success: true }
}
