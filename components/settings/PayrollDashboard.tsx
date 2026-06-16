'use client'

import { useEffect, useMemo, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Wallet, Loader2, FileSpreadsheet, FileText, Save, Plus, Trash2, Check, X,
  Users, UserCheck, Clock4, TrendingUp, Receipt,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getPayrollAction, savePayrollDiscountAction,
  getDeductionsAction, saveDeductionAction, deleteDeductionAction,
  type PayrollRow, type PayrollPeriod, type PayrollDeduction,
} from '@/lib/actions/payroll'
import { formatCurrency } from '@/lib/utils/format'

const PERIODS: { id: PayrollPeriod; label: string }[] = [
  { id: 'week', label: 'Semana' },
  { id: 'fortnight', label: 'Quincena' },
  { id: 'month', label: 'Mes' },
]
const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
function thisWeekDates(): string[] {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return toISO(d) })
}
function hoursOf(ci: string | null, co: string | null): number {
  if (!ci || !co) return 0
  const h = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000
  return h > 0 && h < 24 ? h : 0
}
const fmtH = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${pad(m % 60)}m` }

export default function PayrollDashboard() {
  const [period, setPeriod] = useState<PayrollPeriod>('week')
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [discounts, setDiscounts] = useState<Record<string, string>>({})
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async (p: PayrollPeriod) => {
    setLoading(true)
    const [res, ded] = await Promise.all([getPayrollAction(p), getDeductionsAction()])
    setRows(res.rows); setPeriodStart(res.periodStart); setDeductions(ded)
    const d: Record<string, string> = {}; res.rows.forEach(r => { d[r.employeeId] = String(r.discount || 0) }); setDiscounts(d)
    setLoading(false)
  }, [])
  useEffect(() => { refresh(period) }, [period, refresh])

  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? ''
  const week = useMemo(() => thisWeekDates(), [])

  const generalFor = useCallback((base: number) =>
    deductions.reduce((s, d) => s + (d.kind === 'percent' ? base * (d.value || 0) / 100 : (d.value || 0)), 0), [deductions])
  const individualOf = (r: PayrollRow) => parseFloat(discounts[r.employeeId] ?? '0') || 0
  const netOf = (r: PayrollRow) => Math.max(0, r.base - generalFor(r.base) - individualOf(r))

  // KPIs (derivados de las filas)
  const today = toISO(new Date())
  const kpis = useMemo(() => {
    const present = rows.filter(r => r.days.some(d => d.date === today && d.checkIn)).length
    const hoursToday = rows.reduce((s, r) => s + r.days.filter(d => d.date === today).reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0), 0)
    const bruto = rows.reduce((s, r) => s + r.base, 0)
    const neto = rows.reduce((s, r) => s + netOf(r), 0)
    const totalDays = rows.reduce((s, r) => s + r.daysPresent, 0)
    const attPct = rows.length ? Math.round((totalDays / (rows.length * 6)) * 100) : 0
    return { total: rows.length, present, hoursToday, bruto, neto, attPct: Math.min(100, attPct) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, deductions, discounts])

  const totals = useMemo(() => {
    const bruto = rows.reduce((s, r) => s + r.base, 0)
    const general = rows.reduce((s, r) => s + generalFor(r.base), 0)
    const individual = rows.reduce((s, r) => s + individualOf(r), 0)
    const neto = rows.reduce((s, r) => s + netOf(r), 0)
    return { bruto, general, individual, desc: general + individual, neto }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, deductions, discounts])

  function saveDiscount(r: PayrollRow) {
    startTransition(async () => {
      const res = await savePayrollDiscountAction(r.employeeId, periodStart, individualOf(r))
      if (res.success) toast.success('Descuento guardado'); else toast.error(res.error ?? 'Error')
    })
  }

  // ─── Descuentos generales (edición inline) ───
  function setDed(i: number, patch: Partial<PayrollDeduction>) {
    setDeductions(ds => ds.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }
  function addDed() {
    setDeductions(ds => [...ds, { id: '', concept: '', kind: 'percent', value: 0, description: null }])
  }
  function saveDed(i: number) {
    const d = deductions[i]
    if (!d.concept.trim()) { toast.error('Escribe el concepto'); return }
    startTransition(async () => {
      const res = await saveDeductionAction({ id: d.id || undefined, concept: d.concept, kind: d.kind, value: d.value, description: d.description ?? undefined })
      if (res.success) { toast.success('Descuento guardado'); getDeductionsAction().then(setDeductions) }
      else toast.error(res.error ?? 'Error')
    })
  }
  function removeDed(i: number) {
    const d = deductions[i]
    if (!d.id) { setDeductions(ds => ds.filter((_, idx) => idx !== i)); return }
    startTransition(async () => {
      const res = await deleteDeductionAction(d.id)
      if (res.success) { toast.success('Eliminado'); setDeductions(ds => ds.filter((_, idx) => idx !== i)) }
      else toast.error(res.error ?? 'Error')
    })
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const nomina = rows.map(r => ({
      Empleado: r.name ?? '', Teléfono: r.phone ?? '', Emergencia: r.emergency ?? '', 'N° Seguro Social': r.insurance ?? '',
      Sucursal: r.branch ?? '', 'Días trabajados': r.daysPresent, Horas: fmtH(r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)),
      'Sueldo base': r.base, 'Desc. general': Math.round(generalFor(r.base) * 100) / 100, 'Desc. individual': individualOf(r),
      'Neto a pagar': Math.round(netOf(r) * 100) / 100, Incidencias: r.notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(nomina.length ? nomina : [{ Empleado: '' }])
    ws['!cols'] = [{ wch: 20 }, { wch: 13 }, { wch: 13 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina')
    // Descuentos generales
    const wsd = XLSX.utils.json_to_sheet((deductions.length ? deductions : [{ concept: '' } as PayrollDeduction]).map(d => ({
      Concepto: d.concept, Tipo: d.kind === 'percent' ? 'Porcentaje' : 'Monto', Valor: d.kind === 'percent' ? `${d.value}%` : d.value, Descripción: d.description ?? '',
    })))
    XLSX.utils.book_append_sheet(wb, wsd, 'Descuentos')
    // Asistencia día por día
    const detalle: Record<string, string | number>[] = []
    rows.forEach(r => r.days.forEach(d => detalle.push({
      Empleado: r.name ?? '', Fecha: d.date, Entrada: fmtTime(d.checkIn), Salida: fmtTime(d.checkOut),
      Estado: d.checkIn ? 'Presente' : 'Ausente', Observación: d.note ?? '',
    })))
    if (detalle.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Asistencia')
    XLSX.writeFile(wb, `nomina-${periodLabel.toLowerCase()}-${periodStart}.xlsx`)
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF('l')
    doc.setFontSize(16); doc.text('Nómina', 14, 16)
    doc.setFontSize(10); doc.setTextColor(120); doc.text(`Periodo: ${periodLabel} · desde ${periodStart}`, 14, 23)
    autoTable(doc, {
      startY: 28,
      head: [['Empleado', 'Tel.', 'Emergencia', 'N° Seguro', 'Sucursal', 'Días', 'Horas', 'Base', 'Desc. gral', 'Desc. ind', 'Neto']],
      body: rows.map(r => [
        r.name ?? '', r.phone ?? '—', r.emergency ?? '—', r.insurance ?? '—', r.branch ?? '—', r.daysPresent,
        fmtH(r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)),
        formatCurrency(r.base), formatCurrency(generalFor(r.base)), formatCurrency(individualOf(r)), formatCurrency(netOf(r)),
      ]),
      foot: [['', '', '', '', '', '', 'Totales', formatCurrency(totals.bruto), formatCurrency(totals.general), formatCurrency(totals.individual), formatCurrency(totals.neto)]],
      styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [79, 70, 229] }, footStyles: { fillColor: [238, 242, 255], textColor: 40, fontStyle: 'bold' },
    })
    doc.save(`nomina-${periodLabel.toLowerCase()}-${periodStart}.pdf`)
  }

  const kpiCards = [
    { icon: Users, label: 'Empleados', value: String(kpis.total), tint: 'from-indigo-500 to-violet-600' },
    { icon: UserCheck, label: 'Presentes hoy', value: String(kpis.present), tint: 'from-emerald-500 to-green-600' },
    { icon: Clock4, label: 'Horas hoy', value: fmtH(kpis.hoursToday), tint: 'from-sky-500 to-blue-600' },
    { icon: TrendingUp, label: 'Asistencia', value: `${kpis.attPct}%`, tint: 'from-amber-500 to-orange-600' },
    { icon: Wallet, label: 'Nómina neta', value: formatCurrency(kpis.neto), tint: 'from-fuchsia-500 to-purple-600' },
  ]

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.map((k, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-3.5">
            <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.tint} flex items-center justify-center mb-2`}>
              <k.icon size={17} className="text-white" />
            </span>
            <p className="text-[11px] text-gray-400 font-medium">{k.label}</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla de nómina */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Wallet size={16} className="text-indigo-600" /> Nómina · {periodLabel}</p>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${period === p.id ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>{p.label}</button>
              ))}
            </div>
            <button onClick={exportExcel} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"><FileSpreadsheet size={13} /> Excel</button>
            <button onClick={exportPDF} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"><FileText size={13} /> PDF</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin empleados para la nómina.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1080px] border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-indigo-50 text-indigo-900 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Empleado</th>
                  <th className="text-left px-2 py-2 font-semibold">Teléfono</th>
                  <th className="text-left px-2 py-2 font-semibold">Emergencia</th>
                  <th className="text-left px-2 py-2 font-semibold">N° Seguro</th>
                  <th className="text-left px-2 py-2 font-semibold">Sucursal</th>
                  <th className="text-center px-2 py-2 font-semibold">Asistencia (semana)</th>
                  <th className="text-center px-2 py-2 font-semibold">Días</th>
                  <th className="text-center px-2 py-2 font-semibold">Horas</th>
                  <th className="text-right px-2 py-2 font-semibold">Base</th>
                  <th className="text-right px-2 py-2 font-semibold">Desc. gral</th>
                  <th className="text-center px-2 py-2 font-semibold">Desc. ind.</th>
                  <th className="text-right px-3 py-2 font-semibold">Neto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const dayMap = new Map(r.days.map(d => [d.date, d]))
                  const hours = r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)
                  return (
                    <tr key={r.employeeId} className="odd:bg-white even:bg-gray-50/60 border-t border-gray-100 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{r.name ?? 'Empleado'}</p>
                        {r.notes
                          ? <span className="inline-block mt-0.5 text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5" title={r.notes}>{r.notes.length > 28 ? r.notes.slice(0, 28) + '…' : r.notes}</span>
                          : <span className="inline-block mt-0.5 text-[10px] bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5">Sin incidencias</span>}
                      </td>
                      <td className="px-2 py-2 text-gray-500">{r.phone ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500">{r.emergency ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500">{r.insurance ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500">{r.branch ?? '—'}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {week.map((date, i) => {
                            const d = dayMap.get(date)
                            const present = !!d?.checkIn
                            const absent = !!d && !d.checkIn
                            return (
                              <span key={date} title={`${WD[i]} ${date.slice(5)}`}
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${present ? 'bg-emerald-100 text-emerald-600' : absent ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-300'}`}>
                                {present ? <Check size={11} /> : absent ? <X size={11} /> : '·'}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center font-medium">{r.daysPresent}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{fmtH(hours)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(r.base)}</td>
                      <td className="px-2 py-2 text-right text-rose-600">{generalFor(r.base) > 0 ? `-${formatCurrency(generalFor(r.base))}` : '—'}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          <Input type="number" min="0" value={discounts[r.employeeId] ?? '0'}
                            onChange={e => setDiscounts(d => ({ ...d, [r.employeeId]: e.target.value }))}
                            className="w-20 h-8 text-right text-xs" />
                          <button onClick={() => saveDiscount(r)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={14} /></button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{formatCurrency(netOf(r))}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50/70 border-t-2 border-indigo-100 font-semibold text-gray-800">
                  <td className="px-3 py-2" colSpan={8}>Totales</td>
                  <td className="px-2 py-2 text-right">{formatCurrency(totals.bruto)}</td>
                  <td className="px-2 py-2 text-right text-rose-600">-{formatCurrency(totals.general)}</td>
                  <td className="px-2 py-2 text-center text-rose-600">-{formatCurrency(totals.individual)}</td>
                  <td className="px-3 py-2 text-right text-indigo-700">{formatCurrency(totals.neto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Descuentos generales + Resumen */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Receipt size={16} className="text-indigo-600" /> Descuentos generales</p>
            <button onClick={addDed} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><Plus size={14} /> Agregar</button>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">ISR, Seguro Social u otros. Aplican a todos (porcentaje del sueldo base o monto fijo).</p>
          {deductions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin descuentos generales. Agrega ISR, Seguro Social, etc.</p>
          ) : (
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div key={d.id || `new-${i}`} className="flex items-center gap-1.5">
                  <Input value={d.concept} onChange={e => setDed(i, { concept: e.target.value })} placeholder="Concepto" className="h-9 text-sm flex-1 min-w-0" />
                  <select value={d.kind} onChange={e => setDed(i, { kind: e.target.value as 'percent' | 'amount' })} className="h-9 text-xs border border-gray-200 rounded-lg px-1.5 bg-white">
                    <option value="percent">%</option>
                    <option value="amount">$</option>
                  </select>
                  <Input type="number" min="0" value={d.value} onChange={e => setDed(i, { value: parseFloat(e.target.value) || 0 })} className="h-9 text-sm w-20 text-right" />
                  <button onClick={() => saveDed(i)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 p-1" title="Guardar"><Save size={15} /></button>
                  <button onClick={() => removeDed(i)} disabled={isPending} className="text-gray-300 hover:text-red-500 p-1" title="Eliminar"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><Wallet size={16} className="text-indigo-600" /> Resumen de nómina</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Total bruto</span><span className="font-semibold text-gray-900">{formatCurrency(totals.bruto)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Descuentos generales</span><span className="font-medium text-rose-600">-{formatCurrency(totals.general)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Descuentos individuales</span><span className="font-medium text-rose-600">-{formatCurrency(totals.individual)}</span></div>
            <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2"><span className="text-gray-500">Total descuentos</span><span className="font-medium text-rose-600">-{formatCurrency(totals.desc)}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2.5 mt-1">
              <span className="text-sm font-semibold text-indigo-900">Total neto a pagar</span>
              <span className="text-lg font-bold text-indigo-700">{formatCurrency(totals.neto)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
