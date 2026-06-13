'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, Plus, Minus, FileText, Loader2, Package, X, Save, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchProductsForPOS } from '@/lib/actions/sales'
import { createQuoteAction, updateQuoteAction } from '@/lib/actions/quotes'
import type { QuoteItem, QuoteStatus } from '@/lib/actions/quotes'
import { formatCurrency } from '@/lib/utils/format'

type POSProduct = {
  id: string; name: string; sku: string | null; barcode: string | null
  sale_price: number; cost_price: number; stock: number; image_url: string | null
}

interface CustomerOpt { id: string; name: string; phone: string | null }

interface QuoteBuilderProps {
  mode: 'create' | 'edit'
  quoteId?: string
  customers: CustomerOpt[]
  currency?: string
  initial?: {
    customer_id?: string | null
    customer_name?: string | null
    items: QuoteItem[]
    discount_amt: number
    notes?: string | null
    valid_until?: string | null
    status?: QuoteStatus
  }
}

export default function QuoteBuilder({ mode, quoteId, customers, currency = 'MXN', initial }: QuoteBuilderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<POSProduct[]>([])
  const [loading, setLoading] = useState(false)

  const [items, setItems] = useState<QuoteItem[]>(initial?.items ?? [])
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? '')
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? '')
  const [discount, setDiscount] = useState(String(initial?.discount_amt ?? 0))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? '')

  const search = useCallback(async (q: string) => {
    setLoading(true)
    setProducts(await searchProductsForPOS(q))
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  function addProduct(p: POSProduct) {
    setItems(prev => {
      const i = prev.findIndex(x => x.product_id === p.id && !x.variant)
      if (i >= 0) {
        const copy = [...prev]
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 }
        return copy
      }
      return [...prev, {
        product_id: p.id, product_name: p.name, variant: '',
        quantity: 1, unit_price: p.sale_price, unit_cost: p.cost_price,
      }]
    })
  }

  function patchItem(idx: number, patch: Partial<QuoteItem>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal = items.reduce((a, i) => a + i.unit_price * i.quantity, 0)
  const discountNum = Math.max(0, parseFloat(discount) || 0)
  const total = Math.max(0, subtotal - discountNum)

  function handleCustomerSelect(value: string) {
    setCustomerId(value)
    const c = customers.find(c => c.id === value)
    if (c) setCustomerName(c.name)
  }

  function save(status: QuoteStatus) {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    const payload = {
      customer_id: customerId || undefined,
      customer_name: customerName.trim() || undefined,
      items: items.map(i => ({ ...i, variant: i.variant?.trim() || undefined })),
      discount_amt: discountNum,
      notes: notes.trim() || undefined,
      valid_until: validUntil || undefined,
      status,
    }
    startTransition(async () => {
      if (mode === 'create') {
        const res = await createQuoteAction(payload)
        if (res.success && res.id) {
          toast.success(status === 'enviada' ? 'Cotización guardada y lista para enviar' : 'Borrador guardado')
          router.push(`/quotes/${res.id}`)
          router.refresh()
        } else {
          toast.error(res.error ?? 'No se pudo guardar')
        }
      } else if (quoteId) {
        const res = await updateQuoteAction(quoteId, payload)
        if (res.success) {
          toast.success('Cotización actualizada')
          router.refresh()
        } else {
          toast.error(res.error ?? 'No se pudo actualizar')
        }
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* ─── IZQUIERDA: catálogo ─────────────────────────── */}
      <div className="lg:col-span-3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-9rem)]">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto del inventario..." className="pl-10" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map(p => (
                <button key={p.id} onClick={() => addProduct(p)}
                  className="group text-left bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-md transition-all">
                  <div className="aspect-square bg-gray-100 relative">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={28} /></div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">{p.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-blue-600">{formatCurrency(p.sale_price, currency)}</span>
                      <span className="text-[10px] text-gray-400">{p.stock} uds</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Package size={36} className="mx-auto mb-3" />
              <p className="text-sm">{query ? 'Sin resultados' : 'No hay productos. Agrégalos en Inventario.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── DERECHA: cotización ─────────────────────────── */}
      <div className="lg:col-span-2 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-9rem)]">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <FileText size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Cotización</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Cliente */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Cliente</label>
            {customers.length > 0 && (
              <select value={customerId} onChange={e => handleCustomerSelect(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-gray-200 rounded-lg bg-white">
                <option value="">— Nuevo / sin registrar —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <Input value={customerName} onChange={e => { setCustomerName(e.target.value); setCustomerId('') }}
              placeholder="Nombre del cliente" className="h-9 text-sm" />
          </div>

          {/* Items */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <FileText size={40} />
              <p className="text-sm mt-3 text-gray-400">Sin productos</p>
              <p className="text-xs text-gray-300">Toca un producto para agregarlo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                    </div>
                    <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                  </div>
                  <input value={item.variant ?? ''} onChange={e => patchItem(idx, { variant: e.target.value })}
                    placeholder="Variante (color / talla)…"
                    className="w-full h-7 px-2 text-xs border border-gray-200 rounded bg-white" />
                  <div className="flex items-center gap-2">
                    {/* cantidad */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => patchItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
                        className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Minus size={12} /></button>
                      <input type="number" min="1" value={item.quantity}
                        onChange={e => patchItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-12 h-6 text-center text-sm border border-gray-200 rounded" />
                      <button onClick={() => patchItem(idx, { quantity: item.quantity + 1 })}
                        className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Plus size={12} /></button>
                    </div>
                    {/* precio unitario editable */}
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-xs text-gray-400">$</span>
                      <input type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => patchItem(idx, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-20 h-6 text-right text-sm border border-gray-200 rounded px-1" />
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold text-gray-900">
                    {formatCurrency(item.unit_price * item.quantity, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Vencimiento + observaciones */}
          <div className="space-y-2 pt-1">
            <div>
              <label className="text-xs font-medium text-gray-500">Válida hasta</label>
              <Input type="date" value={validUntil ?? ''} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Observaciones</label>
              <textarea value={notes ?? ''} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Condiciones, tiempos de entrega, notas…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
            </div>
          </div>
        </div>

        {/* Footer: totales + guardar */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Descuento ({currency})</span>
            <Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 h-8 text-right text-sm" />
          </div>
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
            {discountNum > 0 && <div className="flex justify-between text-sm text-red-500"><span>Descuento</span><span>-{formatCurrency(discountNum, currency)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-gray-900"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => save('borrador')} disabled={isPending} className="h-11">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save size={16} className="mr-1" /> Borrador</>}
            </Button>
            <Button onClick={() => save('enviada')} disabled={isPending} className="h-11 bg-blue-600 hover:bg-blue-700">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send size={16} className="mr-1" /> Guardar</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
