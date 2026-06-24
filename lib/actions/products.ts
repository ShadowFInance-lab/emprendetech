'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils/slug'
import { getPlanLimits } from '@/lib/constants/plans'
import type { Plan } from '@/lib/types'
import { z } from 'zod'
import type { ActionResult } from './auth'

const ProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(120),
  description: z.string().max(2000).optional(),
  sku: z.string().max(60).optional(),
  barcode: z.string().max(60).optional(),
  cost_price: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  sale_price: z.coerce.number().min(0.01, 'El precio debe ser mayor a 0'),
  stock: z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  is_featured: z.coerce.boolean().optional(),
  is_new: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
  currency: z.string().max(8).optional(),
})

// ─── Obtener tienda del usuario (incluye slug para revalidar catálogo) ──
async function getStore(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('stores').select('id, owner_id, slug').eq('owner_id', userId).single()
  return data
}

/**
 * Revalida tanto el panel de inventario como el CATÁLOGO PÚBLICO.
 * Esto hace que los cambios de producto aparezcan casi en tiempo real
 * en /catalog/[slug] (Fix B), no esperando los 5 min del ISR.
 */
function revalidateProductPaths(slug?: string, productId?: string) {
  revalidatePath('/inventory')
  if (productId) revalidatePath(`/inventory/${productId}`)
  if (slug) {
    revalidatePath(`/catalog/${slug}`)            // catálogo público
    revalidatePath(`/catalog/${slug}/product`, 'layout') // páginas de producto
  }
}

// ─── Crear producto ──────────────────────────────────────────
export async function createProductAction(formData: FormData): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  // ─── FIX A: Verificar límite de productos según el plan ──────
  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single()
  const plan = (profile?.plan ?? 'free') as Plan
  const limits = getPlanLimits(plan)

  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store.id)

  if ((productCount ?? 0) >= limits.max_products) {
    return {
      success: false,
      error: `Alcanzaste el límite de ${limits.max_products} productos del plan ${limits.label}. Mejora tu plan para agregar más.`,
    }
  }

  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    sku: formData.get('sku') as string || undefined,
    barcode: formData.get('barcode') as string || undefined,
    cost_price: formData.get('cost_price'),
    sale_price: formData.get('sale_price'),
    stock: formData.get('stock'),
    category_id: formData.get('category_id') as string || undefined,
    is_featured: formData.get('is_featured') === 'true',
    is_new: formData.get('is_new') !== 'false',
    is_active: formData.get('is_active') !== 'false',
    currency: (formData.get('currency') as string) || undefined,
  }

  const parsed = ProductSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  // Generar slug único
  const baseSlug = generateSlug(parsed.data.name)
  let slug = baseSlug
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from('products').select('id').eq('store_id', store.id).eq('slug', slug).single()
    if (!existing) break
    attempts++
    slug = `${baseSlug}-${attempts}`
  }

  // Variantes opcionales (JSON)
  let variantsJson: unknown[] = []
  const variantsRaw = formData.get('variants') as string | null
  if (variantsRaw) { try { variantsJson = JSON.parse(variantsRaw) } catch { variantsJson = [] } }

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      store_id: store.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      sku: parsed.data.sku || null,
      barcode: parsed.data.barcode || null,
      cost_price: parsed.data.cost_price,
      sale_price: parsed.data.sale_price,
      stock: parsed.data.stock,
      category_id: parsed.data.category_id || null,
      is_featured: parsed.data.is_featured ?? false,
      is_new: parsed.data.is_new ?? true,
      is_active: parsed.data.is_active ?? true,
      variants: variantsJson,
    })
    .select('id')
    .single()

  if (error || !product) return { success: false, error: 'Error al crear el producto' }

  // Persistir moneda del producto (se ignora si falta la migración 013)
  if (parsed.data.currency) {
    await supabase.from('products').update({ currency: parsed.data.currency }).eq('id', product.id)
  }

  revalidateProductPaths(store.slug, product.id)
  return { success: true, id: product.id }
}

// ─── Actualizar producto ─────────────────────────────────────
export async function updateProductAction(
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    sku: formData.get('sku') as string || undefined,
    barcode: formData.get('barcode') as string || undefined,
    cost_price: formData.get('cost_price'),
    sale_price: formData.get('sale_price'),
    stock: formData.get('stock'),
    category_id: formData.get('category_id') as string || undefined,
    is_featured: formData.get('is_featured') === 'true',
    is_new: formData.get('is_new') === 'true',
    is_active: formData.get('is_active') !== 'false',
    currency: (formData.get('currency') as string) || undefined,
  }

  const parsed = ProductSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  let variantsJsonUpd: unknown[] = []
  const variantsRawUpd = formData.get('variants') as string | null
  if (variantsRawUpd) { try { variantsJsonUpd = JSON.parse(variantsRawUpd) } catch { variantsJsonUpd = [] } }

  const { error } = await supabase
    .from('products')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      sku: parsed.data.sku || null,
      barcode: parsed.data.barcode || null,
      cost_price: parsed.data.cost_price,
      sale_price: parsed.data.sale_price,
      stock: parsed.data.stock,
      category_id: parsed.data.category_id || null,
      is_featured: parsed.data.is_featured ?? false,
      is_new: parsed.data.is_new ?? false,
      is_active: parsed.data.is_active ?? true,
      variants: variantsJsonUpd,
    })
    .eq('id', productId)
    .eq('store_id', store.id) // seguridad: solo productos de su tienda

  if (error) return { success: false, error: 'Error al actualizar el producto' }

  // Persistir moneda del producto (se ignora si falta la migración 013)
  if (parsed.data.currency) {
    await supabase.from('products').update({ currency: parsed.data.currency }).eq('id', productId).eq('store_id', store.id)
  }

  revalidateProductPaths(store.slug, productId)
  return { success: true }
}

// ─── Eliminar producto ───────────────────────────────────────
export async function deleteProductAction(productId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('store_id', store.id)

  if (error) return { success: false, error: 'No se puede eliminar. Tiene ventas asociadas.' }

  revalidateProductPaths(store.slug, productId)
  redirect('/inventory')
}

// ─── Duplicar producto ───────────────────────────────────────
export async function duplicateProductAction(productId: string): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: original } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('id', productId)
    .single()

  if (!original) return { success: false, error: 'Producto no encontrado' }

  const newName = `${original.name} (copia)`
  const newSlug = generateSlug(newName) + '-' + Date.now().toString().slice(-4)

  const { data: copy, error } = await supabase
    .from('products')
    .insert({
      ...original,
      id: undefined,
      name: newName,
      slug: newSlug,
      total_sold: 0,
      created_at: undefined,
      updated_at: undefined,
    })
    .select('id')
    .single()

  if (error || !copy) return { success: false, error: 'Error al duplicar' }

  // Copiar imágenes
  if (original.product_images?.length > 0) {
    const images = original.product_images.map((img: { url: string; is_primary: boolean; sort_order: number }) => ({
      product_id: copy.id,
      url: img.url,
      is_primary: img.is_primary,
      sort_order: img.sort_order,
    }))
    await supabase.from('product_images').insert(images)
  }

  const store = await getStore(supabase, user.id)
  revalidateProductPaths(store?.slug, copy.id)
  return { success: true, id: copy.id }
}

// ════════════════════════════════════════════════════════════
// ACCIONES MASIVAS (bulk) — sobre varios productos seleccionados
// ════════════════════════════════════════════════════════════

/** Aplica un descuento % a varios productos (oferta masiva). */
export async function applyBulkOfferAction(
  productIds: string[],
  discountPct: number
): Promise<ActionResult & { updated?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }
  if (productIds.length === 0) return { success: false, error: 'No seleccionaste productos' }
  if (discountPct <= 0 || discountPct >= 100) return { success: false, error: 'El descuento debe ser entre 1% y 99%' }

  // Traer productos (solo de su tienda)
  const { data: products } = await supabase
    .from('products')
    .select('id, sale_price, compare_at_price')
    .eq('store_id', store.id)
    .in('id', productIds)

  if (!products || products.length === 0) return { success: false, error: 'Productos no encontrados' }

  let updated = 0
  for (const p of products) {
    // El precio "original" es compare_at_price si ya estaba en oferta, si no el sale_price actual
    const original = p.compare_at_price ?? p.sale_price
    const discounted = Math.round(original * (1 - discountPct / 100) * 100) / 100
    const { error } = await supabase
      .from('products')
      .update({ compare_at_price: original, sale_price: discounted, is_featured: true })
      .eq('id', p.id)
      .eq('store_id', store.id)
    if (!error) updated++
  }

  revalidateProductPaths(store.slug)
  return { success: true, updated }
}

/** Quita la oferta de varios productos (restaura precio original). */
export async function removeBulkOfferAction(productIds: string[]): Promise<ActionResult & { updated?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const { data: products } = await supabase
    .from('products')
    .select('id, compare_at_price')
    .eq('store_id', store.id)
    .in('id', productIds)
    .not('compare_at_price', 'is', null)

  let updated = 0
  for (const p of products ?? []) {
    const { error } = await supabase
      .from('products')
      .update({ sale_price: p.compare_at_price, compare_at_price: null })
      .eq('id', p.id)
      .eq('store_id', store.id)
    if (!error) updated++
  }

  revalidateProductPaths(store.slug)
  return { success: true, updated }
}

/** Activar/desactivar varios productos a la vez. */
export async function bulkSetActiveAction(productIds: string[], isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const { error } = await supabase
    .from('products').update({ is_active: isActive })
    .eq('store_id', store.id).in('id', productIds)
  if (error) return { success: false, error: 'Error al actualizar' }

  revalidateProductPaths(store.slug)
  return { success: true }
}

/** Eliminar varios productos a la vez. */
export async function bulkDeleteAction(productIds: string[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const store = await getStore(supabase, user.id)
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const { error } = await supabase
    .from('products').delete()
    .eq('store_id', store.id).in('id', productIds)
  if (error) return { success: false, error: 'No se pudieron eliminar (algunos tienen ventas)' }

  revalidateProductPaths(store.slug)
  return { success: true }
}

// ─── Subir imagen de producto ────────────────────────────────
export async function uploadProductImageAction(
  productId: string,
  formData: FormData
): Promise<ActionResult & { url?: string; imageId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const file = formData.get('file') as File
  if (!file || !file.size) return { success: false, error: 'No se recibió archivo' }

  // Validar tipo y tamaño
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Solo se permiten imágenes JPG, PNG, WebP o GIF' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'La imagen no puede superar 5MB' }
  }

  const ext = file.name.split('.').pop()
  const path = `products/${productId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('public-assets')
    .upload(path, file)

  if (uploadError) return { success: false, error: 'Error al subir la imagen' }

  const { data: { publicUrl } } = supabase.storage
    .from('public-assets')
    .getPublicUrl(path)

  // Verificar si es la primera imagen (será la principal)
  const { count } = await supabase
    .from('product_images')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)

  const { data: imgRecord, error: imgError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      url: publicUrl,
      is_primary: (count ?? 0) === 0,
      sort_order: count ?? 0,
    })
    .select('id')
    .single()

  if (imgError) return { success: false, error: 'Error al guardar la imagen' }

  const store = await getStore(supabase, user.id)
  revalidateProductPaths(store?.slug, productId)
  return { success: true, url: publicUrl, imageId: imgRecord.id }
}

// ─── Eliminar imagen de producto ─────────────────────────────
export async function deleteProductImageAction(
  imageId: string,
  productId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: img } = await supabase
    .from('product_images').select('url, is_primary').eq('id', imageId).single()

  if (!img) return { success: false, error: 'Imagen no encontrada' }

  // Eliminar de Storage
  const urlParts = img.url.split('/public-assets/')
  if (urlParts[1]) {
    await supabase.storage.from('public-assets').remove([urlParts[1]])
  }

  await supabase.from('product_images').delete().eq('id', imageId)

  // Si era la principal, asignar otra
  if (img.is_primary) {
    const { data: remaining } = await supabase
      .from('product_images')
      .select('id').eq('product_id', productId).limit(1)
    if (remaining?.[0]) {
      await supabase.from('product_images')
        .update({ is_primary: true }).eq('id', remaining[0].id)
    }
  }

  const store = await getStore(supabase, user.id)
  revalidateProductPaths(store?.slug, productId)
  return { success: true }
}

// ─── Establecer imagen principal ────────────────────────────
export async function setPrimaryImageAction(
  imageId: string,
  productId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Quitar principal de todas
  await supabase.from('product_images')
    .update({ is_primary: false }).eq('product_id', productId)

  // Establecer la nueva
  await supabase.from('product_images')
    .update({ is_primary: true }).eq('id', imageId)

  const store = await getStore(supabase, user.id)
  revalidateProductPaths(store?.slug, productId)
  return { success: true }
}
