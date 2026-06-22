'use server'

import { cookies } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

const COOKIE = 'mb_cart'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 días

export interface CartItem {
  id: string
  product_id: string | null
  name: string
  price: number
  qty: number
  image_url: string | null
}
export interface CartView { items: CartItem[] }

interface RawItem { id: string; product_id: string | null; name: string; price: number | string; qty: number; image_url: string | null }
function mapItems(rows: RawItem[] | null): CartItem[] {
  return (rows ?? []).map(r => ({
    id: r.id, product_id: r.product_id ?? null, name: r.name,
    price: Number(r.price) || 0, qty: Number(r.qty) || 0, image_url: r.image_url ?? null,
  }))
}

async function getCartId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE)?.value ?? null
}

async function readItems(cartId: string): Promise<CartItem[]> {
  const supabase = createPublicClient()
  const { data } = await supabase.from('cart_items').select('*').eq('cart_id', cartId).order('created_at')
  return mapItems(data as RawItem[] | null)
}

/** Devuelve el carrito actual (vacío si no hay cookie). */
export async function getCartAction(): Promise<CartView> {
  try {
    const id = await getCartId()
    if (!id) return { items: [] }
    return { items: await readItems(id) }
  } catch { return { items: [] } }
}

/** Agrega un producto al carrito (crea el carrito + cookie si no existe). */
export async function addToCartAction(
  storeId: string,
  item: { product_id: string; name: string; price: number; image_url?: string | null },
  qty = 1,
): Promise<CartView> {
  try {
    const supabase = createPublicClient()
    let id = await getCartId()
    if (!id) {
      const { data: cart, error } = await supabase.from('carts').insert({ store_id: storeId }).select('id').single()
      if (error || !cart) {
        console.error('[cart] create cart error', error)
        return { items: [] }
      }
      id = cart.id as string
      const cookieStore = await cookies()
      const isProd = process.env.NODE_ENV === 'production'
      cookieStore.set(COOKIE, id, { 
        path: '/', 
        maxAge: MAX_AGE, 
        sameSite: 'lax',
        secure: isProd 
      })
    }
    // Si ya existe el mismo producto, suma cantidad.
    const { data: existing, error: existErr } = await supabase
      .from('cart_items').select('id, qty').eq('cart_id', id).eq('product_id', item.product_id).maybeSingle()
    if (existErr) {
      console.error('[cart] check existing error', existErr)
      return { items: [] }
    }
    if (existing) {
      const { error: updErr } = await supabase.from('cart_items').update({ qty: (Number(existing.qty) || 0) + qty }).eq('id', existing.id)
      if (updErr) {
        console.error('[cart] update qty error', updErr)
        return { items: [] }
      }
    } else {
      const { error: insErr } = await supabase.from('cart_items').insert({
        cart_id: id, product_id: item.product_id, name: item.name,
        price: item.price, qty, image_url: item.image_url ?? null,
      })
      if (insErr) {
        console.error('[cart] insert item error', insErr)
        return { items: [] }
      }
    }
    return { items: await readItems(id) }
  } catch { return { items: [] } }
}

/** Cambia la cantidad de un renglón (si llega a 0 se elimina). */
export async function setCartItemQtyAction(itemId: string, qty: number): Promise<CartView> {
  try {
    const id = await getCartId()
    if (!id) return { items: [] }
    const supabase = createPublicClient()
    let opError: { message?: string } | null = null
    if (qty <= 0) {
      const { error } = await supabase.from('cart_items').delete().eq('id', itemId).eq('cart_id', id)
      opError = error
    } else {
      const { error } = await supabase.from('cart_items').update({ qty }).eq('id', itemId).eq('cart_id', id)
      opError = error
    }
    if (opError) {
      console.error('[cart] setQty error', opError)
      return { items: [] }
    }
    return { items: await readItems(id) }
  } catch (e) { 
    console.error('[cart] setQty exception', e)
    return { items: [] } 
  }
}

/** Elimina un renglón del carrito. */
export async function removeCartItemAction(itemId: string): Promise<CartView> {
  try {
    const id = await getCartId()
    if (!id) return { items: [] }
    const supabase = createPublicClient()
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId).eq('cart_id', id)
    if (error) {
      console.error('[cart] remove error', error)
      return { items: [] }
    }
    return { items: await readItems(id) }
  } catch (e) { 
    console.error('[cart] remove exception', e)
    return { items: [] } 
  }
}

/** Vacía el carrito. */
export async function clearCartAction(): Promise<CartView> {
  try {
    const id = await getCartId()
    if (!id) return { items: [] }
    const supabase = createPublicClient()
    const { error } = await supabase.from('cart_items').delete().eq('cart_id', id)
    if (error) {
      console.error('[cart] clear error', error)
      return { items: [] }
    }
    const cookieStore = await cookies()
    const isProd = process.env.NODE_ENV === 'production'
    cookieStore.set(COOKIE, '', { path: '/', maxAge: 0, secure: isProd })
    return { items: [] }
  } catch (e) { 
    console.error('[cart] clear exception', e)
    return { items: [] } 
  }
}

export interface CheckoutInput {
  customer_name: string
  phone: string
  email?: string
  address: string
  colonia?: string
  city?: string
  state?: string
  zip?: string
  notes?: string
  payment_method: string
}

/** Crea el pedido real desde el carrito: número de orden, guarda en BD y vacía el carrito. */
export async function createOrderFromCartAction(input: CheckoutInput): Promise<ActionResult & { order_no?: string }> {
  try {
    if (!input.customer_name.trim() || !input.phone.trim() || !input.address.trim()) {
      return { success: false, error: 'Nombre, teléfono y dirección son obligatorios' }
    }
    const id = await getCartId()
    if (!id) return { success: false, error: 'Tu carrito está vacío' }
    const supabase = createPublicClient()
    const { data: cart } = await supabase.from('carts').select('store_id').eq('id', id).single()
    const { data: rawItems } = await supabase.from('cart_items').select('*').eq('cart_id', id).order('created_at')
    const items = mapItems(rawItems as RawItem[] | null)
    if (!cart || items.length === 0) return { success: false, error: 'Tu carrito está vacío' }

    const total = items.reduce((s, it) => s + it.price * it.qty, 0)
    const order_no = 'MB-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    const address = input.colonia?.trim()
      ? `${input.address.trim()}, Col. ${input.colonia.trim()}`
      : input.address.trim()

    const { error } = await supabase.from('online_orders').insert({
      store_id: cart.store_id,
      order_no,
      customer_name: input.customer_name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
      notes: input.notes?.trim() || null,
      payment_method: input.payment_method || null,
      items: items.map(it => ({ name: it.name, price: it.price, qty: it.qty })),
      total,
      status: 'pendiente',
    })
    if (error) return { success: false, error: 'No se pudo crear el pedido (¿corriste la migración 038?)' }

    // Vaciar carrito + cerrar cookie
    await supabase.from('cart_items').delete().eq('cart_id', id)
    const cookieStore = await cookies()
    const isProd = process.env.NODE_ENV === 'production'
    cookieStore.set(COOKIE, '', { path: '/', maxAge: 0, secure: isProd })
    return { success: true, order_no }
  } catch { return { success: false, error: 'Error' } }
}
