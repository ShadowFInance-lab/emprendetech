'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ShoppingBag, X, Loader2, Check } from 'lucide-react'
import { createOnlineOrderAction } from '@/lib/actions/orders'

interface Props {
  storeId: string
  storeName: string
  whatsapp?: string | null
  product: { name: string; price: number; url: string }
  color?: string
}

const PAYMENTS = ['Mercado Pago', 'Tarjeta', 'Transferencia', 'Efectivo contra entrega']

export default function OnlineBuyButton({ storeId, storeName, whatsapp, product, color = '#2563EB' }: Props) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [f, setF] = useState({ customer_name: '', phone: '', email: '', address: '', city: '', state: '', zip: '', notes: '', payment_method: 'Mercado Pago' })

  function set<K extends keyof typeof f>(k: K, v: string) { setF(p => ({ ...p, [k]: v })) }

  function submit() {
    if (!f.customer_name.trim() || !f.phone.trim() || !f.address.trim()) { toast.error('Nombre, teléfono y dirección son obligatorios'); return }
    startTransition(async () => {
      const r = await createOnlineOrderAction({ store_id: storeId, ...f, items: [{ name: product.name, price: product.price, qty: 1 }], total: product.price })
      if (!r.success) { toast.error(r.error ?? 'Error'); return }
      setDone(true)
      if (whatsapp) {
        const phone = whatsapp.replace(/\D/g, '')
        const msg = [
          `🛒 *Pedido Online* — ${storeName}`, '',
          `*Producto:* ${product.name}`, `*Total:* $${product.price}`, '',
          `*Cliente:* ${f.customer_name}`, `*Tel:* ${f.phone}`, f.email && `*Correo:* ${f.email}`,
          `*Dirección:* ${f.address}${f.city ? `, ${f.city}` : ''}${f.state ? `, ${f.state}` : ''}${f.zip ? ` CP ${f.zip}` : ''}`,
          f.notes && `*Referencias:* ${f.notes}`, `*Pago:* ${f.payment_method}`,
        ].filter(Boolean).join('\n')
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
      }
    })
  }

  const input = (k: keyof typeof f, ph: string, type = 'text') => (
    <input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={ph} type={type}
      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
  )

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setDone(false) }}
        className="flex w-full items-center justify-center gap-2.5 font-bold rounded-2xl py-4 text-base text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
        style={{ backgroundColor: color }}>
        <ShoppingBag size={20} /> Compra Online
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 text-white" style={{ backgroundColor: color }}>
              <p className="text-sm font-bold flex items-center gap-2"><ShoppingBag size={17} /> Compra Online</p>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>

            {done ? (
              <div className="p-8 text-center space-y-3">
                <span className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><Check size={28} /></span>
                <p className="font-bold text-gray-900">¡Pedido enviado!</p>
                <p className="text-sm text-gray-500">El negocio recibió tu pedido de <strong>{product.name}</strong> y te contactará para confirmar entrega y pago.</p>
                <button onClick={() => setOpen(false)} className="mt-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: color }}>Cerrar</button>
              </div>
            ) : (
              <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
                  <span className="text-gray-500">Producto:</span> <strong>{product.name}</strong> · <strong>${product.price}</strong>
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
                <button onClick={submit} disabled={isPending}
                  className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 mt-1" style={{ backgroundColor: color }}>
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <><ShoppingBag size={16} /> Enviar pedido</>}
                </button>
                <p className="text-[11px] text-gray-400 text-center">Tu pedido llega al negocio; te contactará para confirmar pago y envío.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
