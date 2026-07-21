import Link from 'next/link'
import type { Metadata } from 'next'
import { Package, Check, Truck, ExternalLink, Store, Search, XCircle } from 'lucide-react'
import { getPublicOrderTrackingAction } from '@/lib/actions/orders'
import { CUSTOMER_STEPS } from '@/lib/utils/shipping'
import { formatCurrency } from '@/lib/utils/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Rastrea tu pedido', robots: { index: false } }

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : null

export default async function RastreoOrderPage({ params }: { params: { orderNo: string } }) {
  const orderNo = decodeURIComponent(params.orderNo)
  const t = await getPublicOrderTrackingAction(orderNo)

  // No encontrado
  if (!t) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <XCircle size={44} className="mx-auto text-gray-300 mb-3" />
          <h1 className="text-xl font-bold text-gray-900">No encontramos ese pedido</h1>
          <p className="text-gray-500 text-sm mt-1 mb-5">Revisa el número «{orderNo}». Debe verse como <strong>MB-XXXXXX</strong>.</p>
          <Link href="/rastreo" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
            <Search size={16} /> Buscar de nuevo
          </Link>
        </div>
      </div>
    )
  }

  const cancelled = t.status === 'cancelado'
  const order = ['pagado', 'preparando', 'enviado', 'entregado']
  let curIdx = order.indexOf(t.status)
  if (curIdx < 0) curIdx = 0

  // Fecha por etapa (del historial; "pagado" cae al paid_at/created_at).
  const at: Record<string, string | undefined> = {}
  for (const h of t.status_history) at[h.status] = h.at
  at.pagado = at.pagado || t.paid_at || t.created_at

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-8 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
            <Package size={26} className="text-white" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">Seguimiento de pedido</p>
          <h1 className="text-2xl font-extrabold text-gray-900 font-mono">{t.order_no}</h1>
          {t.store_name && <p className="text-gray-500 text-sm">de <strong>{t.store_name}</strong></p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Estado grande */}
          <div className={`px-5 py-4 text-center text-white ${cancelled ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-indigo-500 to-violet-600'}`}>
            <p className="text-[11px] uppercase tracking-wide text-white/70">Estado actual</p>
            <p className="text-lg font-bold">
              {cancelled ? 'Pedido cancelado' : CUSTOMER_STEPS[Math.min(curIdx, CUSTOMER_STEPS.length - 1)].label}
            </p>
          </div>

          {/* Rastreo de paquetería */}
          {!cancelled && (t.tracking_number || t.shipping_carrier) && (
            <div className="mx-5 mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-bold text-cyan-700 mb-0.5"><Truck size={15} /> {t.shipping_carrier || 'En camino'}</p>
              {t.tracking_number && <p className="text-gray-600">Guía: <strong className="font-mono text-gray-800">{t.tracking_number}</strong></p>}
              {t.tracking_url && (
                <a href={t.tracking_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-cyan-700 font-semibold hover:underline"><ExternalLink size={13} /> Rastrear con la paquetería</a>
              )}
            </div>
          )}

          {/* Línea de tiempo */}
          <div className="p-5">
            {cancelled ? (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-3">
                <XCircle size={18} /> Este pedido fue cancelado. Contacta a la tienda si tienes dudas.
              </div>
            ) : (
              <ol className="relative">
                {CUSTOMER_STEPS.map((step, i) => {
                  const done = i <= curIdx
                  const current = i === curIdx
                  const last = i === CUSTOMER_STEPS.length - 1
                  return (
                    <li key={step.key} className="flex gap-3 pb-5 last:pb-0 relative">
                      {!last && <span className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${i < curIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                      <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-300'} ${current ? 'ring-4 ring-emerald-100' : ''}`}>
                        {i < curIdx ? <Check size={15} /> : i === 2 ? <Truck size={14} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                      </span>
                      <div className="pt-0.5">
                        <p className={`text-sm font-bold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                        <p className="text-xs text-gray-400">{step.desc}</p>
                        {done && at[step.key] && <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{fmt(at[step.key])}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {/* Resumen */}
          <div className="px-5 pb-5 flex items-center justify-between text-sm border-t border-gray-100 pt-4">
            <span className="text-gray-500">{t.item_count} producto{t.item_count !== 1 ? 's' : ''}</span>
            {t.total != null && <span className="font-bold text-gray-900">{formatCurrency(t.total)}</span>}
          </div>
        </div>

        {/* Volver a la tienda + legal */}
        <div className="text-center mt-5 space-y-3">
          {t.store_slug && (
            <Link href={`/catalog/${t.store_slug}`} className="inline-flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:underline">
              <Store size={15} /> Volver a {t.store_name || 'la tienda'}
            </Link>
          )}
          <p className="text-[11px] text-gray-400">
            <Link href="/terminos" className="hover:underline">Términos</Link>
            {' · '}
            <Link href="/privacidad" className="hover:underline">Privacidad</Link>
            {' · '}
            <Link href={`/reportar?pedido=${t.order_no ?? ''}`} className="hover:underline">Reportar pedido</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
