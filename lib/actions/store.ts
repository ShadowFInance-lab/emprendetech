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
    'bg_color', 'button_style', 'background_url', 'dashboard_bg_url', 'dashboard_bg_fit', 'dashboard_bg_color',
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

  // Separar campos core de los de colores/fondo para manejar columnas faltantes (como dashboard_bg_color)
  const colorKeys = ['primary_color', 'secondary_color', 'button_color', 'panel_primary', 'panel_secondary', 'panel_button', 'bg_color', 'dashboard_bg_color', 'dashboard_bg_url', 'dashboard_bg_fit', 'bg_fit', 'background_url']

  const coreUpdates: Record<string, unknown> = {}
  const colorUpdates: Record<string, unknown> = {}

  Object.keys(updates).forEach(k => {
    if (colorKeys.includes(k)) {
      colorUpdates[k] = updates[k]
    } else {
      coreUpdates[k] = updates[k]
    }
  })

  let { error } = await supabase
    .from('stores')
    .update(updates)  // primer intento con todo (rápido si todo existe)
    .eq('id', storeId)
    .eq('owner_id', user.id)

  const isMissingColumn = error && (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column|schema cache/i.test(error.message ?? '')
  )

  if (isMissingColumn) {
    // Reintento solo con core (quitando legacy problemáticos y colores nuevos)
    const stripOnly = ['currency', 'sales_pin', 'youtube', 'button_style', 'online_sales']
    const retryCore = { ...coreUpdates }
    for (const k of stripOnly) {
      delete retryCore[k]
    }
    const retry = await supabase
      .from('stores').update(retryCore).eq('id', storeId).eq('owner_id', user.id)
    error = retry.error

    // Colores siempre por separado (dashboard_bg_color etc). Si la columna falta, el color save fallará pero no bloqueamos el resto.
    // Una vez que se corra la migración (ALTER en TODAS_PENDIENTES), se guardará correctamente.
    if (Object.keys(colorUpdates).length > 0) {
      const colorRes = await supabase.from('stores').update(colorUpdates).eq('id', storeId).eq('owner_id', user.id)
      // Si core ok pero color falló por columna faltante, no reportamos error al usuario (se guardará lo demás)
      if (colorRes.error && !error && (colorRes.error.code === '42703' || /column/i.test(colorRes.error.message ?? ''))) {
        error = null
      }
    }
  } else if (Object.keys(colorUpdates).length > 0) {
    // Si primer update incluyó colores y fue exitoso, ok. Si por alguna razón solo colores fallaron (raro), intentamos igual.
    // (El update inicial ya los incluyó)
  }

  if (error) return { success: false, error: 'Error al guardar los cambios' }

  // Revalidar layout completo para que colores/fondo se vean al refrescar cualquier ruta
  revalidatePath('/', 'layout')
  revalidatePath('/settings', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/inventory')
  revalidatePath('/sales')
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

  const type = formData.get('type') as 'logo' | 'banner' | 'background' | 'dashboard'
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

  const col = type === 'dashboard' ? 'dashboard_bg_url' : `${type}_url`
  const { error: updateError } = await supabase
    .from('stores')
    .update({ [col]: publicUrl })
    .eq('id', storeId)
    .eq('owner_id', user.id)

  if (updateError) {
    const hint = type === 'background'
      ? ' Ejecuta la migración 022_catalog_background.sql en Supabase (falta la columna background_url).'
      : ''
    return { success: false, error: `Se subió la imagen pero no se guardó el enlace.${hint}` }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/settings', 'layout')
  revalidatePath('/dashboard')
  const { data: storeRow } = await supabase.from('stores').select('slug').eq('id', storeId).single()
  if (storeRow?.slug) revalidatePath(`/catalog/${storeRow.slug}`)
  return { success: true, url: publicUrl }
}
