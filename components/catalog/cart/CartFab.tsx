'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ShoppingCart, X, Plus, Minus, Trash2, Loader2, Check, ChevronLeft, ShoppingBag } from 'lucide-react'
import { useCart } from './CartProvider'
import { createOrderFromCartAction, type CheckoutInput } from '@/lib/actions/cart'
import { formatCurrency } from '@/lib/utils/format'

const PAYMENTS = ['Pago contra entrega', 'Transferencia']

export default function CartFab() {
  const cart = useCart()
  const { enabled, items, count, subtotal, color, currency, open, view, setOpen, openCart, goCheckout, setQty, remove, clear, finish, lastOrderNo, storeName } = cart

  const [f, setF] = useState<CheckoutInput>({ customer_name: '', phone: '', email: '', address: '', colonia: '', city: '', state: '', zip: '', notes: '', payment_method: PAYMENTS[0] })
  const [isPending, startTransition] = useTransition()

  if (!enabled) return null

  function set<K extends keyof CheckoutInput>(k: K, v: string) { setF(p => ({ ...p, [k]: v })) }

  function submit() {
    if (!f.customer_name.trim() || !f.phone.trim() || !f.address.trim()) { toast.error('Nombre, teléfono y dirección son obligatorios'); return }
    startTransition(async () => {
      const r = await createOrderFromCartAction(f)
      if (!r.success || !r.order_no) { toast.error(r.error ?? 'Error'); return }
      finish(r.order_no)
    })
  }

  const input = (k: keyof CheckoutInput, ph: string, type = 'text') => (
    <input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder={ph} type={type}
      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
  )

  return (
    <>
      {/* Botón flotante del carrito */}
      <button type="button" onClick={openCart}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 text-white pl-4 pr-5 py-3.5 rounded-full shadow-2xl transition-all hover:scale-105"
        style={{ backgroundColor: color }} aria-label="Ver carrito">
        <div className="relative">
          <ShoppingCart size={24} />
          {count > 0 && (
            <span className="absolute -top-2.5 -right-2.5 min-w-[20px] h-5 px-1 rounded-full bg-white text-[11px] font-extrabold flex items-center justify-center" style={{ color }}>
              {count}
            </span>
          )}
        </div>
        <span className="text-base font-bold hidden sm:inline">Carrito</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 text-white shrink-0" style={{ backgroundColor: color }}>
              <p className="text-sm font-bold flex items-center gap-2">
                {view === 'checkout' && <button onClick={openCart} className="text-white/80 hover:text-white"><ChevronLeft size={18} /></button>}
                {view === 'cart' ? <><ShoppingCart size={17} /> Tu carrito</> : view === 'checkout' ? <><ShoppingBag size={17} /> Finalizar compra</> : <><Check size={17} /> Pedido enviado</>}
              </p>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>

            {/* ── Vista CARRITO ── */}
            {view === 'cart' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {items.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <ShoppingCart size={44} className="mx-auto mb-3 opacity-40" />
                      <p className="font-semibold text-gray-600">Tu carrito está vacío</p>
                      <p className="text-sm">Agrega productos del catálogo.</p>
                    </div>
                  ) : items.map(it => (
                    <div key={it.id} className="flex gap-3 items-center border border-gray-100 rounded-xl p-2.5">
                      <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {it.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📦</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{it.name}</p>
                        <p className="text-sm font-bold" style={{ color }}>{formatCurrency(it.price, currency)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => setQty(it.id, it.qty - 1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus size={12} /></button>
                          <span className="text-sm font-semibold w-6 text-center">{it.qty}</span>
                          <button onClick={() => setQty(it.id, it.qty + 1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus size={12} /></button>
                          <button onClick={() => remove(it.id)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length > 0 && (
                    <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 inline-flex items-center gap-1"><Trash2 size={12} /> Vaciar carrito</button>
                  )}
                </div>
                {items.length > 0 && (
                  <div className="border-t border-gray-100 p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-extrabold text-gray-900 text-lg">{formatCurrency(subtotal, currency)}</span>
                    </div>
                    <button onClick={goCheckout} className="w-full h-12 rounded-xl text-white font-bold hover:opacity-90 transition-all" style={{ backgroundColor: color }}>
                      Ir a pagar
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Vista CHECKOUT ── */}
            {view === 'checkout' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm flex justify-between">
                    <span className="text-gray-500">{count} producto{count !== 1 ? 's' : ''}</span>
                    <strong>{formatCurrency(subtotal, currency)}</strong>
                  </div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Tus datos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">{input('customer_name', 'Nombre completo *')}</div>
                    {input('phone', 'Teléfono *', 'tel')}
                    {input('email', 'Correo', 'email')}
                  </div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Dirección de entrega</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">{input('address', 'Calle y número *')}</div>
                    <div className="col-span-2">{input('colonia', 'Colonia')}</div>
                    {input('city', 'Ciudad')}
                    {input('state', 'Estado')}
                    {input('zip', 'Código postal')}
                    <div className="col-span-2">{input('notes', 'Referencias (entre calles, color de casa…)')}</div>
                  </div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Método de pago</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENTS.map(p => (
                      <button key={p} type="button" onClick={() => set('payment_method', p)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border ${f.payment_method === p ? 'text-white border-transparent' : 'border-gray-200 text-gray-600'}`}
                        style={f.payment_method === p ? { backgroundColor: color } : undefined}>{p}</button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">El negocio recibe tu pedido y te contacta para confirmar el pago y la entrega.</p>
                </div>
                <div className="border-t border-gray-100 p-4 shrink-0">
                  <button onClick={submit} disabled={isPending}
                    className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-white font-bold hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: color }}>
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <><ShoppingBag size={18} /> Enviar pedido · {formatCurrency(subtotal, currency)}</>}
                  </button>
                </div>
              </>
            )}

            {/* ── Vista ÉXITO ── */}
            {view === 'done' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={34} /></span>
                <p className="text-lg font-bold text-gray-900">¡Pedido enviado!</p>
                <p className="text-sm text-gray-500">Tu número de orden es</p>
                <p className="text-2xl font-extrabold font-mono" style={{ color }}>{lastOrderNo}</p>
                <p className="text-sm text-gray-500">{storeName} recibió tu pedido y te contactará para confirmar el pago y la entrega.</p>
                <button onClick={() => setOpen(false)} className="mt-3 px-6 py-2.5 rounded-xl text-white font-semibold" style={{ backgroundColor: color }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
