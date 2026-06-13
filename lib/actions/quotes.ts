'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createSaleAction } from './sales'
import type { ActionResult } from './auth'

export interface QuoteItem {
  product_id: string
  product_name: string
  variant?: string
  quantity: number
  unit_price: number
  unit_cost: number
}

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada' | 'convertida'

export interface Quote {
  id: string
  store_id: string
  customer_id: string | null
  customer_name: string | null
  folio: string
  status: QuoteStatus
  items: QuoteItem[]
  subtotal: number
  discount_amt: number
  total: number
  notes: string | null
  valid_until: string | null
  created_at: string
}

interface QuoteInput {
  customer_id?: string
  customer_name?: string
  items: QuoteItem[]
  discount_amt?: number
  notes?: string
  valid_until?: string
  status?: QuoteStatus
}

function isMissingTable(err: { code?: string } | null) {
  return err?.code === '42P01' || err?.code === 'PGRST205'
}

async function getStore(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
  return data?.id ?? null
}

function totals(items: QuoteItem[], discount: number) {
  const subtotal = items.reduce((a, i) => a + i.unit_price * i.quantity, 0)
  const total = Math.max(0, subtotal - (discount || 0))
  return { subtotal, total }
}

export async function getQuotes(): Promise<{ quotes: Quote[]; missingTable: boolean }> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { quotes: [], missingTable: false }
  const { data, error } = await supabase
    .from('quotes').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(200)
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

export async function createQuoteAction(input: QuoteInput): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }
  if (!input.items || input.items.length === 0) return { success: false, error: 'Agrega al menos un producto' }

  const { subtotal, total } = totals(input.items, input.discount_amt ?? 0)
  const folio = `COT-${Date.now().toString().slice(-6)}`

  const { data, error } = await supabase.from('quotes').insert({
    store_id: storeId,
    customer_id: input.customer_id || null,
    customer_name: input.customer_name || null,
    folio,
    status: input.status ?? 'borrador',
    items: input.items,
    subtotal,
    discount_amt: input.discount_amt ?? 0,
    total,
    notes: input.notes || null,
    valid_until: input.valid_until || null,
  }).select('id').single()

  if (error) {
    if (isMissingTable(error)) return { success: false, error: 'Falta ejecutar la migración 015_quotes.sql en Supabase.' }
    return { success: false, error: 'No se pudo crear la cotización' }
  }
  revalidatePath('/quotes')
  return { success: true, id: data.id }
}

export async function updateQuoteAction(id: string, input: QuoteInput): Promise<ActionResult> {
  const supabase = await createClient()
  const storeId = await getStore(supabase)
  if (!storeId) return { success: false, error: 'No autenticado' }
  const { subtotal, total } = totals(input.items, input.discount_amt ?? 0)
  const { error } = await supabase.from('quotes').update({
    customer_id: input.customer_id || null,
    customer_name: input.customer_name || null,
    items: input.items,
    subtotal,
    discount_amt: input.discount_amt ?? 0,
    total,
    notes: input.notes || null,
    valid_until: input.valid_until || null,
    ...(input.status ? { status: input.status } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('store_id', storeId)
  if (error) return { success: false, error: 'No se pudo actualizar' }
  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)
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

/** Convierte una cotización en venta (reusa createSaleAction) y la marca como 'convertida'. */
export async function convertQuoteToSaleAction(id: string): Promise<ActionResult & { saleId?: string }> {
  const quote = await getQuote(id)
  if (!quote) return { success: false, error: 'Cotización no encontrada' }
  if (quote.status === 'convertida') return { success: false, error: 'Esta cotización ya se convirtió en venta' }

  const result = await createSaleAction({
    items: quote.items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name + (i.variant ? ` (${i.variant})` : ''),
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost,
    })),
    discount_amt: quote.discount_amt,
    payment_method: 'cash',
    customer_id: quote.customer_id || undefined,
    customer_name: quote.customer_name || undefined,
    notes: `Generada desde cotización ${quote.folio}`,
  })
  if (!result.success) return { success: false, error: result.error ?? 'No se pudo crear la venta' }

  await setQuoteStatusAction(id, 'convertida')
  return { success: true, saleId: result.saleId }
}
