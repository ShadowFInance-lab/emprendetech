'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Flag, Loader2, CheckCircle2 } from 'lucide-react'
import { submitReportAction } from '@/lib/actions/reports'

const REASONS = [
  'Producto ilegal o falsificado',
  'Fraude o estafa',
  'No recibí mi pedido',
  'El producto no coincide con la descripción',
  'Contenido inapropiado u ofensivo',
  'Otro',
]

export default function ReportForm({ storeSlug, orderNo }: { storeSlug?: string; orderNo?: string }) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) { toast.error('Elige un motivo'); return }
    start(async () => {
      const r = await submitReportAction({ storeSlug, orderNo, reason, detail, reporterEmail: email })
      if (r.success) setDone(true)
      else toast.error(r.error ?? 'Error')
    })
  }

  if (done) {
    return (
      <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <CheckCircle2 size={44} className="mx-auto text-emerald-500 mb-3" />
        <h1 className="text-xl font-bold text-gray-900">Reporte enviado</h1>
        <p className="text-gray-500 text-sm mt-1 mb-5">Gracias. Nuestro equipo revisará tu reporte. Podemos suspender tiendas que incumplan nuestras reglas.</p>
        <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Volver al inicio</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      {(storeSlug || orderNo) && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          {storeSlug && <>Tienda: <strong className="text-gray-700">{storeSlug}</strong></>}
          {storeSlug && orderNo && ' · '}
          {orderNo && <>Pedido: <strong className="text-gray-700 font-mono">{orderNo}</strong></>}
        </div>
      )}
      <div>
        <label className="text-sm font-semibold text-gray-700">Motivo *</label>
        <select value={reason} onChange={e => setReason(e.target.value)}
          className="mt-1 w-full h-11 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">Selecciona un motivo…</option>
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-700">Detalles</label>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={4} placeholder="Cuéntanos qué pasó…"
          className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-700">Tu correo (opcional)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"
          className="mt-1 w-full h-11 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <p className="text-[11px] text-gray-400 mt-1">Por si necesitamos más información. No lo compartimos con la tienda.</p>
      </div>
      <button type="submit" disabled={pending}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50">
        {pending ? <Loader2 size={18} className="animate-spin" /> : <><Flag size={16} /> Enviar reporte</>}
      </button>
    </form>
  )
}
