'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, Plus, Minus, FileText, Loader2, Package, X, Save, Send,
  User, Wallet, CalendarDays,
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
    customer_email?: string | null
    customer_phone?: string | null
    customer_address?: string | null
    customer_rfc?: string | null
    items: QuoteItem[]
    discount_amt: number
    notes?: string | null
    valid_until?: string | null
    payment_method?: string | null
    deposit_pct?: number | null
    delivery_time?: string | null
    status?: QuoteStatus
  }
}

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'mercadopago', label: 'Mercado Pago' },
]

function lineGross(i: QuoteItem) { return i.unit_price * i.quantity }
function lineDiscountAmt(i: QuoteItem) {
  const v = i.discount_value ?? 0
  if (v <= 0) return 0
  const d = i.discount_pct ? lineGross(i) * (v / 100) : v
  return Math.min(Math.max(0, d), lineGross(i))
}
function lineTotal(i: QuoteItem) { return lineGross(i) - lineDiscountAmt(i) }

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">{icon}</span>
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{children}</p>
    </div>
  )
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
  const [customerEmail, setCustomerEmail] = useState(initial?.customer_email ?? '')
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone ?? '')
  const [customerAddress, setCustomerAddress] = useState(initial?.customer_address ?? '')
  const [customerRfc, setCustomerRfc] = useState(initial?.customer_rfc ?? '')
  const [discount, setDiscount] = useState(String(initial?.discount_amt ?? 0))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? '')
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? '')
  const [depositPct, setDepositPct] = useState(initial?.deposit_pct != null ? String(initial.deposit_pct) : '')
  const [deliveryTime, setDeliveryTime] = useState(initial?.delivery_time ?? '')

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
        discount_value: 0, discount_pct: true, note: '',
      }]
    })
  }
  function patchItem(idx: number, patch: Partial<QuoteItem>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  const subtotal = items.reduce((a, i) => a + lineTotal(i), 0)
  const discountNum = Math.max(0, parseFloat(discount) || 0)
  const total = Math.max(0, subtotal - discountNum)
  const depositNum = Math.max(0, parseFloat(depositPct) || 0)
  const itemCount = items.reduce((a, i) => a + i.quantity, 0)

  function handleCustomerSelect(value: string) {
    setCustomerId(value)
    const c = customers.find(c => c.id === value)
    if (c) { setCustomerName(c.name); if (c.phone) setCustomerPhone(c.phone) }
  }

  function save(status: QuoteStatus) {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    const payload = {
      customer_id: customerId || undefined,
      customer_name: customerName.trim() || undefined,
      customer_email: customerEmail.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      customer_address: customerAddress.trim() || undefined,
      customer_rfc: customerRfc.trim() || undefined,
      items: items.map(i => ({ ...i, variant: i.variant?.trim() || undefined, note: i.note?.trim() || undefined })),
      discount_amt: discountNum,
      notes: notes.trim() || undefined,
      valid_until: validUntil || undefined,
      payment_method: paymentMethod || undefined,
      deposit_pct: depositNum || undefined,
      delivery_time: deliveryTime.trim() || undefined,
      status,
    }
    startTransition(async () => {
      if (mode === 'create') {
        const res = await createQuoteAction(payload)
        if (res.success && res.id) {
          toast.success(status === 'enviada' ? 'Cotización guardada' : 'Borrador guardado')
          router.push(`/quotes/${res.id}`); router.refresh()
        } else toast.error(res.error ?? 'No se pudo guardar')
      } else if (quoteId) {
        const res = await updateQuoteAction(quoteId, payload)
        if (res.success) { toast.success('Cotización actualizada'); router.refresh() }
        else toast.error(res.error ?? 'No se pudo actualizar')
      }
    })
  }

  const fieldCls = 'w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* IZQUIERDA: catálogo */}
      <div className="lg:col-span-3 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-9rem)]">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar producto del inventario…"
              className="pl-11 h-12 text-base rounded-xl border-gray-200 shadow-sm" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {products.map(p => {
                const inCart = items.find(x => x.product_id === p.id)
                return (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="group relative text-left bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="aspect-square bg-gray-100 relative">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={30} /></div>
                      )}
                      {inCart && (
                        <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                          {inCart.quantity}
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-white text-xs font-semibold flex items-center gap-1"><Plus size={13} /> Agregar</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">{p.name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-extrabold text-blue-600">{formatCurrency(p.sale_price, currency)}</span>
                        <span className="text-[10px] text-gray-400">{p.stock} uds</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <Package size={40} className="mx-auto mb-3" />
              <p className="text-sm">{query ? 'Sin resultados' : 'No hay productos. Agrégalos en Inventario.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* DERECHA: cotización */}
      <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-9rem)]">
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <FileText size={18} />
          <h2 className="font-semibold">Cotización</h2>
          {itemCount > 0 && <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">{itemCount} art.</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Cliente */}
          <div>
            <SectionHeader icon={<User size={13} />}>Datos del cliente</SectionHeader>
            <div className="space-y-2">
              {customers.length > 0 && (
                <select value={customerId} onChange={e => handleCustomerSelect(e.target.value)} className={fieldCls}>
                  <option value="">— Nuevo / sin registrar —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input value={customerName} onChange={e => { setCustomerName(e.target.value); setCustomerId('') }} placeholder="Nombre" className={fieldCls} />
              <div className="grid grid-cols-2 gap-2">
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Correo" className={fieldCls} />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Teléfono" className={fieldCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Dirección (opc.)" className={fieldCls} />
                <input value={customerRfc} onChange={e => setCustomerRfc(e.target.value)} placeholder="RFC (opc.)" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Productos */}
          <div>
            <SectionHeader icon={<Package size={13} />}>Productos agregados</SectionHeader>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
                <FileText size={34} />
                <p className="text-sm mt-2 text-gray-400">Sin productos</p>
                <p className="text-xs text-gray-300">Toca un producto de la izquierda</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm space-y-2.5">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                      <span className="text-sm font-extrabold text-gray-900">{formatCurrency(lineTotal(item), currency)}</span>
                      <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 mt-0.5"><X size={15} /></button>
                    </div>
                    <input value={item.variant ?? ''} onChange={e => patchItem(idx, { variant: e.target.value })}
                      placeholder="Variante (color / talla)…" className="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-gray-50" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* cantidad */}
                      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                        <button onClick={() => patchItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
                          className="w-7 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600"><Minus size={13} /></button>
                        <input type="number" min="1" value={item.quantity}
                          onChange={e => patchItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-10 h-8 text-center text-sm border-x border-gray-200" />
                        <button onClick={() => patchItem(idx, { quantity: item.quantity + 1 })}
                          className="w-7 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600"><Plus size={13} /></button>
                      </div>
                      {/* precio unitario */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">$</span>
                        <input type="number" min="0" step="0.01" value={item.unit_price}
                          onChange={e => patchItem(idx, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-20 h-8 text-right text-sm border border-gray-200 rounded-lg px-1.5" />
                      </div>
                      {/* descuento por línea */}
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[10px] text-gray-400">Desc.</span>
                        <input type="number" min="0" step="0.01" value={item.discount_value ?? 0}
                          onChange={e => patchItem(idx, { discount_value: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-14 h-8 text-right text-sm border border-gray-200 rounded-lg px-1.5" />
                        <button type="button" onClick={() => patchItem(idx, { discount_pct: !item.discount_pct })}
                          className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 text-xs font-bold text-gray-600 hover:bg-gray-100">
                          {item.discount_pct ? '%' : '$'}
                        </button>
                      </div>
                    </div>
                    <input value={item.note ?? ''} onChange={e => patchItem(idx, { note: e.target.value })}
                      placeholder="Nota del producto (opcional)…" className="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-gray-50" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cierre */}
          <div>
            <SectionHeader icon={<Wallet size={13} />}>Condiciones de cierre</SectionHeader>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={fieldCls}>
                  <option value="">Método de pago…</option>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" value={depositPct} onChange={e => setDepositPct(e.target.value)} placeholder="Anticipo" className={fieldCls} />
                  <span className="text-sm text-gray-400">%</span>
                </div>
              </div>
              <input value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} placeholder="Tiempo de entrega (ej. 3-5 días)" className={fieldCls} />
              <div className="relative">
                <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" value={validUntil ?? ''} onChange={e => setValidUntil(e.target.value)} className={`${fieldCls} pl-9`} />
              </div>
              <textarea value={notes ?? ''} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Observaciones / condiciones…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" />
            </div>
          </div>
        </div>

        {/* Footer: total destacado + guardar */}
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/60">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Descuento global ({currency})</span>
            <Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 h-9 text-right text-sm" />
          </div>

          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4">
            <div className="flex justify-between text-sm text-blue-100"><span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
            {discountNum > 0 && <div className="flex justify-between text-sm text-blue-100"><span>Descuento</span><span>-{formatCurrency(discountNum, currency)}</span></div>}
            <div className="flex justify-between items-end mt-1">
              <span className="text-sm font-medium text-blue-100">TOTAL</span>
              <span className="text-3xl font-black tracking-tight">{formatCurrency(total, currency)}</span>
            </div>
            {depositNum > 0 && (
              <div className="flex justify-between text-xs text-blue-200 mt-1 pt-2 border-t border-white/20">
                <span>Anticipo ({depositNum}%)</span><span>{formatCurrency(total * depositNum / 100, currency)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => save('borrador')} disabled={isPending} className="h-12 text-sm font-semibold">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save size={17} className="mr-1.5" /> Borrador</>}
            </Button>
            <Button onClick={() => save('enviada')} disabled={isPending}
              className="h-12 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 shadow-md">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send size={17} className="mr-1.5" /> Guardar</>}
            </Button>
          </div>
          <p className="text-[11px] text-center text-gray-400">Al guardar podrás generar PDF, imprimir y compartir por WhatsApp.</p>
        </div>
      </div>
    </div>
  )
}
