'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, FileDown, Loader2, PenLine, Eraser } from 'lucide-react'
import { respondPublicQuoteAction } from '@/lib/actions/quotes'
import type { PublicQuote } from '@/lib/actions/quotes'
import { exportQuoteToPDF } from '@/lib/utils/quoteExport'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada',
  rechazada: 'Rechazada', expirada: 'Vencida', convertida: 'Procesada',
}
const PAY_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mercadopago: 'Mercado Pago',
}

type Item = PublicQuote['quote']['items'][number]
function lineGross(i: Item) { return i.unit_price * i.quantity }
function lineDiscountAmt(i: Item) {
  const v = i.discount_value ?? 0
  if (v <= 0) return 0
  const d = i.discount_pct ? lineGross(i) * (v / 100) : v
  return Math.min(Math.max(0, d), lineGross(i))
}
function lineTotal(i: Item) { return lineGross(i) - lineDiscountAmt(i) }

export default function PublicQuoteView({ data, token }: { data: PublicQuote; token: string }) {
  const { quote, store } = data
  const currency = store.currency
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<'aceptada' | 'rechazada' | null>(null)
  const [signing, setSigning] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)

  const alreadyResponded = ['aceptada', 'rechazada', 'convertida'].includes(quote.status) || done !== null
  const finalState = done ?? (quote.status === 'aceptada' ? 'aceptada' : quote.status === 'rechazada' ? 'rechazada' : null)

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827'
    ctx.lineTo(p.x, p.y); ctx.stroke(); hasDrawn.current = true
  }
  function end() { drawing.current = false }
  function clearSig() {
    const c = canvasRef.current
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    hasDrawn.current = false
  }

  function respond(decision: 'aceptada' | 'rechazada') {
    const signature = decision === 'aceptada' && hasDrawn.current ? canvasRef.current?.toDataURL('image/png') : undefined
    startTransition(async () => {
      const res = await respondPublicQuoteAction(token, decision, signature)
      if (res.success) { setDone(decision); setSigning(false); toast.success(decision === 'aceptada' ? '¡Cotización aceptada!' : 'Cotización rechazada') }
      else toast.error(res.error ?? 'No se pudo registrar')
    })
  }

  async function downloadPDF() {
    try {
      await exportQuoteToPDF(quote, store, typeof window !== 'undefined' ? `${window.location.origin}/q/${token}` : undefined)
    } catch { toast.error('No se pudo generar el PDF') }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 flex items-center gap-4">
          {store.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo_url} alt={store.name} className="w-14 h-14 rounded-xl object-cover bg-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-2xl font-bold">{store.name.charAt(0)}</div>
          )}
          <div className="flex-1">
            <p className="text-blue-100 text-xs">Cotización</p>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-blue-100 text-sm">{quote.folio} · {formatDate(quote.created_at)}</p>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {STATUS_LABEL[quote.status] ?? quote.status}
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Cliente */}
          {quote.customer_name && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-400">Para: </span><span className="font-medium text-gray-900">{quote.customer_name}</span>
            </div>
          )}

          {/* Tabla */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Producto</th>
                  <th className="text-center px-2 py-2 font-medium">Cant.</th>
                  <th className="text-right px-2 py-2 font-medium">P. unit.</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <p className="text-gray-900">{i.product_name}</p>
                      {i.variant && <p className="text-xs text-gray-400">{i.variant}</p>}
                      {i.note && <p className="text-xs text-gray-400 italic">{i.note}</p>}
                    </td>
                    <td className="text-center px-2 py-2">{i.quantity}</td>
                    <td className="text-right px-2 py-2">{formatCurrency(i.unit_price, currency)}</td>
                    <td className="text-right px-3 py-2 font-medium">{formatCurrency(lineTotal(i), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, currency)}</span></div>
            {quote.discount_amt > 0 && <div className="flex justify-between text-red-500"><span>Descuento</span><span>-{formatCurrency(quote.discount_amt, currency)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-gray-900"><span>Total</span><span>{formatCurrency(quote.total, currency)}</span></div>
            {quote.deposit_pct ? <div className="flex justify-between text-xs text-gray-400"><span>Anticipo ({quote.deposit_pct}%)</span><span>{formatCurrency(quote.total * quote.deposit_pct / 100, currency)}</span></div> : null}
          </div>

          {/* Condiciones */}
          <div className="text-xs text-gray-500 space-y-0.5">
            {quote.payment_method && <p>Pago: {PAY_LABEL[quote.payment_method] ?? quote.payment_method}</p>}
            {quote.delivery_time && <p>Entrega: {quote.delivery_time}</p>}
            {quote.valid_until && <p>Válida hasta: {formatDate(quote.valid_until)}</p>}
            {quote.notes && <p className="pt-1 text-gray-600">{quote.notes}</p>}
          </div>

          <button onClick={downloadPDF} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <FileDown size={15} /> Descargar PDF
          </button>

          {/* Respuesta */}
          <div className="border-t border-gray-100 pt-5">
            {alreadyResponded && finalState ? (
              <div className={`flex items-center gap-3 rounded-xl p-4 ${finalState === 'aceptada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {finalState === 'aceptada' ? <CheckCircle2 /> : <XCircle />}
                <p className="font-medium">{finalState === 'aceptada' ? '¡Aceptaste esta cotización! Gracias.' : 'Rechazaste esta cotización.'}</p>
              </div>
            ) : signing ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><PenLine size={15} /> Firma aquí (opcional)</p>
                <canvas ref={canvasRef} width={500} height={180}
                  onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
                  className="w-full h-44 border-2 border-dashed border-gray-300 rounded-xl touch-none bg-white" />
                <div className="flex items-center justify-between">
                  <button onClick={clearSig} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><Eraser size={13} /> Borrar firma</button>
                  <div className="flex gap-2">
                    <button onClick={() => setSigning(false)} disabled={isPending} className="px-4 h-10 rounded-lg border border-gray-200 text-sm">Cancelar</button>
                    <button onClick={() => respond('aceptada')} disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-5 h-10 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                      {isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirmar aceptación
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSigning(true)} disabled={isPending}
                  className="inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60">
                  <CheckCircle2 size={18} /> Aceptar
                </button>
                <button onClick={() => respond('rechazada')} disabled={isPending}
                  className="inline-flex items-center justify-center gap-1.5 h-12 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-60">
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />} Rechazar
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 pb-5">Cotización generada con Mercanta Business</p>
      </div>
    </div>
  )
}
