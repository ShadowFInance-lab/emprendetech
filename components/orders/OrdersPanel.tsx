'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Inbox, Loader2, Phone, MapPin, CreditCard, RefreshCw, X, ShoppingBag, CalendarDays, Clock, DollarSign, Check } from 'lucide-react'
import { listOnlineOrdersAction, updateOnlineOrderStatusAction, type OnlineOrder } from '@/lib/actions/orders'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/constants/orders'
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
// Línea de vida del pedido (sin "cancelado", que es estado terminal aparte)
const FLOW: OrderStatus[] = ['pendiente', 'confirmado', 'pagado', 'preparando', 'enviado', 'entregado']
// Acción rápida: etiqueta del botón que avanza al siguiente estado
const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  pendiente: 'Confirmar', confirmado: 'Pagado', pagado: 'Preparar', preparando: 'Enviado', enviado: 'Entregado',
}
const nextOf = (s: OrderStatus): OrderStatus | null => {
  const i = FLOW.indexOf(s)
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmtDate = (s: string) => new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const isToday = (s: string) => new Date(s).toDateString() === new Date().toDateString()

export default function OrdersPanel() {
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [loading, setLoading] = useState(true)
  // La lista ya llega filtrada a SOLO pagados (regla de Ventas Online). Por eso
  // la vista por defecto es "todos" = todos los pedidos pagados; los chips
  // permiten acotar por etapa de entrega (preparando, enviado, entregado…).
  const [filter, setFilter] = useState<'todos' | OrderStatus>('todos')
  const [selected, setSelected] = useState<OnlineOrder | null>(null)
  const [isPending, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    try { setOrders(await listOnlineOrdersAction()) }
    catch { setOrders([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function setStatus(id: string, status: OrderStatus) {
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, status } : o)))
    setSelected(s => (s && s.id === id ? { ...s, status } : s))
    startTransition(async () => {
      const r = await updateOnlineOrderStatusAction(id, status)
      if (!r.success) { toast.error(r.error ?? 'Error'); load() } else toast.success('Estado actualizado')
    })
  }

  const shown = filter === 'todos' ? orders : orders.filter(o => o.status === filter)
  const stats = useMemo(() => ({
    total: orders.length,
    hoy: orders.filter(o => isToday(o.created_at)).length,
    // Pagados que aún faltan por despachar (recién pagados o en preparación).
    porEnviar: orders.filter(o => o.status === 'pagado' || o.status === 'preparando').length,
    ingresos: orders.reduce((s, o) => s + (o.total ?? 0), 0),
  }), [orders])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>

  const cards = [
    { label: 'Pedidos pagados', value: String(stats.total), icon: ShoppingBag, c: 'from-indigo-500 to-violet-600' },
    { label: 'Hoy', value: String(stats.hoy), icon: CalendarDays, c: 'from-cyan-500 to-sky-600' },
    { label: 'Por enviar', value: String(stats.porEnviar), icon: Clock, c: 'from-amber-500 to-orange-600' },
    { label: 'Ingresos cobrados', value: formatCurrency(stats.ingresos), icon: DollarSign, c: 'from-emerald-500 to-green-600' },
  ]

  return (
    <div className="space-y-4">
      {/* ── Tarjetas resumen ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(k => (
          <div key={k.label} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-3.5">
            <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.c} flex items-center justify-center mb-2`}><k.icon size={17} className="text-white" /></span>
            <p className="text-[11px] text-gray-400 font-medium">{k.label}</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
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

      {/* ── Tabla / vacío ── */}
      {shown.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Inbox size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-700">{filter === 'pagado' ? 'Sin pedidos pagados listos para enviar' : `Sin pedidos ${filter !== 'todos' ? `«${cap(filter)}»` : 'todavía'}`}</p>
          <p className="text-sm text-gray-400">Los pedidos de «Compra Online» de tu catálogo aparecerán aquí.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 bg-gray-50/70">
                <th className="px-4 py-2.5 font-semibold">ID</th>
                <th className="px-4 py-2.5 font-semibold">Cliente</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 font-semibold">Pago</th>
                <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Fecha</th>
                <th className="px-4 py-2.5 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(o => (
                <tr key={o.id} onClick={() => setSelected(o)} className="border-t border-gray-100 cursor-pointer hover:bg-indigo-50/40 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-500 whitespace-nowrap">{o.order_no || o.id.slice(0, 6).toUpperCase()}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{o.customer_name || 'Cliente'}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[o.status] ?? STATUS_STYLE.pendiente}`}>{cap(o.status || 'pendiente')}</span></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full" title={o.paid_at ? `Pagado ${fmtDate(o.paid_at)}` : 'Pago confirmado por Stripe'}>
                      <Check size={11} /> Pagado
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">{o.total != null ? formatCurrency(o.total) : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(o.created_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    {o.status === 'cancelado' ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : nextOf(o.status) ? (
                      <button type="button" disabled={isPending} onClick={() => setStatus(o.id, nextOf(o.status)!)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                        → {NEXT_ACTION[o.status]}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Check size={12} /> Completo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Panel lateral de detalle ── */}
      {selected && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shrink-0">
              <div>
                <p className="text-sm font-bold leading-tight flex items-center gap-2"><ShoppingBag size={16} /> {selected.order_no || 'Pedido'}</p>
                <p className="text-[11px] text-white/75">{fmtDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Cliente */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Cliente</p>
                <p className="font-semibold text-gray-900">{selected.customer_name || 'Cliente'}</p>
                <div className="mt-1 space-y-0.5 text-sm text-gray-600">
                  {selected.phone && <p className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" /> <a href={`tel:${selected.phone}`} className="hover:underline">{selected.phone}</a></p>}
                  {selected.email && <p className="flex items-center gap-1.5"><span className="text-gray-400">@</span> {selected.email}</p>}
                  {(selected.address || selected.city) && <p className="flex items-start gap-1.5"><MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" /> <span>{[selected.address, selected.city, selected.state, selected.zip].filter(Boolean).join(', ')}</span></p>}
                </div>
              </div>

              {/* Productos */}
              {selected.items && selected.items.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Productos</p>
                  <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
                    {selected.items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-gray-700">{it.qty}× {it.name}</span>
                        <span className="font-medium text-gray-900 shrink-0">{formatCurrency(it.price * it.qty)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-bold bg-gray-50">
                      <span>Total</span><span>{selected.total != null ? formatCurrency(selected.total) : '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pago — indicadores confirmados por Stripe */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Pago</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1 text-sm">
                  <p className="flex items-center gap-1.5 font-bold text-emerald-700"><Check size={14} /> Pago confirmado</p>
                  <p className="text-gray-600 flex items-center gap-1.5"><CreditCard size={13} className="text-gray-400" /> Método: <strong className="text-gray-800">{selected.payment_method || 'Tarjeta (Stripe)'}</strong></p>
                  {selected.paid_at && <p className="text-gray-600 flex items-center gap-1.5"><CalendarDays size={13} className="text-gray-400" /> Fecha de pago: <strong className="text-gray-800">{fmtDate(selected.paid_at)}</strong></p>}
                  {selected.stripe_payment_intent && (
                    <p className="text-gray-500 text-xs break-all">ID transacción Stripe: <code className="text-gray-700">{selected.stripe_payment_intent}</code></p>
                  )}
                </div>
              </div>

              {/* Notas */}
              {selected.notes && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notas</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{selected.notes}</p>
                </div>
              )}

              {/* Historial / línea de estados */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Historial de estados</p>
                {selected.status === 'cancelado' ? (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"><X size={15} /> Pedido cancelado</div>
                ) : (
                  <ol className="space-y-1.5">
                    {FLOW.map((st, i) => {
                      const curIdx = FLOW.indexOf(selected.status)
                      const done = i <= curIdx
                      return (
                        <li key={st} className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-300'}`}>{done ? <Check size={12} /> : <span className="text-[9px]">{i + 1}</span>}</span>
                          <span className={`text-sm ${i === curIdx ? 'font-bold text-gray-900' : done ? 'text-gray-500' : 'text-gray-400'}`}>{cap(st)}</span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            </div>

            {/* Acciones rápidas + cambiar estado */}
            <div className="border-t border-gray-100 p-4 shrink-0 space-y-2">
              {selected.status !== 'cancelado' && nextOf(selected.status) && (
                <button type="button" disabled={isPending} onClick={() => setStatus(selected.id, nextOf(selected.status)!)}
                  className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                  → Avanzar a {cap(nextOf(selected.status)!)}
                </button>
              )}
              {selected.status !== 'cancelado' && selected.status !== 'entregado' && (
                <button type="button" disabled={isPending} onClick={() => setStatus(selected.id, 'cancelado')}
                  className="w-full h-9 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">
                  Cancelar pedido
                </button>
              )}
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">O elige un estado</label>
              <select value={selected.status} onChange={e => setStatus(selected.id, e.target.value as OrderStatus)} disabled={isPending}
                className="w-full h-10 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {ORDER_STATUSES.map(st => <option key={st} value={st}>{cap(st)}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
