'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileDown, FileSpreadsheet, MessageCircle, Mail, ShoppingCart, Trash2, Loader2, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setQuoteStatusAction, deleteQuoteAction, convertQuoteToSaleAction } from '@/lib/actions/quotes'
import type { Quote, QuoteStatus } from '@/lib/actions/quotes'
import { exportQuoteToPDF, exportQuoteToExcel, buildQuoteText } from '@/lib/utils/quoteExport'
import type { QuoteExportStore } from '@/lib/utils/quoteExport'

const STATUS_OPTS: { value: QuoteStatus; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'expirada', label: 'Expirada' },
  { value: 'convertida', label: 'Convertida en venta' },
]

export default function QuoteActions({
  quote, store, customerEmail, customerPhone,
}: {
  quote: Quote
  store: QuoteExportStore
  customerEmail?: string | null
  customerPhone?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)

  function changeStatus(status: QuoteStatus) {
    startTransition(async () => {
      const res = await setQuoteStatusAction(quote.id, status)
      if (res.success) { toast.success('Estado actualizado'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  async function doPDF() {
    setExporting(true)
    try { await exportQuoteToPDF(quote, store) } catch { toast.error('No se pudo generar el PDF') }
    setExporting(false)
  }
  async function doExcel() {
    setExporting(true)
    try { await exportQuoteToExcel(quote, store) } catch { toast.error('No se pudo generar el Excel') }
    setExporting(false)
  }

  function doWhatsApp() {
    const text = encodeURIComponent(buildQuoteText(quote, store))
    const phone = (customerPhone || '').replace(/\D/g, '')
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
    window.open(url, '_blank', 'noopener')
  }

  function doEmail() {
    const subject = encodeURIComponent(`Cotización ${quote.folio} — ${store.name}`)
    const body = encodeURIComponent(buildQuoteText(quote, store) + '\n\n(Adjunta el PDF descargado a este correo.)')
    const to = customerEmail || ''
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
    if (quote.status === 'borrador') changeStatus('enviada')
  }

  function convert() {
    if (!confirm('¿Convertir esta cotización en una venta? Se descontará el stock del inventario.')) return
    startTransition(async () => {
      const res = await convertQuoteToSaleAction(quote.id)
      if (res.success) {
        toast.success('Cotización convertida en venta')
        router.push('/sales')
        router.refresh()
      } else {
        toast.error(res.error ?? 'No se pudo convertir')
      }
    })
  }

  function remove() {
    if (!confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      const res = await deleteQuoteAction(quote.id)
      if (res.success) { toast.success('Cotización eliminada'); router.push('/quotes'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const busy = isPending || exporting

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      {/* Estado */}
      <div>
        <label className="text-xs font-medium text-gray-500">Estado</label>
        <select value={quote.status} onChange={e => changeStatus(e.target.value as QuoteStatus)} disabled={busy}
          className="w-full h-10 px-2 mt-1 text-sm border border-gray-200 rounded-lg bg-white">
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Compartir / exportar */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={doPDF} disabled={busy} className="h-10">
          <FileDown size={16} className="mr-1" /> PDF
        </Button>
        <Button variant="outline" onClick={doExcel} disabled={busy} className="h-10">
          <FileSpreadsheet size={16} className="mr-1" /> Excel
        </Button>
        <Button variant="outline" onClick={doWhatsApp} disabled={busy} className="h-10 text-green-700 border-green-200 hover:bg-green-50">
          <MessageCircle size={16} className="mr-1" /> WhatsApp
        </Button>
        <Button variant="outline" onClick={doEmail} disabled={busy} className="h-10">
          <Mail size={16} className="mr-1" /> Correo
        </Button>
      </div>

      {/* Convertir a venta */}
      {quote.status !== 'convertida' ? (
        <Button onClick={convert} disabled={busy} className="w-full h-11 bg-green-600 hover:bg-green-700">
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShoppingCart size={18} className="mr-2" /> Convertir en venta</>}
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg py-2.5">
          <CheckCircle2 size={16} /> Convertida en venta
        </div>
      )}

      {/* Eliminar */}
      <button onClick={remove} disabled={busy}
        className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-600 pt-1">
        <Trash2 size={13} /> Eliminar cotización
      </button>
    </div>
  )
}
