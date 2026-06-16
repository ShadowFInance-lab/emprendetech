'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Wallet, Loader2, FileSpreadsheet, FileText, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getPayrollAction, savePayrollDiscountAction, type PayrollRow, type PayrollPeriod } from '@/lib/actions/payroll'
import { formatCurrency } from '@/lib/utils/format'

const PERIODS: { id: PayrollPeriod; label: string }[] = [
  { id: 'week', label: 'Semana' },
  { id: 'fortnight', label: 'Quincena' },
  { id: 'month', label: 'Mes' },
]
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

export default function PayrollTable() {
  const [period, setPeriod] = useState<PayrollPeriod>('week')
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [discounts, setDiscounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async (p: PayrollPeriod) => {
    setLoading(true)
    const res = await getPayrollAction(p)
    setRows(res.rows); setPeriodStart(res.periodStart)
    const d: Record<string, string> = {}; res.rows.forEach(r => { d[r.employeeId] = String(r.discount || 0) }); setDiscounts(d)
    setLoading(false)
  }, [])
  useEffect(() => { refresh(period) }, [period, refresh])

  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? ''
  const net = (r: PayrollRow) => Math.max(0, r.base - (parseFloat(discounts[r.employeeId] ?? '0') || 0))

  function saveDiscount(r: PayrollRow) {
    startTransition(async () => {
      const res = await savePayrollDiscountAction(r.employeeId, periodStart, parseFloat(discounts[r.employeeId] ?? '0') || 0)
      if (res.success) { toast.success('Descuento guardado'); refresh(period) } else toast.error(res.error ?? 'Error')
    })
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    // Resumen de nómina
    const resumen = rows.map(r => ({
      Empleado: r.name ?? '', Teléfono: r.phone ?? '', Emergencia: r.emergency ?? '',
      'Días presente': r.daysPresent, 'Sueldo base': r.base, Descuento: parseFloat(discounts[r.employeeId] ?? '0') || 0, Neto: net(r),
    }))
    const ws = XLSX.utils.json_to_sheet(resumen.length ? resumen : [{ Empleado: '', Teléfono: '', Emergencia: '', 'Días presente': '', 'Sueldo base': '', Descuento: '', Neto: '' }])
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina')
    // Detalle de asistencia por día
    const detalle: Record<string, string | number>[] = []
    rows.forEach(r => r.days.forEach(d => detalle.push({
      Empleado: r.name ?? '', Fecha: d.date, Entrada: fmtTime(d.checkIn), Salida: fmtTime(d.checkOut),
      Estado: d.checkIn ? 'Presente' : 'Ausente', Observación: d.note ?? '',
    })))
    if (detalle.length) {
      const ws2 = XLSX.utils.json_to_sheet(detalle)
      ws2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Asistencia')
    }
    XLSX.writeFile(wb, `nomina-${periodLabel.toLowerCase()}-${periodStart}.xlsx`)
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('Nómina', 14, 18)
    doc.setFontSize(10); doc.setTextColor(120)
    doc.text(`Periodo: ${periodLabel} · desde ${periodStart}`, 14, 25)
    autoTable(doc, {
      startY: 31,
      head: [['Empleado', 'Tel.', 'Emergencia', 'Días', 'Base', 'Descuento', 'Neto']],
      body: rows.map(r => [
        r.name ?? '', r.phone ?? '—', r.emergency ?? '—', r.daysPresent,
        formatCurrency(r.base), formatCurrency(parseFloat(discounts[r.employeeId] ?? '0') || 0), formatCurrency(net(r)),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
    })
    doc.save(`nomina-${periodLabel.toLowerCase()}-${periodStart}.pdf`)
  }

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <Wallet size={14} /> Nómina
        </p>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${period === p.id ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportExcel} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100">
            <FileText size={13} /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin empleados para la nómina.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Empleado</th>
                <th className="text-left px-2 py-2 font-medium">Teléfono</th>
                <th className="text-center px-2 py-2 font-medium">Días</th>
                <th className="text-right px-2 py-2 font-medium">Base</th>
                <th className="text-center px-2 py-2 font-medium">Descuento</th>
                <th className="text-right px-3 py-2 font-medium">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.employeeId}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{r.name ?? 'Empleado'}</p>
                    {r.emergency && <p className="text-[11px] text-gray-400">Emerg.: {r.emergency}</p>}
                  </td>
                  <td className="px-2 py-2 text-gray-500">{r.phone ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{r.daysPresent}</td>
                  <td className="px-2 py-2 text-right">{formatCurrency(r.base)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1 justify-center">
                      <Input type="number" min="0" value={discounts[r.employeeId] ?? '0'}
                        onChange={e => setDiscounts(d => ({ ...d, [r.employeeId]: e.target.value }))}
                        className="w-20 h-8 text-right text-xs" />
                      <button onClick={() => saveDiscount(r)} disabled={isPending}
                        className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar descuento"><Save size={14} /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">{formatCurrency(net(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
