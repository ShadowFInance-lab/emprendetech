'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Inbox, Loader2, Phone, MapPin, CreditCard, RefreshCw } from 'lucide-react'
import { listOnlineOrdersAction, updateOnlineOrderStatusAction, ORDER_STATUSES, type OnlineOrder, type OrderStatus } from '@/lib/actions/orders'
import { formatCurrency } from '@/lib/utils/format'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmado: 'bg-blue-100 text-blue-700 border-blue-200',
  pagado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  preparando: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  enviado: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  entregado: 'bg-green-100 text-green-700 border-green-200',
  cancelado: 'bg-red-100 text-red-600 border-red-200',
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmtDate = (s: string) => new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function OrdersPanel() {
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todos' | OrderStatus>('todos')
  const [isPending, startTransition] = useTransition()

  async function load() { setLoading(true); setOrders(await listOnlineOrdersAction()); setLoading(false) }
  useEffect(() => { load() }, [])

  function setStatus(id: string, status: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    startTransition(async () => {
      const r = await updateOnlineOrderStatusAction(id, status)
      if (!r.success) { toast.error(r.error ?? 'Error'); load() } else toast.success('Estado actualizado')
    })
  }

  const shown = filter === 'todos' ? orders : orders.filter(o => o.status === filter)

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>

  return (
    <div className="space-y-4">
      {/* Filtros por estado */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['todos', ...ORDER_STATUSES] as const).map(st => {
          const count = st === 'todos' ? orders.length : orders.filter(o => o.status === st).length
          return (
            <button key={st} type="button" onClick={() => setFilter(st)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${filter === st ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {cap(st)} <span className="opacity-60">{count}</span>
            </button>
          )
        })}
        <button type="button" onClick={load} className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><RefreshCw size={13} /> Actualizar</button>
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Inbox size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-700">Sin pedidos {filter !== 'todos' ? `«${cap(filter)}»` : 'todavía'}</p>
          <p className="text-sm text-gray-400">Los pedidos de «Compra Online» de tu catálogo aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(o => (
            <div key={o.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-gray-900 leading-tight">{o.customer_name || 'Cliente'}</p>
                  <p className="text-[11px] text-gray-400">{fmtDate(o.created_at)}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[o.status]}`}>{cap(o.status)}</span>
              </div>

              {o.items && o.items.length > 0 && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 text-xs space-y-0.5">
                  {o.items.map((it, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-gray-600 truncate">{it.qty}× {it.name}</span>
                      <span className="font-medium text-gray-800 shrink-0">{formatCurrency(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-extrabold text-gray-900">{o.total != null ? formatCurrency(o.total) : '—'}</span>
              </div>

              <div className="space-y-1 text-xs text-gray-600">
                {o.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400 shrink-0" /> <a href={`tel:${o.phone}`} className="hover:underline">{o.phone}</a></p>}
                {(o.address || o.city) && <p className="flex items-start gap-1.5"><MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" /> <span>{[o.address, o.city, o.state, o.zip].filter(Boolean).join(', ')}{o.notes ? ` — ${o.notes}` : ''}</span></p>}
                {o.payment_method && <p className="flex items-center gap-1.5"><CreditCard size={12} className="text-gray-400 shrink-0" /> {o.payment_method}</p>}
              </div>

              {/* Cambiar estado (auto-guardado) */}
              <select value={o.status} onChange={e => setStatus(o.id, e.target.value as OrderStatus)} disabled={isPending}
                className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {ORDER_STATUSES.map(st => <option key={st} value={st}>{cap(st)}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
