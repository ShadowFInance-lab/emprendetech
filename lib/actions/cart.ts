'use server'

import { cookies } from 'next/headers'
import { createPublicClient, createAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/utils/app-url'
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
 * PAGO PRIMERO — inicia el Checkout de Stripe con TODOS los datos del pedido
 * viajando en la metadata de la sesión.
 *
 * IMPORTANTE (nuevo flujo): esta acción NO crea el pedido ni vacía el carrito.
 * El pedido se crea EXCLUSIVAMENTE cuando Stripe confirma el pago, en el webhook
 * (`checkout.session.completed`). Así jamás quedan pedidos "pendientes" sin
 * pagar contaminando Ventas Online.
 *
 *   Cliente → Checkout Stripe → Pago → Webhook → Pedido creado (Pagado)
 *
 * Devuelve `checkoutUrl` para redirigir al comprador. Si no se puede iniciar el
 * cobro (falta STRIPE_SECRET_KEY o Stripe rechaza la sesión) devuelve `error` y
 * NO se crea absolutamente nada.
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
    if (!(total > 0)) return { success: false, error: 'El total del pedido no es válido' }
    const order_no = 'MB-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    const address = input.colonia?.trim()
      ? `${input.address.trim()}, Col. ${input.colonia.trim()}`
      : input.address.trim()

    // Preferencia de recepción de la tienda (sucursal / empleado / multi)
    const { data: storeCfg } = await supabase.from('stores')
      .select('online_reception_type, online_reception_value, slug, owner_id').eq('id', cart.store_id).single()
    const recType = storeCfg?.online_reception_type
    const recVal = storeCfg?.online_reception_value
    const prefix = recType === 'multi' ? 'Multi' : (recType === 'employee' ? 'Empleado' : 'Sucursal')
    const notesWithRec = [input.notes?.trim(), recVal ? `[Recepción: ${prefix} ${recVal}]` : ''].filter(Boolean).join(' ')

    // Inicia el cobro. El pedido NO se guarda aquí: sus datos viajan en la
    // metadata (más el cart_id como respaldo) y lo crea el webhook al pagarse.
    const checkout = await createOrderStripeCheckout({
      cartId: id,
      orderNo: order_no,
      storeId: cart.store_id as string,
      ownerId: (storeCfg?.owner_id as string) ?? null,
      slug: (storeCfg?.slug as string) ?? null,
      total,
      items,
      customer: {
        name: input.customer_name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || '',
        address,
        city: input.city?.trim() || '',
        state: input.state?.trim() || '',
        zip: input.zip?.trim() || '',
        notes: notesWithRec,
      },
    })

    if (!checkout.url) {
      return { success: false, error: checkout.error ?? 'No se pudo iniciar el pago con Stripe. Intenta de nuevo.' }
    }
    return { success: true, order_no, checkoutUrl: checkout.url }
  } catch (e) {
    console.error('[cart checkout] error:', e)
    return { success: false, error: 'Error al iniciar el pago' }
  }
}

/**
 * Crea la sesión de Stripe Checkout del pedido con TODA la información en la
 * metadata (para que el webhook pueda construir el pedido tras el pago):
 * - `type=order` + datos del cliente + `total` + `items` compactos + `cart_id`.
 * - Destination charge + comisión por plan SOLO si la tienda tiene su cuenta de
 *   Stripe conectada; si no, el cobro entra a la cuenta de la PLATAFORMA (el
 *   pago se realiza igual y el pedido queda Pagado).
 * Devuelve `{ url }` o `{ url: null, error }` — nunca lanza.
 */
async function createOrderStripeCheckout(p: {
  cartId: string; orderNo: string; storeId: string
  ownerId: string | null; slug: string | null
  total: number; items: CartItem[]
  customer: { name: string; phone: string; email: string; address: string; city: string; state: string; zip: string; notes: string }
}): Promise<{ url: string | null; error?: string }> {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    console.error('[order checkout] falta STRIPE_SECRET_KEY: no se puede cobrar en línea')
    return { url: null, error: 'Los pagos en línea aún no están configurados. Contacta a la tienda.' }
  }
  if (!(p.total > 0)) return { url: null, error: 'El total del pedido no es válido' }

  // ── Cuenta conectada + comisión por plan ──
  // Va en SU PROPIO try: si falla (p. ej. falta SUPABASE_SERVICE_ROLE_KEY y
  // createAdminClient() lanza, o la tabla no existe), NO se cae el checkout — se
  // cobra en MODO PLATAFORMA. Antes cualquier fallo aquí caía al catch general y
  // mostraba el genérico "Error creando el pago con Stripe", ocultando la causa.
  let accountId: string | undefined
  let feePct = 0.03
  try {
    const admin = createAdminClient()
    const { data: cfg, error: cfgErr } = await admin.from('store_payment_config')
      .select('stripe_account_id').eq('store_id', p.storeId).maybeSingle()
    if (cfgErr) console.error('[order checkout] leyendo store_payment_config:', cfgErr.message)
    accountId = (cfg?.stripe_account_id as string | undefined) || undefined
    // Comisión por plan del dueño: Gratis 3% · Emprendedor/Negocio 0% · VIP 2%
    // (VIP: primeras 1,000 ventas del mes sin comisión, igual que el POS).
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
  } catch (e) {
    console.error('[order checkout] no se pudo leer cuenta/plan; sigo en MODO PLATAFORMA:', e instanceof Error ? e.message : e)
    accountId = undefined
    feePct = 0.03
  }
  const feeCents = Math.round(p.total * 100 * feePct)
  console.log(`[order checkout] pedido ${p.orderNo} · total ${p.total} · modo ${accountId ? 'destination ' + accountId : 'plataforma'} · fee ${feeCents}¢`)

  const appUrl = getAppUrl()
  const backUrl = p.slug ? `${appUrl}/catalog/${p.slug}` : appUrl
  const c = p.customer

  // Items compactos para metadata: [[nombre(≤40), precio, cant], ...]. Si no
  // caben (límite 500 chars/valor) se omiten y el webhook los reconstruye por cart_id.
  const compactItems = JSON.stringify(p.items.map(it => [String(it.name ?? 'Producto').slice(0, 40), it.price, it.qty]))

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
    'metadata[type]': 'order',
    'metadata[order_no]': p.orderNo,
    'metadata[store_id]': p.storeId,
    'metadata[cart_id]': p.cartId,
    'metadata[total]': String(p.total),
    'metadata[cust_name]': c.name.slice(0, 200),
    'metadata[phone]': c.phone.slice(0, 60),
    'metadata[email]': c.email.slice(0, 120),
    'metadata[address]': c.address.slice(0, 300),
    'metadata[city]': c.city.slice(0, 80),
    'metadata[state]': c.state.slice(0, 80),
    'metadata[zip]': c.zip.slice(0, 20),
    'metadata[notes]': c.notes.slice(0, 300),
    success_url: `${backUrl}?pago=exitoso`,
    cancel_url: `${backUrl}?pago=cancelado`,
  })
  if (compactItems.length <= 480) body.set('metadata[items]', compactItems)
  // Destination charge + comisión SOLO si la tienda tiene cuenta conectada.
  if (accountId) {
    body.set('payment_intent_data[transfer_data][destination]', accountId)
    if (feeCents > 0) body.set('payment_intent_data[application_fee_amount]', String(feeCents))
  }

  // ── Llamada a Stripe. Aquí SÍ devolvemos el error REAL (de Stripe o excepción). ──
  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const raw = await res.text()
    if (!res.ok) {
      let stripeMsg = ''
      try { stripeMsg = (JSON.parse(raw)?.error?.message as string) || '' } catch { /* no era json */ }
      console.error('[order checkout] Stripe rechazó la sesión:', res.status, raw.slice(0, 500))
      return { url: null, error: `Stripe rechazó el pago (HTTP ${res.status})${stripeMsg ? ': ' + stripeMsg : ''}` }
    }
    let session: { url?: string; id?: string }
    try { session = JSON.parse(raw) } catch { return { url: null, error: 'Stripe devolvió una respuesta no válida' } }
    if (!session.url) return { url: null, error: 'Stripe no devolvió el enlace de pago' }
    console.log('[order checkout] ✅ sesión creada', session.id, '· pedido', p.orderNo)
    return { url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[order checkout] EXCEPCIÓN llamando a Stripe:', msg)
    return { url: null, error: `Error creando el pago con Stripe: ${msg}` }
  }
}
