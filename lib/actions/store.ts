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
    'facebook', 'instagram', 'tiktok', 'youtube',
    'skin', 'primary_color', 'secondary_color', 'button_color',
    'panel_primary', 'panel_secondary', 'panel_button', 'bg_fit',
    'font_family', 'product_order', 'currency', 'sales_pin', 'show_prices', 'online_sales',
    'online_reception_type', 'online_reception_value',
    'bg_color', 'button_style', 'background_url',
  ]

  fields.forEach(field => {
    const val = formData.get(field)
    if (val !== null) {
      if (field === 'show_prices' || field === 'online_sales') {
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

  let { error } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', storeId)
    .eq('owner_id', user.id)

  // Si alguna columna nueva aún no existe (migraciones pendientes: 009/011/012/014),
  // reintenta SIN esas columnas para no romper el guardado completo.
  // Supabase devuelve 42703 (Postgres) o PGRST204 (PostgREST schema cache).
  const isMissingColumn = error && (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column|schema cache/i.test(error.message ?? '')
  )
  if (isMissingColumn) {
    for (const k of ['currency', 'sales_pin', 'youtube', 'bg_color', 'button_style', 'background_url', 'panel_primary', 'panel_secondary', 'panel_button', 'bg_fit', 'online_sales']) {
      delete (updates as Record<string, unknown>)[k]
    }
    const retry = await supabase
      .from('stores').update(updates).eq('id', storeId).eq('owner_id', user.id)
    error = retry.error
  }

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
// Recibe FormData (patrón confiable de Server Actions, igual que el de
// productos). Pasar un File como argumento posicional puede llegar vacío
// al servidor — por eso fallaba la subida de logo/banner.
export async function uploadStoreImage(
  storeId: string,
  formData: FormData
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Verificar propiedad de la tienda
  const { data: store } = await supabase
    .from('stores').select('id').eq('id', storeId).eq('owner_id', user.id).single()
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const type = formData.get('type') as 'logo' | 'banner' | 'background'
  const file = formData.get('file') as File
  if (!file || !file.size) return { success: false, error: 'No se recibió la imagen' }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Formato no válido. Usa JPG, PNG o WebP.' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'La imagen supera 5MB.' }
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  // nombre único para evitar caché viejo del navegador/CDN
  const path = `stores/${storeId}/${type}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('public-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return {
      success: false,
      error: `No se pudo subir. Verifica que exista el bucket "public-assets" en Supabase Storage (migración 004). Detalle: ${uploadError.message}`,
    }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('public-assets')
    .getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('stores')
    .update({ [`${type}_url`]: publicUrl })
    .eq('id', storeId)
    .eq('owner_id', user.id)

  if (updateError) {
    const hint = type === 'background'
      ? ' Ejecuta la migración 022_catalog_background.sql en Supabase (falta la columna background_url).'
      : ''
    return { success: false, error: `Se subió la imagen pero no se guardó el enlace.${hint}` }
  }

  revalidatePath('/settings')
  const { data: storeRow } = await supabase.from('stores').select('slug').eq('id', storeId).single()
  if (storeRow?.slug) revalidatePath(`/catalog/${storeRow.slug}`)
  return { success: true, url: publicUrl }
}
