'use server'

import { cookies } from 'next/headers'
import { createPublicClient, createAdminClient } from '@/lib/supabase/server'
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
  variant_text: string | null
}
export interface CartView { items: CartItem[] }

interface RawItem { id: string; product_id: string | null; name: string; price: number | string; qty: number; image_url: string | null; variant_text?: string | null }
function mapItems(rows: RawItem[] | null): CartItem[] {
  return (rows ?? []).map(r => ({
    id: r.id, product_id: r.product_id ?? null, name: r.name,
    price: Number(r.price) || 0, qty: Number(r.qty) || 0, image_url: r.image_url ?? null,
    variant_text: r.variant_text ?? null,
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
  variantText?: string | null,
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
      cookieStore.set(COOKIE, id, { path: '/', maxAge: MAX_AGE, sameSite: 'lax', secure: isProd })
    }

    // Busca item existente con la misma variante.
    // Si la columna variant_text no existe aún (migración 043 pendiente),
    // ignora el error de columna y trata como "no existe" → insert.
    const isMissingCol = (e: { code?: string; message?: string } | null) =>
      !!e && (e.code === '42703' || /column|schema cache/i.test(e.message ?? ''))

    let existing: { id: string; qty: number } | null = null
    const baseQ = supabase.from('cart_items').select('id, qty').eq('cart_id', id).eq('product_id', item.product_id)
    const { data: ex, error: existErr } = await (
      variantText ? baseQ.eq('variant_text', variantText) : baseQ.is('variant_text', null)
    ).maybeSingle()
    if (!existErr) {
      existing = ex
    } else if (!isMissingCol(existErr)) {
      console.error('[cart] check existing error', existErr)
      return { items: [] }
    }
    // isMissingCol → existing remains null → caeremos al insert

    if (existing) {
      const { error: updErr } = await supabase.from('cart_items')
        .update({ qty: (Number(existing.qty) || 0) + qty }).eq('id', existing.id)
      if (updErr) { console.error('[cart] update qty error', updErr); return { items: [] } }
    } else {
      // Intenta con variant_text; si la columna falta, reintenta sin ella.
      let { error: insErr } = await supabase.from('cart_items').insert({
        cart_id: id, product_id: item.product_id, name: item.name,
        price: item.price, qty, image_url: item.image_url ?? null,
        variant_text: variantText ?? null,
      })
      if (isMissingCol(insErr)) {
        const r2 = await supabase.from('cart_items').insert({
          cart_id: id, product_id: item.product_id, name: item.name,
          price: item.price, qty, image_url: item.image_url ?? null,
        })
        insErr = r2.error
      }
      if (insErr) { console.error('[cart] insert item error', insErr); return { items: [] } }
    }
    return { items: await readItems(id) }
  } catch (e) { console.error('[cart] exception', e); return { items: [] } }
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

/**
 * Crea el pedido real desde el carrito: número de orden, guarda en BD y vacía
 * el carrito. Si la tienda tiene su cuenta de Stripe conectada, devuelve
 * además `checkoutUrl` para que el comprador PAGUE con tarjeta al instante;
 * el webhook marca el pedido como "pagado" al completarse el pago.
 */
export async function createOrderFromCartAction(input: CheckoutInput): Promise<ActionResult & { order_no?: string; checkoutUrl?: string }> {
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

    // Fetch reception preference from store (soporta multi-select)
    const { data: storeCfg } = await supabase.from('stores').select('online_reception_type, online_reception_value, slug, owner_id').eq('id', cart.store_id).single()
    const recType = storeCfg?.online_reception_type
    const recVal = storeCfg?.online_reception_value
    const prefix = recType === 'multi' ? 'Multi' : (recType === 'employee' ? 'Empleado' : 'Sucursal')
    const notesWithRec = [input.notes?.trim(), recVal ? `[Recepción: ${prefix} ${recVal}]` : ''].filter(Boolean).join(' ')

    // El id se genera AQUÍ (no con .select() de vuelta): el comprador anónimo
    // tiene permiso de INSERTAR pedidos pero no de leerlos (RLS) — un
    // insert().select() falla con el error de "migración 038" aunque la tabla
    // exista. Con el UUID propio el insert es puro y el checkout tiene su id.
    const orderId = crypto.randomUUID()
    const { error } = await supabase.from('online_orders').insert({
      id: orderId,
      store_id: cart.store_id,
      order_no,
      customer_name: input.customer_name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
      notes: notesWithRec || null,
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

    // ─── Pago con tarjeta (Stripe): checkout inmediato para el comprador ─────
    // Best-effort: si la tienda no tiene Stripe conectado o falta la clave de
    // plataforma, el pedido queda "pendiente" y el negocio cobra por su cuenta.
    const checkoutUrl = await createOrderStripeCheckout({
      orderId,
      orderNo: order_no,
      storeId: cart.store_id as string,
      ownerId: (storeCfg?.owner_id as string) ?? null,
      slug: (storeCfg?.slug as string) ?? null,
      total,
      customerName: input.customer_name.trim(),
    })

    return { success: true, order_no, checkoutUrl: checkoutUrl ?? undefined }
  } catch { return { success: false, error: 'Error' } }
}

/** Crea la sesión de Stripe Checkout del pedido (destination charge a la cuenta
 *  conectada de la tienda, con la comisión de plataforma según el plan del dueño). */
async function createOrderStripeCheckout(p: {
  orderId: string; orderNo: string; storeId: string
  ownerId: string | null; slug: string | null
  total: number; customerName: string
}): Promise<string | null> {
  try {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret || !(p.total > 0)) return null

    const admin = createAdminClient()
    const { data: cfg } = await admin.from('store_payment_config')
      .select('stripe_account_id').eq('store_id', p.storeId).maybeSingle()
    const accountId = cfg?.stripe_account_id as string | undefined
    if (!accountId) return null

    // Comisión por plan del dueño: Gratis 3% · Emprendedor/Negocio 0% · VIP 2%
    // (VIP: primeras 1,000 ventas del mes sin comisión, igual que el POS).
    let feePct = 0.03
    if (p.ownerId) {
      const { data: prof } = await admin.from('profiles').select('plan').eq('id', p.ownerId).maybeSingle()
      const plan = (prof?.plan as string) ?? 'free'
      feePct = plan === 'vip_plus' ? 0.02
        : (plan === 'emprendedor' || plan === 'negocio' || plan === 'lifetime') ? 0
        : 0.03
      if (plan === 'vip_plus') {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const { count } = await admin.from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', p.storeId).eq('status', 'completed').gte('created_at', monthStart)
        if ((count ?? 0) < 1000) feePct = 0
      }
    }
    const feeCents = Math.round(p.total * 100 * feePct)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://emprendetech.vercel.app'
    const backUrl = p.slug ? `${appUrl}/catalog/${p.slug}` : appUrl
    const body = new URLSearchParams({
      mode: 'payment',
      expires_at: String(Math.floor(Date.now() / 1000) + 3600),
      submit_type: 'pay',
      'payment_method_types[0]': 'card',
      locale: 'es-419',
      customer_creation: 'if_required',
      billing_address_collection: 'auto',
      'line_items[0][price_data][currency]': 'mxn',
      'line_items[0][price_data][product_data][name]': `Pedido ${p.orderNo}`,
      'line_items[0][price_data][unit_amount]': String(Math.round(p.total * 100)),
      'line_items[0][quantity]': '1',
      'payment_intent_data[transfer_data][destination]': accountId,
      'metadata[type]': 'order',
      'metadata[order_id]': p.orderId,
      'metadata[order_no]': p.orderNo,
      'metadata[store_id]': p.storeId,
      success_url: `${backUrl}?pago=exitoso`,
      cancel_url: `${backUrl}?pago=cancelado`,
    })
    if (feeCents > 0) body.set('payment_intent_data[application_fee_amount]', String(feeCents))

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      console.error('[order checkout] Stripe rechazó la sesión:', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const session = await res.json()
    return (session?.url as string) ?? null
  } catch (e) {
    console.error('[order checkout] error creando sesión:', e)
    return null
  }
}
