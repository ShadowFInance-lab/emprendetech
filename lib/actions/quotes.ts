'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createSaleAction } from './sales'
import type { ActionResult } from './auth'

export interface QuoteItem {
  product_id: string
  product_name: string
  variant?: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_value?: number // valor de descuento ingresado
  discount_pct?: boolean  // true = porcentaje, false/undefined = monto
  note?: string
}

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada' | 'convertida'

export interface Quote {
  id: string
  store_id: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  customer_rfc: string | null
  folio: string
  status: QuoteStatus
  items: QuoteItem[]
  subtotal: number
  discount_amt: number
  total: number
  notes: string | null
  valid_until: string | null
  payment_method: string | null
  deposit_pct: number | null
  delivery_time: string | null
  public_token: string | null
  signature: string | null
  signed_at: string | null
  created_at: string
}

interface QuoteInput {
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  customer_address?: string
  customer_rfc?: string
  items: QuoteItem[]
  discount_amt?: number
  notes?: string
  valid_until?: string
  payment_method?: string
  deposit_pct?: number
  delivery_time?: string
  status?: QuoteStatus
}

function isMissingTable(err: { code?: string } | null) {
  return err?.code === '42P01' || err?.code === 'PGRST205'
}

// ─── Cálculos de líneas con descuento por producto ───────────
function lineGross(i: QuoteItem) { return i.unit_price * i.quantity }
function lineDiscountAmt(i: QuoteItem) {
  const v = i.discount_value ?? 0
  if (v <= 0) return 0
  const d = i.discount_pct ? lineGross(i) * (v / 100) : v
  return Math.min(Math.max(0, d), lineGross(i))
}
function lineTotal(i: QuoteItem) { return lineGross(i) - lineDiscountAmt(i) }

function totals(items: QuoteItem[], globalDiscount: number) {
  const subtotal = items.reduce((a, i) => a + lineTotal(i), 0)
  const total = Math.max(0, subtotal - (globalDiscount || 0))
  return { subtotal, total }
}

async function getStore(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
  return data?.id ?? null
}

/** Folio secuencial COT-0001, COT-0002… por tienda. */
async function nextFolio(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string) {
  const { count } = await supabase
    .from('quotes').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
  const n = (count ?? 0) + 1
  return `COT-${String(n).padStart(4, '0')}`
}

export async function getQuotes(): Promise<{ quotes: Quote[]; missingTable: boolean }> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { quotes: [], missingTable: false }
  const { data, error } = await supabase
    .from('quotes').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(300)
  if (error) return { quotes: [], missingTable: isMissingTable(error) }
  return { quotes: (data ?? []) as Quote[], missingTable: false }
}

export async function getQuote(id: string): Promise<Quote | null> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return null
  const { data } = await supabase.from('quotes').select('*').eq('id', id).eq('store_id', storeId).single()
  return (data as Quote) ?? null
}

function buildRow(input: QuoteInput) {
  const { subtotal, total } = totals(input.items, input.discount_amt ?? 0)
  return {
    customer_id: input.customer_id || null,
    customer_name: input.customer_name || null,
    customer_email: input.customer_email || null,
    customer_phone: input.customer_phone || null,
    customer_address: input.customer_address || null,
    customer_rfc: input.customer_rfc || null,
    items: input.items,
    subtotal,
    discount_amt: input.discount_amt ?? 0,
    total,
    notes: input.notes || null,
    valid_until: input.valid_until || null,
    payment_method: input.payment_method || null,
    deposit_pct: input.deposit_pct ?? null,
    delivery_time: input.delivery_time || null,
  }
}

export async function createQuoteAction(input: QuoteInput): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }
  if (!input.items || input.items.length === 0) return { success: false, error: 'Agrega al menos un producto' }

  const folio = await nextFolio(supabase, storeId)
  const public_token = randomBytes(16).toString('hex')

  const { data, error } = await supabase.from('quotes').insert({
    store_id: storeId,
    folio,
    status: input.status ?? 'borrador',
    public_token,
    ...buildRow(input),
  }).select('id').single()

  if (error) {
    if (isMissingTable(error)) return { success: false, error: 'Falta ejecutar la migración 015_quotes.sql en Supabase.' }
    // Si faltan columnas nuevas (migración 017), reintenta solo con lo básico
    if (error.code === '42703' || error.code === 'PGRST204' || /column|schema cache/i.test(error.message ?? '')) {
      const { subtotal, total } = totals(input.items, input.discount_amt ?? 0)
      const retry = await supabase.from('quotes').insert({
        store_id: storeId, folio, status: input.status ?? 'borrador',
        customer_id: input.customer_id || null, customer_name: input.customer_name || null,
        items: input.items, subtotal, discount_amt: input.discount_amt ?? 0, total,
        notes: input.notes || null, valid_until: input.valid_until || null,
      }).select('id').single()
      if (retry.error) return { success: false, error: 'No se pudo crear. Ejecuta la migración 017_quotes_pro.sql.' }
      revalidatePath('/quotes')
      return { success: true, id: retry.data.id }
    }
    return { success: false, error: 'No se pudo crear la cotización' }
  }
  revalidatePath('/quotes')
  return { success: true, id: data.id }
}

export async function updateQuoteAction(id: string, input: QuoteInput): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }
  const { error } = await supabase.from('quotes').update({
    ...buildRow(input),
    ...(input.status ? { status: input.status } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('store_id', storeId)
  if (error) return { success: false, error: 'No se pudo actualizar' }
  revalidatePath('/quotes'); revalidatePath(`/quotes/${id}`)
  return { success: true }
}

export async function setQuoteStatusAction(id: string, status: QuoteStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }
  const { error } = await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).eq('store_id', storeId)
  if (error) return { success: false, error: 'No se pudo cambiar el estado' }
  revalidatePath('/quotes'); revalidatePath(`/quotes/${id}`)
  return { success: true }
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }
  const { error } = await supabase.from('quotes').delete().eq('id', id).eq('store_id', storeId)
  if (error) return { success: false, error: 'No se pudo eliminar' }
  revalidatePath('/quotes')
  return { success: true }
}

const PAY_TO_SALE: Record<string, 'cash' | 'card' | 'transfer' | 'mercadopago' | 'other'> = {
  efectivo: 'cash', transferencia: 'transfer', tarjeta: 'card', mercadopago: 'mercadopago',
}

/** Convierte una cotización en venta (descuenta stock vía createSaleAction). */
export async function convertQuoteToSaleAction(id: string): Promise<ActionResult & { saleId?: string }> {
  const quote = await getQuote(id)
  if (!quote) return { success: false, error: 'Cotización no encontrada' }
  if (quote.status === 'convertida') return { success: false, error: 'Esta cotización ya se convirtió en venta' }

  // Sumar descuentos por línea al descuento global para conservar el total
  const itemDiscounts = quote.items.reduce((a, i) => a + lineDiscountAmt(i), 0)

  const result = await createSaleAction({
    items: quote.items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name + (i.variant ? ` (${i.variant})` : ''),
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost,
    })),
    discount_amt: (quote.discount_amt || 0) + itemDiscounts,
    payment_method: PAY_TO_SALE[quote.payment_method ?? ''] ?? 'cash',
    customer_id: quote.customer_id || undefined,
    customer_name: quote.customer_name || undefined,
    notes: `Generada desde cotización ${quote.folio}`,
  })
  if (!result.success) return { success: false, error: result.error ?? 'No se pudo crear la venta' }

  await setQuoteStatusAction(id, 'convertida')
  return { success: true, saleId: result.saleId }
}

// ─── ENLACE PÚBLICO (sin login) ──────────────────────────────
export interface PublicQuote {
  quote: Omit<Quote, 'items'> & { items: Omit<QuoteItem, 'unit_cost'>[] }
  store: { name: string; logo_url: string | null; phone: string | null; email: string | null; currency: string }
}

/** Lee una cotización por su token público (service role, filtrado por token exacto). */
export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!token) return null
  const admin = createAdminClient()
  const { data: q } = await admin.from('quotes').select('*').eq('public_token', token).maybeSingle()
  if (!q) return null
  const { data: store } = await admin
    .from('stores').select('name, logo_url, phone, email, currency').eq('id', q.store_id).maybeSingle()

  const quote = q as Quote
  // No exponer el costo al cliente
  const safeItems = quote.items.map((i) => {
    const rest = { ...i } as Partial<QuoteItem>
    delete rest.unit_cost
    return rest as Omit<QuoteItem, 'unit_cost'>
  })
  return {
    quote: { ...quote, items: safeItems },
    store: {
      name: store?.name ?? 'Mercanta Business',
      logo_url: store?.logo_url ?? null,
      phone: store?.phone ?? null,
      email: store?.email ?? null,
      currency: store?.currency ?? 'MXN',
    },
  }
}

/** El cliente acepta o rechaza desde el enlace público (con firma opcional). */
export async function respondPublicQuoteAction(
  token: string,
  decision: 'aceptada' | 'rechazada',
  signature?: string
): Promise<ActionResult> {
  if (!token) return { success: false, error: 'Enlace inválido' }
  const admin = createAdminClient()
  const { data: q } = await admin.from('quotes').select('id, status').eq('public_token', token).maybeSingle()
  if (!q) return { success: false, error: 'Cotización no encontrada' }
  if (q.status === 'convertida') return { success: false, error: 'Esta cotización ya fue procesada' }

  const update: Record<string, unknown> = { status: decision, updated_at: new Date().toISOString() }
  if (decision === 'aceptada' && signature) {
    update.signature = signature.slice(0, 300000) // límite defensivo del data URL
    update.signed_at = new Date().toISOString()
  }
  const { error } = await admin.from('quotes').update(update).eq('public_token', token)
  if (error) return { success: false, error: 'No se pudo registrar tu respuesta' }
  return { success: true }
}
