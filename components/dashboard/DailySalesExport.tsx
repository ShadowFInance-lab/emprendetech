'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Loader2, BarChart3, Lock } from 'lucide-react'
import { exportSalesToExcel, exportSalesToPDF, type ExportSale } from '@/lib/utils/salesExport'
import { formatCurrency } from '@/lib/utils/format'

type RangeKey = 'today' | 'week' | 'month'

interface Props {
  today: ExportSale[]
  week: ExportSale[]
  month: ExportSale[]
  isPaid: boolean
  storeName: string
  currency: string
  dateLabel: string
}

const RANGE_LABEL: Record<RangeKey, string> = { today: 'Hoy', week: 'Esta semana', month: 'Este mes' }
const AUTO_KEY = 'et_autodownload_enabled'
const LAST_KEY = 'et_autodownload_last'

export default function DailySalesExport({ today, week, month, isPaid, storeName, currency, dateLabel }: Props) {
  const [range, setRange] = useState<RangeKey>('today')
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
  const [auto, setAuto] = useState(false)

  const sales = range === 'today' ? today : range === 'week' ? week : month
  const total = sales.reduce((a, s) => a + Number(s.total), 0)

  async function run(kind: 'excel' | 'pdf') {
    if (sales.length === 0) {
      toast.error(`No hay ventas en "${RANGE_LABEL[range]}" para exportar`)
      return
    }
    setBusy(kind)
    try {
      const opts = { storeName, currency, dateLabel: `${RANGE_LABEL[range]}-${dateLabel}` }
      if (kind === 'excel') await exportSalesToExcel(sales, opts)
      else await exportSalesToPDF(sales, opts)
      toast.success(`Reporte ${kind === 'excel' ? 'Excel' : 'PDF'} de "${RANGE_LABEL[range]}" descargado`)
    } catch {
      toast.error('No se pudo generar el archivo. Intenta de nuevo.')
    }
    setBusy(null)
  }

  // Descarga automática del reporte de HOY (una vez al día) — solo planes de pago
  useEffect(() => {
    if (!isPaid) return
    const enabled = localStorage.getItem(AUTO_KEY) === '1'
    setAuto(enabled)
    if (enabled && today.length > 0 && localStorage.getItem(LAST_KEY) !== dateLabel) {
      localStorage.setItem(LAST_KEY, dateLabel)
      exportSalesToExcel(today, { storeName, currency, dateLabel: `Hoy-${dateLabel}` })
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
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
          <BarChart3 size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-[15px]">Reportes de ventas</h3>
          <p className="text-xs text-gray-500">Descarga el detalle por producto en Excel o PDF</p>
        </div>
      </div>

      {/* Selector de rango */}
      <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-xl mb-3">
        {(['today', 'week', 'month'] as RangeKey[]).map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
              range === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-700">
          <span className="font-bold">{formatCurrency(total, currency)}</span>
          <span className="text-gray-400"> · {sales.length} venta{sales.length === 1 ? '' : 's'} en {RANGE_LABEL[range].toLowerCase()}</span>
        </p>

        {isPaid ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => run('excel')} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 transition-all disabled:opacity-60">
              {busy === 'excel' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
            </button>
            <button type="button" onClick={() => run('pdf')} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-60">
              {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF
            </button>
          </div>
        ) : (
          <Link href="/subscription"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-all">
            <Lock size={14} /> Descargar Excel/PDF (plan de pago)
          </Link>
        )}
      </div>

      {isPaid && (
        <label className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none">
          <input type="checkbox" checked={auto} onChange={e => toggleAuto(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          Descargar el reporte de hoy automáticamente cada día
        </label>
      )}
    </div>
  )
}
