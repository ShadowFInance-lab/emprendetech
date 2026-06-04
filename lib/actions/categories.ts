'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils/slug'
import { z } from 'zod'
import type { ActionResult } from './auth'

const CategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(50),
})

export async function getCategoriesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return []

  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return data ?? []
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const raw = { name: formData.get('name') as string }
  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const baseSlug = generateSlug(parsed.data.name)

  // Evitar slug duplicado
  let slug = baseSlug
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from('categories').select('id').eq('store_id', store.id).eq('slug', slug).single()
    if (!existing) break
    attempts++
    slug = `${baseSlug}-${attempts}`
  }

  const { error } = await supabase.from('categories').insert({
    store_id: store.id,
    name: parsed.data.name,
    slug,
  })

  if (error) return { success: false, error: 'Error al crear la categoría' }

  revalidatePath('/inventory')
  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function updateCategoryAction(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const raw = { name: formData.get('name') as string }
  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', id)

  if (error) return { success: false, error: 'Error al actualizar' }

  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Verificar si tiene productos
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return { success: false, error: `No puedes eliminar esta categoría porque tiene ${count} producto(s) asociado(s)` }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return { success: false, error: 'Error al eliminar' }

  revalidatePath('/inventory/categories')
  return { success: true }
}
