'use client'

import { useEffect, useMemo, useState, useTransition, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Wallet, Loader2, FileSpreadsheet, FileText, Save, Plus, Trash2, Check, X,
  Users, UserCheck, Clock4, TrendingUp, Receipt, Pencil, ReceiptText, CalendarClock, BadgeDollarSign,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getPayrollAction, savePayrollRowAction,
  getDeductionsAction, saveDeductionAction, deleteDeductionAction,
  type PayrollRow, type PayrollPeriod, type PayrollDeduction,
} from '@/lib/actions/payroll'
import { listStaffAction, saveStaffAction, type Staff } from '@/lib/actions/staff'
import { formatCurrency } from '@/lib/utils/format'
import EmployeeEditModal from './EmployeeEditModal'
import StaffEditModal from './StaffEditModal'
import CartocenaWidget from './CartocenaWidget'

const PERIODS: { id: PayrollPeriod; label: string }[] = [
  { id: 'week', label: 'Semanal' }, { id: 'biweekly', label: 'Catorcenal' },
  { id: 'fortnight', label: 'Quincenal' }, { id: 'month', label: 'Mensual' },
]
const QUICK_DED = ['ISR', 'Seguro Social', 'Infonavit', 'Otros']
const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
function thisWeekDates(): string[] {
  const now = new Date(); const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return toISO(d) })
}
function periodEnd(period: PayrollPeriod, startISO: string): Date {
  const s = new Date(startISO + 'T00:00:00')
  if (period === 'week') { const e = new Date(s); e.setDate(s.getDate() + 6); return e }
  if (period === 'biweekly') { const e = new Date(s); e.setDate(s.getDate() + 13); return e }
  if (period === 'fortnight') return s.getDate() === 1 ? new Date(s.getFullYear(), s.getMonth(), 15) : new Date(s.getFullYear(), s.getMonth() + 1, 0)
  return new Date(s.getFullYear(), s.getMonth() + 1, 0)
}
function hoursOf(ci: string | null, co: string | null): number {
  if (!ci || !co) return 0
  const h = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000
  return h > 0 && h < 24 ? h : 0
}
const fmtH = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${pad(m % 60)}m` }

export default function PayrollDashboard({ createSlot, refreshSignal = 0, isPaid = true }: { createSlot?: ReactNode; refreshSignal?: number; isPaid?: boolean }) {
  const [period, setPeriod] = useState<PayrollPeriod>('week')
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [discounts, setDiscounts] = useState<Record<string, string>>({})
  const [bonuses, setBonuses] = useState<Record<string, string>>({})
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<{ id: string; name: string; discount: number } | null>(null)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  const refresh = useCallback(async (p: PayrollPeriod) => {
    setLoading(true)
    const [res, ded, st] = await Promise.all([getPayrollAction(p), getDeductionsAction(), listStaffAction()])
    setRows(res.rows); setPeriodStart(res.periodStart); setDeductions(ded); setStaff(st)
    const d: Record<string, string> = {}, b: Record<string, string> = {}
    res.rows.forEach(r => { d[r.employeeId] = String(r.discount || 0); b[r.employeeId] = String(r.bonus || 0) })
    setDiscounts(d); setBonuses(b); setLoading(false)
  }, [])
  useEffect(() => { refresh(period) }, [period, refresh, refreshSignal])

  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? ''
  const week = useMemo(() => thisWeekDates(), [])
  const today = toISO(new Date())

  const isrDed = deductions.find(d => /isr/i.test(d.concept))
  const imssDed = deductions.find(d => /seguro|imss|social/i.test(d.concept))
  const amtOf = (ded: PayrollDeduction | undefined, base: number) => ded ? (ded.kind === 'percent' ? base * (ded.value || 0) / 100 : (ded.value || 0)) : 0
  const generalFor = useCallback((base: number) =>
    deductions.reduce((s, d) => s + (d.kind === 'percent' ? base * (d.value || 0) / 100 : (d.value || 0)), 0), [deductions])
  const isrFor = (base: number) => amtOf(isrDed, base)
  const imssFor = (base: number) => amtOf(imssDed, base)

  const indiv = (r: PayrollRow) => parseFloat(discounts[r.employeeId] ?? '0') || 0
  const bonoOf = (r: PayrollRow) => parseFloat(bonuses[r.employeeId] ?? '0') || 0
  const netOf = (r: PayrollRow) => Math.max(0, r.base + bonoOf(r) - generalFor(r.base) - indiv(r))
  const netStaff = (s: Staff) => Math.max(0, s.salary + s.bonus - generalFor(s.salary) - s.discount)
  const totalCount = rows.length + staff.length
  const names = useMemo(() => [...rows.map(r => r.name || 'Empleado'), ...staff.map(s => s.name)], [rows, staff])

  const kpis = useMemo(() => {
    const present = rows.filter(r => r.days.some(d => d.date === today && d.checkIn)).length
    const hoursToday = rows.reduce((s, r) => s + r.days.filter(d => d.date === today).reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0), 0)
    const pendiente = rows.filter(r => !r.paid).reduce((s, r) => s + netOf(r), 0) + staff.filter(s => !s.paid).reduce((s2, x) => s2 + netStaff(x), 0)
    const totalDays = rows.reduce((s, r) => s + r.daysPresent, 0)
    const attPct = rows.length ? Math.min(100, Math.round((totalDays / (rows.length * 6)) * 100)) : 0
    return { total: totalCount, present, hoursToday, pendiente, attPct }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, staff, deductions, discounts, bonuses])

  const totals = useMemo(() => {
    const bruto = rows.reduce((s, r) => s + r.base + bonoOf(r), 0) + staff.reduce((s, x) => s + x.salary + x.bonus, 0)
    const isr = rows.reduce((s, r) => s + isrFor(r.base), 0) + staff.reduce((s, x) => s + isrFor(x.salary), 0)
    const imss = rows.reduce((s, r) => s + imssFor(r.base), 0) + staff.reduce((s, x) => s + imssFor(x.salary), 0)
    const general = rows.reduce((s, r) => s + generalFor(r.base), 0) + staff.reduce((s, x) => s + generalFor(x.salary), 0)
    const individual = rows.reduce((s, r) => s + indiv(r), 0) + staff.reduce((s, x) => s + x.discount, 0)
    const otros = general - isr - imss + individual
    const neto = rows.reduce((s, r) => s + netOf(r), 0) + staff.reduce((s, x) => s + netStaff(x), 0)
    return { bruto, isr, imss, otros, desc: general + individual, neto }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, staff, deductions, discounts, bonuses])

  const nextPay = periodStart ? fmtDate(new Date(periodEnd(period, periodStart).getTime() + 86400000)) : '—'

  function saveRow(r: PayrollRow) {
    startTransition(async () => {
      const res = await savePayrollRowAction(r.employeeId, periodStart, { discount: indiv(r), bonus: bonoOf(r) })
      if (res.success) toast.success('Guardado'); else toast.error(res.error ?? 'Error')
    })
  }
  function togglePaid(r: PayrollRow) {
    const paid = !r.paid
    setRows(rs => rs.map(x => x.employeeId === r.employeeId ? { ...x, paid } : x))
    startTransition(async () => { await savePayrollRowAction(r.employeeId, periodStart, { paid }) })
  }
  function setStaffField(id: string, patch: Partial<Staff>) { setStaff(st => st.map(s => s.id === id ? { ...s, ...patch } : s)) }
  function saveStaffRow(s: Staff) {
    startTransition(async () => {
      const r = await saveStaffAction(s.id, { days_worked: s.days_worked, discount: s.discount, bonus: s.bonus })
      if (r.success) toast.success('Guardado'); else toast.error(r.error ?? 'Error')
    })
  }
  function toggleStaffPaid(s: Staff) {
    const paid = !s.paid
    setStaffField(s.id, { paid })
    startTransition(async () => { await saveStaffAction(s.id, { paid }) })
  }

  // Descuentos generales
  function setDed(i: number, patch: Partial<PayrollDeduction>) { setDeductions(ds => ds.map((d, idx) => idx === i ? { ...d, ...patch } : d)) }
  function addDed(concept = '') { setDeductions(ds => [...ds, { id: '', concept, kind: 'percent', value: 0, description: null }]) }
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

  async function receipt(p: { name: string; periodo: string; days: number; absences: number; base: number; bonus: number; individual: number }) {
    if (!isPaid) { toast.error('El recibo individual está en planes de pago'); return }
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    const general = deductions.map(d => ({ c: d.concept, amt: d.kind === 'percent' ? p.base * (d.value || 0) / 100 : (d.value || 0) }))
    const totalGeneral = general.reduce((s, g) => s + g.amt, 0)
    const totalDesc = totalGeneral + p.individual
    const neto = Math.max(0, p.base + p.bonus - totalDesc)
    doc.setFontSize(16); doc.text('Recibo de nómina', 14, 18)
    doc.setFontSize(10); doc.setTextColor(90)
    doc.text(`Empleado: ${p.name}`, 14, 28)
    doc.text(`Periodo: ${p.periodo}`, 14, 34)
    doc.text(`Días trabajados: ${p.days}     Faltas: ${p.absences}`, 14, 40)
    autoTable(doc, {
      startY: 46, head: [['Concepto', 'Monto']],
      body: [
        ['Sueldo base', formatCurrency(p.base)],
        ['Bonos', formatCurrency(p.bonus)],
        ...general.map(g => [`Descuento: ${g.c}`, `-${formatCurrency(g.amt)}`]),
        ['Descuento individual', `-${formatCurrency(p.individual)}`],
        ['Total descuentos', `-${formatCurrency(totalDesc)}`],
      ],
      foot: [['Neto a pagar', formatCurrency(neto)]],
      styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [79, 70, 229] }, footStyles: { fillColor: [238, 242, 255], textColor: 40, fontStyle: 'bold' },
    })
    doc.save(`recibo-${p.name.replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const nomina = [
      ...rows.map(r => ({ Empleado: r.name ?? '', Tipo: 'Con acceso', Teléfono: r.phone ?? '', Emergencia: r.emergency ?? '', NSS: r.insurance ?? '', 'Días': r.daysPresent, Horas: fmtH(r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)), 'Pago base': r.base, Bonos: bonoOf(r), ISR: Math.round(isrFor(r.base) * 100) / 100, 'Seguro Social': Math.round(imssFor(r.base) * 100) / 100, Descuentos: indiv(r), 'Neto a pagar': Math.round(netOf(r) * 100) / 100, Estado: r.paid ? 'Pagado' : 'Pendiente' })),
      ...staff.map(s => ({ Empleado: s.name, Tipo: 'Registro', Teléfono: s.phone ?? '', Emergencia: s.emergency_phone ?? '', NSS: s.insurance_no ?? '', 'Días': s.days_worked, Horas: '—', 'Pago base': s.salary, Bonos: s.bonus, ISR: Math.round(isrFor(s.salary) * 100) / 100, 'Seguro Social': Math.round(imssFor(s.salary) * 100) / 100, Descuentos: s.discount, 'Neto a pagar': Math.round(netStaff(s) * 100) / 100, Estado: s.paid ? 'Pagado' : 'Pendiente' })),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nomina.length ? nomina : [{ Empleado: '' }]), 'Nómina')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((deductions.length ? deductions : [{ concept: '' } as PayrollDeduction]).map(d => ({ Concepto: d.concept, Tipo: d.kind === 'percent' ? 'Porcentaje' : 'Monto', Valor: d.kind === 'percent' ? `${d.value}%` : d.value }))), 'Descuentos')
    XLSX.writeFile(wb, `nomina-${periodLabel.toLowerCase()}-${periodStart}.xlsx`)
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF('l')
    doc.setFontSize(16); doc.text('Nómina', 14, 16)
    doc.setFontSize(10); doc.setTextColor(120); doc.text(`Periodo: ${periodLabel} · desde ${periodStart}`, 14, 23)
    autoTable(doc, {
      startY: 28, head: [['Empleado', 'Tipo', 'NSS', 'Días', 'Pago base', 'Bonos', 'ISR', 'Seg. Social', 'Desc.', 'Neto', 'Estado']],
      body: [
        ...rows.map(r => [r.name ?? '', 'Acceso', r.insurance ?? '—', r.daysPresent, formatCurrency(r.base), formatCurrency(bonoOf(r)), formatCurrency(isrFor(r.base)), formatCurrency(imssFor(r.base)), formatCurrency(indiv(r)), formatCurrency(netOf(r)), r.paid ? 'Pagado' : 'Pendiente']),
        ...staff.map(s => [s.name, 'Registro', s.insurance_no ?? '—', s.days_worked, formatCurrency(s.salary), formatCurrency(s.bonus), formatCurrency(isrFor(s.salary)), formatCurrency(imssFor(s.salary)), formatCurrency(s.discount), formatCurrency(netStaff(s)), s.paid ? 'Pagado' : 'Pendiente']),
      ],
      foot: [['Totales', '', '', '', formatCurrency(totals.bruto), '', formatCurrency(totals.isr), formatCurrency(totals.imss), '', formatCurrency(totals.neto), '']],
      styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [79, 70, 229] }, footStyles: { fillColor: [238, 242, 255], textColor: 40, fontStyle: 'bold' },
    })
    doc.save(`nomina-${periodLabel.toLowerCase()}-${periodStart}.pdf`)
  }

  const kpiCards = [
    { icon: Users, label: 'Empleados activos', value: String(kpis.total), tint: 'from-indigo-500 to-violet-600' },
    { icon: UserCheck, label: 'Presentes hoy', value: String(kpis.present), tint: 'from-emerald-500 to-green-600' },
    { icon: Clock4, label: 'Horas trabajadas', value: fmtH(kpis.hoursToday), tint: 'from-sky-500 to-blue-600' },
    { icon: Wallet, label: 'Nómina pendiente', value: formatCurrency(kpis.pendiente), tint: 'from-rose-500 to-pink-600' },
    { icon: TrendingUp, label: 'Asistencia semanal', value: `${kpis.attPct}%`, tint: 'from-amber-500 to-orange-600' },
  ]

  const estadoChip = (paid: boolean, onClick: () => void) => (
    <button onClick={onClick} className={`text-[10px] font-semibold rounded-full px-2 py-1 transition-colors ${paid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
      {paid ? 'Pagado' : 'Pendiente'}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Bento: crear + KPIs + Periodo de Pago */}
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
          {/* Periodo de Pago (reemplaza la tarjeta Cartocena) */}
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/50 shadow-sm p-3.5 col-span-2 sm:col-span-1">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-2"><CalendarClock size={17} className="text-white" /></span>
            <p className="text-[11px] text-violet-700/80 font-medium mb-1">Periodo de pago</p>
            <select value={period} onChange={e => setPeriod(e.target.value as PayrollPeriod)} className="w-full h-8 text-xs font-semibold text-violet-700 border border-violet-200 rounded-lg px-1.5 bg-white">
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-[10px] text-violet-700/70 mt-1.5">Próximo pago: <span className="font-semibold">{nextPay}</span></p>
          </div>
        </div>
      </div>

      {/* Tabla de nómina */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Wallet size={16} className="text-indigo-600" /> Nómina · {periodLabel}</p>
          <div className="flex items-center gap-2">
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
            <table className="w-full text-sm min-w-[1700px] border-separate border-spacing-0">
              <thead className="bg-indigo-50 text-indigo-900 text-xs">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-indigo-50 z-20 border-b border-indigo-100">Empleado</th>
                  {['Teléfono', 'Emergencia', 'NSS', 'Entrada', 'Salida', 'Horas'].map(h => <th key={h} className="text-left px-2 py-2.5 font-semibold border-b border-indigo-100 whitespace-nowrap">{h}</th>)}
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Días (L-D)</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100">Pago base</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Bonos</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100">ISR</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100 whitespace-nowrap">Seg. Social</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Descuentos</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100">Neto</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Estado</th>
                  <th className="text-center px-3 py-2.5 font-semibold border-b border-indigo-100">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const dayMap = new Map(r.days.map(d => [d.date, d]))
                  const hours = r.days.reduce((a, d) => a + hoursOf(d.checkIn, d.checkOut), 0)
                  const present = r.days.filter(d => d.checkIn); const last = present[present.length - 1]
                  return (
                    <tr key={r.employeeId} onClick={() => setEditing({ id: r.employeeId, name: r.name ?? 'Empleado', discount: indiv(r) })} className="group bg-white hover:bg-indigo-50/30 cursor-pointer">
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
                      <td className="px-2 py-2 text-right border-b border-gray-100 whitespace-nowrap">{formatCurrency(r.base)}</td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <Input type="number" min="0" value={bonuses[r.employeeId] ?? '0'} onChange={e => setBonuses(b => ({ ...b, [r.employeeId]: e.target.value }))} className="w-20 h-8 text-right text-xs mx-auto" />
                      </td>
                      <td className="px-2 py-2 text-right text-rose-600 border-b border-gray-100 whitespace-nowrap">{isrFor(r.base) > 0 ? `-${formatCurrency(isrFor(r.base))}` : '—'}</td>
                      <td className="px-2 py-2 text-right text-rose-600 border-b border-gray-100 whitespace-nowrap">{imssFor(r.base) > 0 ? `-${formatCurrency(imssFor(r.base))}` : '—'}</td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Input type="number" min="0" value={discounts[r.employeeId] ?? '0'} onChange={e => setDiscounts(d => ({ ...d, [r.employeeId]: e.target.value }))} className="w-20 h-8 text-right text-xs" />
                          <button onClick={() => saveRow(r)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={14} /></button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-gray-900 border-b border-gray-100 whitespace-nowrap">{formatCurrency(netOf(r))}</td>
                      <td className="px-2 py-2 text-center border-b border-gray-100" onClick={e => e.stopPropagation()}>{estadoChip(r.paid, () => togglePaid(r))}</td>
                      <td className="px-3 py-2 text-center border-b border-gray-100 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => receipt({ name: r.name ?? 'Empleado', periodo: periodLabel, days: r.daysPresent, absences: 0, base: r.base, bonus: bonoOf(r), individual: indiv(r) })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50" title="Recibo PDF"><ReceiptText size={15} /></button>
                        <button onClick={() => setEditing({ id: r.employeeId, name: r.name ?? 'Empleado', discount: indiv(r) })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
                {staff.map(s => (
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
                    <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                    <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                    <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                    <td className="px-2 py-2 text-center border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-center">
                        <Input type="number" min="0" value={s.days_worked} onChange={e => setStaffField(s.id, { days_worked: parseInt(e.target.value) || 0 })} className="w-14 h-8 text-center text-xs" />
                        <button onClick={() => saveStaffRow(s)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={13} /></button>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right border-b border-gray-100 whitespace-nowrap">{formatCurrency(s.salary)}</td>
                    <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <Input type="number" min="0" value={s.bonus} onChange={e => setStaffField(s.id, { bonus: parseFloat(e.target.value) || 0 })} className="w-20 h-8 text-right text-xs mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-right text-rose-600 border-b border-gray-100 whitespace-nowrap">{isrFor(s.salary) > 0 ? `-${formatCurrency(isrFor(s.salary))}` : '—'}</td>
                    <td className="px-2 py-2 text-right text-rose-600 border-b border-gray-100 whitespace-nowrap">{imssFor(s.salary) > 0 ? `-${formatCurrency(imssFor(s.salary))}` : '—'}</td>
                    <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-center">
                        <Input type="number" min="0" value={s.discount} onChange={e => setStaffField(s.id, { discount: parseFloat(e.target.value) || 0 })} className="w-20 h-8 text-right text-xs" />
                        <button onClick={() => saveStaffRow(s)} disabled={isPending} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar"><Save size={14} /></button>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-gray-900 border-b border-gray-100 whitespace-nowrap">{formatCurrency(netStaff(s))}</td>
                    <td className="px-2 py-2 text-center border-b border-gray-100" onClick={e => e.stopPropagation()}>{estadoChip(s.paid, () => toggleStaffPaid(s))}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => receipt({ name: s.name, periodo: 'Manual', days: s.days_worked, absences: s.absences, base: s.salary, bonus: s.bonus, individual: s.discount })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50" title="Recibo PDF"><ReceiptText size={15} /></button>
                      <button onClick={() => setEditingStaff(s)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50/70 font-semibold text-gray-800">
                  <td className="px-3 py-2.5 sticky left-0 bg-indigo-50 z-10" colSpan={8}>Totales · {totalCount} empleado(s)</td>
                  <td className="px-2 py-2.5 text-right">{formatCurrency(totals.bruto)}</td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right text-rose-600">-{formatCurrency(totals.isr)}</td>
                  <td className="px-2 py-2.5 text-right text-rose-600">-{formatCurrency(totals.imss)}</td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right text-indigo-700">{formatCurrency(totals.neto)}</td>
                  <td className="px-2 py-2.5" /><td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Descuentos generales + Resumen */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Receipt size={16} className="text-indigo-600" /> Descuentos generales</p>
            <button onClick={() => addDed()} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><Plus size={14} /> Agregar</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_DED.map(c => (
              <button key={c} onClick={() => addDed(c)} className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600">+ {c}</button>
            ))}
          </div>
          {deductions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin descuentos generales. Usa los botones de arriba (ISR, Seguro Social, Infonavit…).</p>
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
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><BadgeDollarSign size={16} className="text-indigo-600" /> Resumen de nómina</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Total bruto (sueldo + bonos)</span><span className="font-semibold text-gray-900">{formatCurrency(totals.bruto)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Total ISR</span><span className="font-medium text-rose-600">-{formatCurrency(totals.isr)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Total Seguro Social</span><span className="font-medium text-rose-600">-{formatCurrency(totals.imss)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Otros descuentos</span><span className="font-medium text-rose-600">-{formatCurrency(totals.otros)}</span></div>
            <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2"><span className="text-gray-500">Total descuentos</span><span className="font-medium text-rose-600">-{formatCurrency(totals.desc)}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2.5 mt-1"><span className="text-sm font-semibold text-indigo-900">Total neto a pagar</span><span className="text-lg font-bold text-indigo-700">{formatCurrency(totals.neto)}</span></div>
          </div>
        </div>
      </div>

      {/* Cartocena (fondo del equipo) */}
      <div className="grid sm:grid-cols-3 gap-4">
        <CartocenaWidget names={names} totalCount={totalCount} />
      </div>

      {editing && <EmployeeEditModal employeeId={editing.id} employeeName={editing.name} periodStart={periodStart} initialDiscount={editing.discount} onClose={() => setEditing(null)} onSaved={() => refresh(period)} />}
      {editingStaff && <StaffEditModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSaved={() => refresh(period)} />}
    </div>
  )
}
