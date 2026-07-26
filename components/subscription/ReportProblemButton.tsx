'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessageSquareWarning, Loader2, X, CheckCircle2 } from 'lucide-react'
import { submitReportAction } from '@/lib/actions/reports'

// Tipos de problema de la APLICACIÓN (no de pagos de Stripe).
const TIPOS = [
  'Algo no funciona / da error',
  'Una pantalla se ve mal',
  'Falta una función o es confusa',
  'Es lento',
  'Sugerencia de mejora',
]

/**
 * Botón "Reportar problema" de la página de Suscripción. Guarda el reporte en la
 * tabla `reports` (misma que usa /reportar) con order_no = 'APP' para
 * distinguirlo de los reportes de tiendas/pedidos.
 */
export default function ReportProblemButton({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState(TIPOS[0])
  const [detalle, setDetalle] = useState('')
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  function enviar() {
    if (!detalle.trim()) { toast.error('Cuéntanos qué pasó'); return }
    start(async () => {
      const r = await submitReportAction({
        orderNo: 'APP',
        reason: `App · ${tipo}`,
        detail: detalle.trim(),
        reporterEmail: email || undefined,
      })
      if (r.success) setDone(true)
      else toast.error(r.error ?? 'No se pudo enviar')
    })
  }

  function cerrar() {
    setOpen(false)
    setTimeout(() => { setDone(false); setDetalle('') }, 200)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl px-3.5 py-2 transition-colors">
        <MessageSquareWarning size={14} /> Reportar problema
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cerrar} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
              <p className="font-bold flex items-center gap-2"><MessageSquareWarning size={17} /> Reportar problema</p>
              <button type="button" onClick={cerrar} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
            </div>

            {done ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={44} className="mx-auto text-emerald-500 mb-3" />
                <p className="font-bold text-gray-900">¡Gracias por avisarnos!</p>
                <p className="text-sm text-gray-500 mt-1 mb-5">Tu reporte se guardó. Lo revisaremos para mejorar la app.</p>
                <button type="button" onClick={cerrar} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Cerrar</button>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-3">
                  <p className="text-xs text-gray-500">Cuéntanos qué falla en la aplicación para poder arreglarlo. (Para dudas de cobros, contacta a soporte de pagos.)</p>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Tipo de problema</label>
                    <select value={tipo} onChange={e => setTipo(e.target.value)}
                      className="mt-1 w-full h-11 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">¿Qué pasó?</label>
                    <textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={5} autoFocus
                      placeholder="Ej: al abrir el modal de un empleado no se ven los datos…"
                      className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 p-4 border-t border-gray-100">
                  <button type="button" onClick={cerrar} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
                  <button type="button" onClick={enviar} disabled={pending}
                    className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                    {pending ? <Loader2 size={16} className="animate-spin" /> : 'Enviar reporte'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
