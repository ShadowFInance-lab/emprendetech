'use client'

import { useEffect, useMemo, useState, useTransition, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Wallet, Loader2, FileSpreadsheet, FileText, Save, Plus, Trash2, Check, X,
  Users, UserCheck, Clock4, TrendingUp, Receipt, Pencil, ReceiptText,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getPayrollAction, savePayrollDiscountAction,
  getDeductionsAction, saveDeductionAction, deleteDeductionAction,
  type PayrollRow, type PayrollPeriod, type PayrollDeduction,
} from '@/lib/actions/payroll'
import { listStaffAction, saveStaffAction, type Staff } from '@/lib/actions/staff'
import { formatCurrency } from '@/lib/utils/format'
import EmployeeEditModal from './EmployeeEditModal'
import StaffEditModal from './StaffEditModal'
import CartocenaWidget from './CartocenaWidget'

const PERIODS: { id: PayrollPeriod; label: string }[] = [
  { id: 'week', label: 'Semana' }, { id: 'fortnight', label: 'Quincena' }, { id: 'month', label: 'Mes' },
]
const DIVISOR: Record<PayrollPeriod, number> = { week: 6, fortnight: 13, month: 26 }
const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
function thisWeekDates(): string[] {
  const now = new Date(); const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return toISO(d) })
}
function hoursOf(ci: string | null, co: string | null): number {
  if (!ci || !co) return 0
  const h = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000
  return h > 0 && h < 24 ? h : 0
}
const fmtH = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${pad(m % 60)}m` }
function incidencia(notes: string): { txt: string; cls: string } {
  if (!notes) return { txt: '—', cls: 'bg-emerald-50 text-emerald-600' }
  const l = notes.toLowerCase()
  if (l.includes('falta') || l.includes('ausen')) return { txt: 'Falta', cls: 'bg-red-100 text-red-600' }
  if (l.includes('tarde')) return { txt: 'Llegada tarde', cls: 'bg-amber-100 text-amber-700' }
  return { txt: 'Incidencia', cls: 'bg-amber-100 text-amber-700' }
}

export default function PayrollDashboard({ createSlot, refreshSignal = 0, isPaid = true }: { createSlot?: ReactNode; refreshSignal?: number; isPaid?: boolean }) {
  const [period, setPeriod] = useState<PayrollPeriod>('week')
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [discounts, setDiscounts] = useState<Record<string, string>>({})
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<{ id: string; name: string; discount: number } | null>(null)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  const refresh = useCallback(async (p: PayrollPeriod) => {
    setLoading(true)
    const [res, ded, st] = await Promise.all([getPayrollAction(p), getDeductionsAction(), listStaffAction()])
    setRows(res.rows); setPeriodStart(res.periodStart); setDeductions(ded); setStaff(st)
    const d: Record<string, string> = {}; res.rows.forEach(r => { d[r.employeeId] = String(r.discount || 0) }); setDiscounts(d)
    setLoading(false)
  }, [])
  useEffect(() => { refresh(period) }, [period, refresh, refreshSignal])

  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? ''
  const week = useMemo(() => thisWeekDates(), [])
  const today = toISO(new Date())

  const generalFor = useCallback((base: number) =>
    deductions.reduce((s, d) => s + (d.kind === 'percent' ? base * (d.value || 0) / 100 : (d.value || 0)), 0), [deductions])
  const individualOf = (r: PayrollRow) => parseFloat(discounts[r.employeeId] ?? '0') || 0
  const netOf = (r: PayrollRow) => Math.max(0, r.base - generalFor(r.base) - individualOf(r))
  const netStaff = (s: Staff) => Math.max(0, s.salary - generalFor(s.salary) - s.discount)
  const totalCount = rows.length + staff.length
  const names = useMemo(() => [...rows.map(r => r.name || 'Empleado'), ...staff.map(s => s.name)], [rows, staff])

  const kpis = useMemo(() => {
    const present = rows.filter(r => r.days.some(d => d.date === today && d.checkIn)).length
    const hoursToday = rows.reduce((s, r) => s + r.days.filter(d => d.date === today).reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0), 0)
    const neto = rows.reduce((s, r) => s + netOf(r), 0) + staff.reduce((s, x) => s + netStaff(x), 0)
    const totalDays = rows.reduce((s, r) => s + r.daysPresent, 0)
    const attPct = rows.length ? Math.min(100, Math.round((totalDays / (rows.length * 6)) * 100)) : 0
    const payToday = rows.reduce((s, r) => s + (r.days.some(d => d.date === today && d.checkIn) ? r.base / DIVISOR[period] : 0), 0)
    return { total: totalCount, present, hoursToday, neto, attPct, payToday }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, staff, deductions, discounts, period])

  const totals = useMemo(() => {
    const bruto = rows.reduce((s, r) => s + r.base, 0) + staff.reduce((s, x) => s + x.salary, 0)
    const general = rows.reduce((s, r) => s + generalFor(r.base), 0) + staff.reduce((s, x) => s + generalFor(x.salary), 0)
    const individual = rows.reduce((s, r) => s + individualOf(r), 0) + staff.reduce((s, x) => s + x.discount, 0)
    const neto = rows.reduce((s, r) => s + netOf(r), 0) + staff.reduce((s, x) => s + netStaff(x), 0)
    return { bruto, general, individual, desc: general + individual, neto }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, staff, deductions, discounts])

  function saveDiscount(r: PayrollRow) {
    startTransition(async () => {
      const res = await savePayrollDiscountAction(r.employeeId, periodStart, individualOf(r))
      if (res.success) toast.success('Descuento guardado'); else toast.error(res.error ?? 'Error')
    })
  }

  function setDed(i: number, patch: Partial<PayrollDeduction>) { setDeductions(ds => ds.map((d, idx) => idx === i ? { ...d, ...patch } : d)) }
  function addDed() { setDeductions(ds => [...ds, { id: '', concept: '', kind: 'percent', value: 0, description: null }]) }
  function saveDed(i: number) {
    const d = deductions[i]
    if (!d.concept.trim()) { toast.error('Escribe el concepto'); return }
    startTransition(async () => {
      const res = await saveDeductionAction({ id: d.id || undefined, concept: d.concept, kind: d.kind, value: d.value, description: d.description ?? undefined })
      if (res.success) { toast.success('Descuento guardado'); getDeductionsAction().then(setDeductions) } else toast.error(res.error ?? 'Error')
    })
  }
  function removeDed(i: number) {
    const d = deductions[i]
    if (!d.id) { setDeductions(ds => ds.filter((_, idx) => idx !== i)); return }
    startTransition(async () => {
      const res = await deleteDeductionAction(d.id)
      if (res.success) { toast.success('Eliminado'); setDeductions(ds => ds.filter((_, idx) => idx !== i)) } else toast.error(res.error ?? 'Error')
    })
  }

  async function receipt(p: { name: string; periodo: string; days: number; absences: number; base: number; individual: number }) {
    if (!isPaid) { toast.error('El recibo individual está en planes de pago'); return }
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    const general = deductions.map(d => ({ c: d.concept, amt: d.kind === 'percent' ? p.base * (d.value || 0) / 100 : (d.value || 0) }))
    const totalGeneral = general.reduce((s, g) => s + g.amt, 0)
    const totalDesc = totalGeneral + p.individual
    const neto = Math.max(0, p.base - totalDesc)
    doc.setFontSize(16); doc.text('Recibo de nómina', 14, 18)
    doc.setFontSize(10); doc.setTextColor(90)
    doc.text(`Empleado: ${p.name}`, 14, 28)
    doc.text(`Periodo: ${p.periodo}`, 14, 34)
    doc.text(`Días trabajados: ${p.days}     Faltas: ${p.absences}`, 14, 40)
    autoTable(doc, {
      startY: 46, head: [['Concepto', 'Monto']],
      body: [
        ['Sueldo base', formatCurrency(p.base)],
        ...general.map(g => [`Descuento: ${g.c}`, `-${formatCurrency(g.amt)}`]),
        ['Descuento individual', `-${formatCurrency(p.individual)}`],
        ['Total descuentos', `-${formatCurrency(totalDesc)}`],
      ],
      foot: [['Neto a pagar', formatCurrency(neto)]],
      styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [79, 70, 229] }, footStyles: { fillColor: [238, 242, 255], textColor: 40, fontStyle: 'bold' },
    })
    doc.save(`recibo-${p.name.replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function setStaffDays(id: string, days: number) { setStaff(st => st.map(s => s.id === id ? { ...s, days_worked: days } : s)) }
  function setStaffDiscount(id: string, disc: number) { setStaff(st => st.map(s => s.id === id ? { ...s, discount: disc } : s)) }
  function saveStaffRow(s: Staff) {
    startTransition(async () => {
      const r = await saveStaffAction(s.id, { days_worked: s.days_worked, discount: s.discount })
      if (r.success) toast.success('Guardado'); else toast.error(r.error ?? 'Error')
    })
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const nomina = [
      ...rows.map(r => ({ Empleado: r.name ?? '', Tipo: 'Con acceso', Teléfono: r.phone ?? '', Emergencia: r.emergency ?? '', 'N° Seguro Social': r.insurance ?? '', Sucursal: r.branch ?? '', 'Días trabajados': r.daysPresent, Horas: fmtH(r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)), 'Sueldo base': r.base, 'Desc. general': Math.round(generalFor(r.base) * 100) / 100, 'Desc. individual': individualOf(r), 'Neto a pagar': Math.round(netOf(r) * 100) / 100, Incidencias: r.notes ?? '' })),
      ...staff.map(s => ({ Empleado: s.name, Tipo: 'Registro', Teléfono: s.phone ?? '', Emergencia: s.emergency_phone ?? '', 'N° Seguro Social': s.insurance_no ?? '', Sucursal: s.branch ?? '', 'Días trabajados': s.days_worked, Horas: '—', 'Sueldo base': s.salary, 'Desc. general': Math.round(generalFor(s.salary) * 100) / 100, 'Desc. individual': s.discount, 'Neto a pagar': Math.round(netStaff(s) * 100) / 100, Incidencias: s.note ?? '' })),
    ]
    const ws = XLSX.utils.json_to_sheet(nomina.length ? nomina : [{ Empleado: '' }])
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina')
    const wsd = XLSX.utils.json_to_sheet((deductions.length ? deductions : [{ concept: '' } as PayrollDeduction]).map(d => ({ Concepto: d.concept, Tipo: d.kind === 'percent' ? 'Porcentaje' : 'Monto', Valor: d.kind === 'percent' ? `${d.value}%` : d.value, Descripción: d.description ?? '' })))
    XLSX.utils.book_append_sheet(wb, wsd, 'Descuentos')
    XLSX.writeFile(wb, `nomina-${periodLabel.toLowerCase()}-${periodStart}.xlsx`)
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF('l')
    doc.setFontSize(16); doc.text('Nómina', 14, 16)
    doc.setFontSize(10); doc.setTextColor(120); doc.text(`Periodo: ${periodLabel} · desde ${periodStart}`, 14, 23)
    autoTable(doc, {
      startY: 28, head: [['Empleado', 'Tipo', 'N° Seguro', 'Sucursal', 'Días', 'Pago', 'Desc. gral', 'Desc. ind', 'Neto']],
      body: [
        ...rows.map(r => [r.name ?? '', 'Acceso', r.insurance ?? '—', r.branch ?? '—', r.daysPresent, formatCurrency(r.base), formatCurrency(generalFor(r.base)), formatCurrency(individualOf(r)), formatCurrency(netOf(r))]),
        ...staff.map(s => [s.name, 'Registro', s.insurance_no ?? '—', s.branch ?? '—', s.days_worked, formatCurrency(s.salary), formatCurrency(generalFor(s.salary)), formatCurrency(s.discount), formatCurrency(netStaff(s))]),
      ],
      foot: [['Totales', '', '', '', '', formatCurrency(totals.bruto), formatCurrency(totals.general), formatCurrency(totals.individual), formatCurrency(totals.neto)]],
      styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [79, 70, 229] }, footStyles: { fillColor: [238, 242, 255], textColor: 40, fontStyle: 'bold' },
    })
    doc.save(`nomina-${periodLabel.toLowerCase()}-${periodStart}.pdf`)
  }

  const kpiCards = [
    { icon: Users, label: 'Empleados', value: String(kpis.total), tint: 'from-indigo-500 to-violet-600' },
    { icon: UserCheck, label: 'Presentes hoy', value: String(kpis.present), tint: 'from-emerald-500 to-green-600' },
    { icon: Clock4, label: 'Horas hoy', value: fmtH(kpis.hoursToday), tint: 'from-sky-500 to-blue-600' },
    { icon: Wallet, label: 'Pago de hoy', value: formatCurrency(kpis.payToday), tint: 'from-rose-500 to-pink-600' },
    { icon: TrendingUp, label: 'Asistencia', value: `${kpis.attPct}%`, tint: 'from-amber-500 to-orange-600' },
  ]

  return (
    <div className="space-y-4">
      {/* Bento: crear + KPIs + Cartocena */}
      <div className={createSlot ? 'grid grid-cols-1 xl:grid-cols-3 gap-3 items-start' : ''}>
        {createSlot && <div className="xl:col-span-1">{createSlot}</div>}
        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${createSlot ? 'xl:col-span-2' : 'xl:grid-cols-6'}`}>
          {kpiCards.map((k, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-3.5">
              <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.tint} flex items-center justify-center mb-2`}><k.icon size={17} className="text-white" /></span>
              <p className="text-[11px] text-gray-400 font-medium">{k.label}</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p>
            </div>
          ))}
          <CartocenaWidget names={names} totalCount={totalCount} />
        </div>
      </div>

      {/* Tabla de nómina */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Wallet size={16} className="text-indigo-600" /> Nómina · {periodLabel}</p>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${period === p.id ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>{p.label}</button>
              ))}
            </div>
            <button onClick={exportExcel} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"><FileSpreadsheet size={13} /> Excel</button>
            <button onClick={exportPDF} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"><FileText size={13} /> PDF</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
        ) : totalCount === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin empleados para la nómina.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1500px] border-separate border-spacing-0">
              <thead className="bg-indigo-50 text-indigo-900 text-xs">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-indigo-50 z-20 border-b border-indigo-100">Empleado</th>
                  {['Teléfono', 'Emergencia', 'N° Seguro', 'Sucursal', 'Entrada', 'Salida', 'Horas'].map(h => <th key={h} className="text-left px-2 py-2.5 font-semibold border-b border-indigo-100 whitespace-nowrap">{h}</th>)}
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Días trabajados</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Días</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100">Pago</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100 whitespace-nowrap">Falta / tarde</th>
                  <th className="text-left px-2 py-2.5 font-semibold border-b border-indigo-100">Descripción</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Descuento</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100">Neto</th>
                  <th className="text-center px-3 py-2.5 font-semibold border-b border-indigo-100">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const dayMap = new Map(r.days.map(d => [d.date, d]))
                  const hours = r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)
                  const present = r.days.filter(d => d.checkIn); const last = present[present.length - 1]
                  const inc = incidencia(r.notes)
                  return (
                    <tr key={r.employeeId} onClick={() => setEditing({ id: r.employeeId, name: r.name ?? 'Empleado', discount: individualOf(r) })} className="group bg-white hover:bg-indigo-50/30 cursor-pointer">
                      <td className="px-3 py-2 sticky left-0 bg-white group-hover:bg-indigo-50/30 z-10 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{(r.name || '?').charAt(0).toUpperCase()}</span>
                          <span className="font-medium text-gray-900 whitespace-nowrap">{r.name ?? 'Empleado'}</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 rounded px-1 py-0.5">Acceso</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.phone ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.emergency ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.insurance ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.branch ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap">{fmtTime(last?.checkIn ?? null)}</td>
                      <td className="px-2 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap">{fmtTime(last?.checkOut ?? null)}</td>
                      <td className="px-2 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap">{fmtH(hours)}</td>
                      <td className="px-2 py-2 border-b border-gray-100">
                        <div className="flex items-center justify-center gap-1">
                          {week.map((date, i) => {
                            const d = dayMap.get(date); const ok = !!d?.checkIn, ab = !!d && !d.checkIn
                            const late = ok && !!d?.note && d.note.toLowerCase().includes('tarde')
                            const cls = late ? 'bg-amber-100 text-amber-600' : ok ? 'bg-emerald-100 text-emerald-600' : ab ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-300'
                            return <span key={date} title={`${WD[i]} ${date.slice(5)}${late ? ' · llegada tarde' : ''}`} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${cls}`}>{late ? <Clock4 size={10} /> : ok ? <Check size={11} /> : ab ? <X size={11} /> : '·'}</span>
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center font-medium border-b border-gray-100">{r.daysPresent}</td>
                      <td className="px-2 py-2 text-right border-b border-gray-100 whitespace-nowrap">{formatCurrency(r.base)}</td>
                      <td className="px-2 py-2 text-center border-b border-gray-100"><span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${inc.cls}`}>{inc.txt}</span></td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 max-w-[180px]"><span className="line-clamp-1" title={r.notes || 'Sin incidencias'}>{r.notes || 'Sin incidencias'}</span></td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Input type="number" min="0" value={discounts[r.employeeId] ?? '0'} onChange={e => setDiscounts(d => ({ ...d, [r.employeeId]: e.target.value }))} className="w-20 h-8 text-right text-xs" />
                          <button onClick={() => saveDiscount(r)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={14} /></button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-gray-900 border-b border-gray-100 whitespace-nowrap">{formatCurrency(netOf(r))}</td>
                      <td className="px-3 py-2 text-center border-b border-gray-100 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => receipt({ name: r.name ?? 'Empleado', periodo: periodLabel, days: r.daysPresent, absences: 0, base: r.base, individual: individualOf(r) })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50" title="Recibo PDF"><ReceiptText size={15} /></button>
                        <button onClick={() => setEditing({ id: r.employeeId, name: r.name ?? 'Empleado', discount: individualOf(r) })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
                {staff.map(s => {
                  const inc = s.absences > 0 ? { txt: `${s.absences} falta(s)`, cls: 'bg-red-100 text-red-600' } : { txt: '—', cls: 'bg-emerald-50 text-emerald-600' }
                  return (
                    <tr key={s.id} onClick={() => setEditingStaff(s)} className="group bg-slate-50/40 hover:bg-indigo-50/30 cursor-pointer">
                      <td className="px-3 py-2 sticky left-0 bg-slate-50 group-hover:bg-indigo-50/30 z-10 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{(s.name || '?').charAt(0).toUpperCase()}</span>
                          <span className="font-medium text-gray-900 whitespace-nowrap">{s.name}</span>
                          <span className="text-[9px] bg-slate-200 text-slate-600 rounded px-1 py-0.5">Registro</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.phone ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.emergency_phone ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.insurance_no ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.branch ?? '—'}</td>
                      <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                      <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                      <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                      <td className="px-2 py-2 text-center text-[11px] text-gray-400 border-b border-gray-100">Manual</td>
                      <td className="px-2 py-2 text-center border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Input type="number" min="0" value={s.days_worked} onChange={e => setStaffDays(s.id, parseInt(e.target.value) || 0)} className="w-14 h-8 text-center text-xs" />
                          <button onClick={() => saveStaffRow(s)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={13} /></button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right border-b border-gray-100 whitespace-nowrap">{formatCurrency(s.salary)}</td>
                      <td className="px-2 py-2 text-center border-b border-gray-100"><span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${inc.cls}`}>{inc.txt}</span></td>
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 max-w-[180px]"><span className="line-clamp-1" title={s.note || '—'}>{s.note || '—'}</span></td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Input type="number" min="0" value={s.discount} onChange={e => setStaffDiscount(s.id, parseFloat(e.target.value) || 0)} className="w-20 h-8 text-right text-xs" />
                          <button onClick={() => saveStaffRow(s)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={14} /></button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-gray-900 border-b border-gray-100 whitespace-nowrap">{formatCurrency(netStaff(s))}</td>
                      <td className="px-3 py-2 text-center border-b border-gray-100 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => receipt({ name: s.name, periodo: 'Manual', days: s.days_worked, absences: s.absences, base: s.salary, individual: s.discount })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50" title="Recibo PDF"><ReceiptText size={15} /></button>
                        <button onClick={() => setEditingStaff(s)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50/70 font-semibold text-gray-800">
                  <td className="px-3 py-2.5 sticky left-0 bg-indigo-50 z-10" colSpan={10}>Totales · {totalCount} empleado(s)</td>
                  <td className="px-2 py-2.5 text-right">{formatCurrency(totals.bruto)}</td>
                  <td colSpan={2} className="px-2 py-2.5 text-right text-gray-500">Total a pagar</td>
                  <td className="px-2 py-2.5 text-center text-rose-600">-{formatCurrency(totals.individual)}</td>
                  <td className="px-2 py-2.5 text-right text-indigo-700">{formatCurrency(totals.neto)}</td>
                  <td className="px-3 py-2.5" />
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
                  <select value={d.kind} onChange={e => setDed(i, { kind: e.target.value as 'percent' | 'amount' })} className="h-9 text-xs border border-gray-200 rounded-lg px-1.5 bg-white"><option value="percent">%</option><option value="amount">$</option></select>
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
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2.5 mt-1"><span className="text-sm font-semibold text-indigo-900">Total neto a pagar</span><span className="text-lg font-bold text-indigo-700">{formatCurrency(totals.neto)}</span></div>
          </div>
        </div>
      </div>

      {editing && <EmployeeEditModal employeeId={editing.id} employeeName={editing.name} periodStart={periodStart} initialDiscount={editing.discount} onClose={() => setEditing(null)} onSaved={() => refresh(period)} />}
      {editingStaff && <StaffEditModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSaved={() => refresh(period)} />}
    </div>
  )
}
