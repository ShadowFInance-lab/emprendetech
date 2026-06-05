'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Lock, Loader2, CalendarDays } from 'lucide-react'
import { exportSalesToExcel, exportSalesToPDF, type ExportSale } from '@/lib/utils/salesExport'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  sales: ExportSale[]
  isPaid: boolean
  storeName: string
  currency: string
  dateLabel: string
}

const AUTO_KEY = 'et_autodownload_enabled'
const LAST_KEY = 'et_autodownload_last'

export default function DailySalesExport({ sales, isPaid, storeName, currency, dateLabel }: Props) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
  const [auto, setAuto] = useState(false)
  const total = sales.reduce((a, s) => a + Number(s.total), 0)

  async function run(kind: 'excel' | 'pdf') {
    if (sales.length === 0) {
      toast.error('Aún no hay ventas hoy para exportar')
      return
    }
    setBusy(kind)
    try {
      const opts = { storeName, currency, dateLabel }
      if (kind === 'excel') await exportSalesToExcel(sales, opts)
      else await exportSalesToPDF(sales, opts)
      toast.success(`Reporte ${kind === 'excel' ? 'Excel' : 'PDF'} descargado`)
    } catch {
      toast.error('No se pudo generar el archivo. Intenta de nuevo.')
    }
    setBusy(null)
  }

  // Cargar preferencia + descarga automática diaria (una vez al día)
  useEffect(() => {
    if (!isPaid) return
    const enabled = localStorage.getItem(AUTO_KEY) === '1'
    setAuto(enabled)
    if (enabled && sales.length > 0 && localStorage.getItem(LAST_KEY) !== dateLabel) {
      localStorage.setItem(LAST_KEY, dateLabel)
      // best-effort: algunos navegadores requieren gesto del usuario
      exportSalesToExcel(sales, { storeName, currency, dateLabel })
        .then(() => toast.success('Descarga automática del reporte de hoy'))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleAuto(v: boolean) {
    setAuto(v)
    localStorage.setItem(AUTO_KEY, v ? '1' : '0')
    toast.success(v ? 'Descarga automática activada' : 'Descarga automática desactivada')
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <CalendarDays size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-[15px]">Ventas del día</h3>
            <p className="text-xs text-gray-500">
              {formatCurrency(total, currency)} · {sales.length} venta{sales.length === 1 ? '' : 's'} hoy
            </p>
          </div>
        </div>

        {isPaid ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run('excel')}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 transition-all disabled:opacity-60"
            >
              {busy === 'excel' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              Excel
            </button>
            <button
              type="button"
              onClick={() => run('pdf')}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-60"
            >
              {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              PDF
            </button>
          </div>
        ) : (
          <Link
            href="/subscription"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-all"
          >
            <Lock size={14} /> Descargar reportes (plan de pago)
          </Link>
        )}
      </div>

      {isPaid && (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap border-t border-gray-50 pt-3">
          <p className="text-[11px] text-gray-400">
            El reporte incluye cada venta con sus productos detallados, método de pago y cliente.
          </p>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              checked={auto}
              onChange={e => toggleAuto(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            Descargar automáticamente cada día
          </label>
        </div>
      )}
    </div>
  )
}
