'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResult } from './auth'

// ─── Schema de un item del carrito ──────────────────────────
const CartItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  unit_cost: z.number().min(0),
})

const CreateSaleSchema = z.object({
  items: z.array(CartItemSchema).min(1, 'Agrega al menos un producto'),
  discount_amt: z.number().min(0).default(0),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']).default('cash'),
  customer_id: z.string().uuid().optional(), // cliente existente (venta directa desde su ficha)
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>

/**
 * Registra una venta completa.
 * El descuento de stock + movimientos de inventario + alertas
 * se manejan AUTOMÁTICAMENTE por los triggers de PostgreSQL
 * al insertar los sale_items.
 */
export async function createSaleAction(input: CreateSaleInput): Promise<ActionResult & { saleId?: string; folio?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  const parsed = CreateSaleSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { items, discount_amt, payment_method, customer_id, customer_name, customer_phone, notes } = parsed.data

  // ─── Verificar stock disponible ANTES de vender ──────────
  for (const item of items) {
    const { data: product } = await supabase
      .from('products')
      .select('stock, name')
      .eq('id', item.product_id)
      .eq('store_id', store.id)
      .single()

    if (!product) {
      return { success: false, error: `Producto no encontrado: ${item.product_name}` }
    }
    if (product.stock < item.quantity) {
      return {
        success: false,
        error: `Stock insuficiente de "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}`,
      }
    }
  }

  // ─── Calcular totales ────────────────────────────────────
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const total = Math.max(0, subtotal - discount_amt)
  const totalCost = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
  const profit = total - totalCost

  // ─── Resolver cliente ────────────────────────────────────
  let customerId: string | null = null
  if (customer_id) {
    // Venta directa desde la ficha de un cliente existente (verificar que es suyo)
    const { data: existing } = await supabase
      .from('customers').select('id').eq('id', customer_id).eq('store_id', store.id).single()
    customerId = existing?.id ?? null
  } else if (customer_name && customer_name.trim()) {
    // Cliente nuevo capturado en el POS
    const { data: customer } = await supabase
      .from('customers')
      .insert({
        store_id: store.id,
        name: customer_name.trim(),
        phone: customer_phone?.trim() || null,
      })
      .select('id')
      .single()
    customerId = customer?.id ?? null
  }

  // ─── Crear la venta (folio se genera por trigger) ────────
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      store_id: store.id,
      customer_id: customerId,
      folio: 'TEMP', // será reemplazado por el trigger
      subtotal,
      discount_amt,
      total,
      total_cost: totalCost,
      profit,
      payment_method,
      status: 'completed',
      notes: notes?.trim() || null,
    })
    .select('id, folio')
    .single()

  if (saleError || !sale) {
    return { success: false, error: 'Error al crear la venta' }
  }

  // ─── Insertar items (los triggers descuentan stock) ──────
  const saleItems = items.map(item => ({
    sale_id: sale.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_cost: item.unit_cost,
    subtotal: item.unit_price * item.quantity,
  }))

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItems)

  if (itemsError) {
    // Rollback: eliminar la venta huérfana
    await supabase.from('sales').delete().eq('id', sale.id)
    return { success: false, error: 'Error al registrar los productos de la venta' }
  }

  revalidatePath('/sales')
  revalidatePath('/dashboard')
  revalidatePath('/inventory')
  if (customerId) {
    revalidatePath('/customers')
    revalidatePath(`/customers/${customerId}`)
  }

  return { success: true, saleId: sale.id, folio: sale.folio }
}

// ─── Cancelar venta (devuelve stock vía trigger) ─────────────
export async function cancelSaleAction(saleId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return { success: false, error: 'Tienda no encontrada' }

  // El trigger handle_sale_cancel() devuelve el stock automáticamente
  const { error } = await supabase
    .from('sales')
    .update({ status: 'cancelled' })
    .eq('id', saleId)
    .eq('store_id', store.id)
    .eq('status', 'completed') // solo cancelar ventas completadas

  if (error) return { success: false, error: 'Error al cancelar la venta' }

  revalidatePath('/sales')
  revalidatePath('/dashboard')
  revalidatePath('/inventory')
  return { success: true }
}

// ─── Buscar productos para el POS ────────────────────────────
export async function searchProductsForPOS(query: string): Promise<{
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number
  cost_price: number
  stock: number
  image_url: string | null
}[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return []

  let q = supabase
    .from('products')
    .select('id, name, sku, barcode, sale_price, cost_price, stock, product_images(url, is_primary)')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('total_sold', { ascending: false })
    .limit(20)

  if (query && query.trim()) {
    // Buscar por nombre, SKU o código de barras
    q = q.or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.eq.${query}`)
  }

  const { data } = await q

  return (data ?? []).map(p => {
    const images = (p.product_images ?? []) as { url: string; is_primary: boolean }[]
    const primary = images.find(i => i.is_primary) ?? images[0]
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      sale_price: p.sale_price,
      cost_price: p.cost_price,
      stock: p.stock,
      image_url: primary?.url ?? null,
    }
  })
}
