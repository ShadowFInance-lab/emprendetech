'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResult } from './auth'

const CreateStoreSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  slug: z.string().min(3, 'El slug debe tener al menos 3 caracteres').max(50)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  whatsapp: z.string().optional(),
})

// ─── Crear tienda (onboarding) ───────────────────────────────
export async function createStoreAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const raw = {
    name: formData.get('name') as string,
    slug: (formData.get('slug') as string)?.toLowerCase().trim(),
    whatsapp: formData.get('whatsapp') as string || undefined,
  }

  const parsed = CreateStoreSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  // Verificar si el slug ya existe
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', parsed.data.slug)
    .single()

  if (existing) {
    return { success: false, error: 'Este slug ya está en uso. Elige otro.' }
  }

  // Crear la tienda
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      whatsapp: parsed.data.whatsapp || null,
    })
    .select('id')
    .single()
  if (storeError || !store) {
    return { success: false, error: 'Error al crear la tienda' }
  }

  // Marcar onboarding como completo
  await supabase
    .from('profiles')
    .update({ onboarding_done: true })
    .eq('id', user.id)

  revalidatePath('/', 'layout')
  // Devolvemos el storeId para que el cliente suba el logo (si lo hay) y luego redirija.
  return { success: true, data: { storeId: store.id } }
}

// ─── Verificar disponibilidad de slug (para onboarding en vivo) ──
export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  const supabase = await createClient()
  const { data } = await supabase.from('stores').select('id').eq('slug', slug).maybeSingle()
  return { available: !data }
}

// ─── Actualizar tienda ───────────────────────────────────────
export async function updateStoreAction(
  storeId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const updates: Record<string, unknown> = {}
  const fields = [
    'name', 'description', 'tagline', 'whatsapp',
    'facebook', 'instagram', 'tiktok',
    'skin', 'primary_color', 'secondary_color', 'button_color',
    'font_family', 'product_order', 'show_prices',
  ]

  fields.forEach(field => {
    const val = formData.get(field)
    if (val !== null) {
      if (field === 'show_prices') {
        updates[field] = val === 'true'
      } else {
        updates[field] = val as string || null
      }
    }
  })

  // ─── FIX A: validar que el skin elegido esté permitido por el plan ──
  if (updates.skin) {
    const { data: profile } = await supabase
      .from('profiles').select('plan').eq('id', user.id).single()
    const { getPlanLimits } = await import('@/lib/constants/plans')
    const allowed = getPlanLimits((profile?.plan ?? 'free') as never).skins
    if (!allowed.includes(updates.skin as string)) {
      return {
        success: false,
        error: 'Esa skin requiere un plan superior. Mejora tu plan para usarla.',
      }
    }
  }

  const { error } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', storeId)
    .eq('owner_id', user.id)

  if (error) return { success: false, error: 'Error al guardar los cambios' }

  // Revalidar settings + catálogo público (los cambios de branding se ven al instante)
  revalidatePath('/settings')
  const { data: storeRow } = await supabase
    .from('stores').select('slug').eq('id', storeId).single()
  if (storeRow?.slug) revalidatePath(`/catalog/${storeRow.slug}`)
  return { success: true }
}

// ─── Obtener tienda del usuario actual ───────────────────────
export async function getUserStore() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  return data
}

// ─── Upload de imagen (logo/banner) ─────────────────────────
export async function uploadStoreImage(
  storeId: string,
  file: File,
  type: 'logo' | 'banner'
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const ext = file.name.split('.').pop()
  const path = `stores/${storeId}/${type}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('public-assets')
    .upload(path, file, { upsert: true })

  if (uploadError) return { success: false, error: 'Error al subir la imagen' }

  const { data: { publicUrl } } = supabase.storage
    .from('public-assets')
    .getPublicUrl(path)

  await supabase
    .from('stores')
    .update({ [`${type}_url`]: publicUrl })
    .eq('id', storeId)

  revalidatePath('/settings')
  return { success: true, url: publicUrl }
}
