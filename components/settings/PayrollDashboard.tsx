'use client'

import { useEffect, useMemo, useState, useTransition, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Wallet, Loader2, FileSpreadsheet, FileText, Save, Plus, Trash2, Check, X,
  Users, UserCheck, Clock4, TrendingUp, Receipt, Pencil, ReceiptText, CalendarClock, BadgeDollarSign,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getPayrollAction, savePayrollRowAction, getPayrollCycleAction, savePayrollCycleAction,
  getDeductionsAction, saveDeductionAction, deleteDeductionAction, saveEmployeeSalaryAction,
  type PayrollRow, type PayrollPeriod, type PayrollDeduction,
} from '@/lib/actions/payroll'
import { setEmployeeDayAction, setEmployeeDayTimesAction } from '@/lib/actions/attendance'
import { listStaffAction, saveStaffAction, type Staff } from '@/lib/actions/staff'
import { formatCurrency } from '@/lib/utils/format'
import EmployeeEditModal from './EmployeeEditModal'
import StaffEditModal from './StaffEditModal'
import { useBossGate } from './BossGate'

const PERIODS: { id: PayrollPeriod; label: string }[] = [
  { id: 'week', label: 'Semanal' }, { id: 'biweekly', label: 'Catorcenal' },
  { id: 'fortnight', label: 'Quincenal' }, { id: 'month', label: 'Mensual' },
  { id: 'custom', label: 'Personalizado' },
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
function periodEnd(period: PayrollPeriod, startISO: string, cycleDays = 7): Date {
  const s = new Date(startISO + 'T00:00:00')
  if (period === 'custom') { const e = new Date(s); e.setDate(s.getDate() + Math.max(1, cycleDays) - 1); return e }
  if (period === 'biweekly') { const e = new Date(s); e.setDate(s.getDate() + 13); return e }
  if (period === 'week') { const e = new Date(s); e.setDate(s.getDate() + 6); return e }
  if (period === 'fortnight') return s.getDate() === 1 ? new Date(s.getFullYear(), s.getMonth(), 15) : new Date(s.getFullYear(), s.getMonth() + 1, 0)
  return new Date(s.getFullYear(), s.getMonth() + 1, 0)
}
function hoursOf(ci: string | null, co: string | null): number {
  if (!ci || !co) return 0
  const h = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000
  return h > 0 && h < 24 ? h : 0
}
const fmtH = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${pad(m % 60)}m` }
function formatDayShort(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
  } catch { return iso.slice(5) }
}

type DayStatus = 'present' | 'justified' | 'unpaid' | 'absent' | 'none'
function getDayStatus(d: { checkIn: string | null; note: string | null } | undefined): DayStatus {
  if (!d) return 'none'
  if (d.checkIn) return 'present'
  const n = (d.note || '').toLowerCase()
  if (n.includes('justific')) return 'justified'
  if (n.includes('permiso') || n.includes('sin goce')) return 'unpaid'
  return 'absent'
}
const DAY_COLORS: Record<DayStatus, string> = {
  present: 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-300',
  justified: 'bg-blue-100 text-blue-600 ring-1 ring-blue-300',
  unpaid: 'bg-violet-100 text-violet-700 ring-1 ring-violet-300', // morado
  absent: 'bg-red-100 text-red-600 ring-1 ring-red-300',
  none: 'bg-gray-100 text-gray-400'
}
const DAY_COLOR_NAME: Record<DayStatus, string> = {
  present: 'verde',
  justified: 'azul',
  unpaid: 'morado',
  absent: 'rojo',
  none: 'blanco'
}
const DAY_ICON = (s: DayStatus) => s === 'present' ? <Check size={10} /> : s === 'justified' ? <Check size={9} /> : s === 'unpaid' ? 'P' : s === 'absent' ? <X size={10} /> : '·'

export default function PayrollDashboard({ createSlot, refreshSignal = 0, isPaid = true, compact = false }: { createSlot?: ReactNode; refreshSignal?: number; isPaid?: boolean; compact?: boolean }) {
  const [period, setPeriod] = useState<PayrollPeriod>('week')
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [cycleDays, setCycleDays] = useState(7)
  const [cycleAnchor, setCycleAnchor] = useState('')
  const [workWeekStart, setWorkWeekStart] = useState(0) // 0=Lun ... 6=Dom
  const [workWeekEnd, setWorkWeekEnd] = useState(4)
  const [payDay, setPayDay] = useState('friday')
  const [discounts, setDiscounts] = useState<Record<string, string>>({})
  const [bonuses, setBonuses] = useState<Record<string, string>>({})
  const [bases, setBases] = useState<Record<string, string>>({})
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([])
  // Per-row overrides for general deductions (editable individually per employee row)
  const [generalOverrides, setGeneralOverrides] = useState<Record<string, Record<string, string>>>({}) // empId -> (dedId|concept) -> amount str
  const [hoursOverrides, setHoursOverrides] = useState<Record<string, string>>({})
  const [staffDayStatuses, setStaffDayStatuses] = useState<Record<string, Record<string, DayStatus>>>({}) // staffId -> date -> status for individual colors
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<{ id: string; name: string; discount: number } | null>(null)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [daySelector, setDaySelector] = useState<{ empId: string; date: string } | null>(null)
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')
  const { requireUnlock, gate } = useBossGate()

  // Reset per-row edits when changing historical period
  useEffect(() => {
    setGeneralOverrides({})
    setHoursOverrides({})
    setStaffDayStatuses({})
    setDiscounts({})
    setBonuses({})
    setBases({})
  }, [period])

  useEffect(() => {
    if (!daySelector) { setTimeIn(''); setTimeOut(''); return }
    // try to find current times from data
    const empRow = rows.find(r => r.employeeId === daySelector.empId)
    if (empRow) {
      const d = empRow.days.find(dd => dd.date === daySelector.date)
      if (d) {
        setTimeIn(d.checkIn ? d.checkIn.slice(11,16) : '')
        setTimeOut(d.checkOut ? d.checkOut.slice(11,16) : '')
      }
    }
  }, [daySelector, rows])

  const refresh = useCallback(async (p: PayrollPeriod, days?: number, anchor?: string) => {
    setLoading(true)
    const [res, ded, st] = await Promise.all([getPayrollAction(p, days, anchor || null), getDeductionsAction(), listStaffAction()])
    setRows(res.rows); setPeriodStart(res.periodStart); setDeductions(ded); setStaff(st)
    const d: Record<string, string> = {}, b: Record<string, string> = {}, bs: Record<string, string> = {}
    res.rows.forEach(r => { d[r.employeeId] = String(r.discount || 0); b[r.employeeId] = String(r.bonus || 0); bs[r.employeeId] = String(r.base || 0) })
    setDiscounts(d); setBonuses(b); setBases(bs); setLoading(false)
  }, [])
  // Carga el ciclo personalizado guardado (cada N días + fecha ancla + semana lab + día pago)
  useEffect(() => { getPayrollCycleAction().then(c => {
    setCycleDays(c.days); setCycleAnchor(c.anchor || '')
    setWorkWeekStart(c.workWeekStart ?? 0); setWorkWeekEnd(c.workWeekEnd ?? 4); setPayDay(c.payDay || 'friday')
  }) }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(period, cycleDays, cycleAnchor) }, [period, refresh, refreshSignal])

  function saveCycle() {
    startTransition(async () => {
      const r = await savePayrollCycleAction(cycleDays, cycleAnchor || null, workWeekStart, workWeekEnd, payDay)
      if (r.success) { toast.success('Config de periodo guardada'); refresh('custom', cycleDays, cycleAnchor) }
      else toast.error(r.error ?? 'Error')
    })
  }

  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? ''
  const week = useMemo(() => {
    if (periodStart) {
      const start = new Date(periodStart + 'T00:00:00')
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return toISO(d)
      })
    }
    return thisWeekDates()
  }, [periodStart])
  const today = toISO(new Date())

  const isrDed = deductions.find(d => /isr/i.test(d.concept))
  const imssDed = deductions.find(d => /seguro|imss|social/i.test(d.concept))
  const amtOf = (ded: PayrollDeduction | undefined, base: number) => ded ? (ded.kind === 'percent' ? base * (ded.value || 0) / 100 : (ded.value || 0)) : 0
  const generalFor = useCallback((base: number) =>
    deductions.reduce((s, d) => s + (d.kind === 'percent' ? base * (d.value || 0) / 100 : (d.value || 0)), 0), [deductions])
  const isrFor = (base: number) => amtOf(isrDed, base)
  const imssFor = (base: number) => amtOf(imssDed, base)

  const baseOf = (r: PayrollRow) => parseFloat(bases[r.employeeId] ?? String(r.base)) || r.base
  const indiv = (r: PayrollRow) => parseFloat(discounts[r.employeeId] ?? '0') || 0
  const bonoOf = (r: PayrollRow) => parseFloat(bonuses[r.employeeId] ?? '0') || 0
  const getRowGeneral = (empId: string, base: number) => {
    const ov = generalOverrides[empId] || {}
    return deductions.reduce((s, d) => {
      const key = d.id || d.concept
      if (ov[key] !== undefined) return s + (parseFloat(ov[key]) || 0)
      return s + amtOf(d, base)
    }, 0)
  }

  // Optimistic local updates for day changes - no full page reload
  function updateLocalAttendance(empId: string, date: string, status: DayStatus) {
    setRows(prev => prev.map(r => {
      if (r.employeeId !== empId) return r
      if (status === 'none') {
        // sin registro / blanco: remove the day entry
        const filteredDays = r.days.filter(d => d.date !== date)
        const newPresent = filteredDays.filter(d => !!d.checkIn).length
        return { ...r, days: filteredDays, daysPresent: newPresent }
      }
      const newCheckIn = status === 'present' ? `${date}T09:00:00` : null
      const newNote = status === 'justified' ? 'Falta justificada' : status === 'unpaid' ? 'Permiso sin goce' : null
      let updatedDays = r.days.map(d => d.date === date ? { ...d, checkIn: newCheckIn, checkOut: status === 'present' ? d.checkOut : null, note: newNote } : d)
      if (!updatedDays.some(d => d.date === date)) {
        updatedDays = [...updatedDays, { date, checkIn: newCheckIn, checkOut: null, note: newNote }].sort((a,b) => a.date.localeCompare(b.date))
      }
      const newPresent = updatedDays.filter(d => !!d.checkIn).length
      return { ...r, days: updatedDays, daysPresent: newPresent }
    }))
  }

  function updateLocalTimes(empId: string, date: string, ci: string | null, co: string | null) {
    setRows(prev => prev.map(r => {
      if (r.employeeId !== empId) return r
      const newCI = ci ? `${date}T${ci}:00` : null
      const newCO = co ? `${date}T${co}:00` : null
      const updatedDays = r.days.map(d => d.date === date ? { ...d, checkIn: newCI, checkOut: newCO } : d)
      const newPresent = updatedDays.filter(d => !!d.checkIn).length
      return { ...r, days: updatedDays, daysPresent: newPresent }
    }))
  }
  const netOf = (r: PayrollRow) => Math.max(0, baseOf(r) + bonoOf(r) - getRowGeneral(r.employeeId, baseOf(r)) - indiv(r))
  const netStaff = (s: Staff) => Math.max(0, s.salary + s.bonus - generalFor(s.salary) - s.discount)
  const totalCount = rows.length + staff.length

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
    const bruto = rows.reduce((s, r) => s + baseOf(r) + bonoOf(r), 0) + staff.reduce((s, x) => s + x.salary + x.bonus, 0)
    const isr = rows.reduce((s, r) => s + isrFor(baseOf(r)), 0) + staff.reduce((s, x) => s + isrFor(x.salary), 0)
    const imss = rows.reduce((s, r) => s + imssFor(baseOf(r)), 0) + staff.reduce((s, x) => s + imssFor(x.salary), 0)
    const general = rows.reduce((s, r) => s + getRowGeneral(r.employeeId, baseOf(r)), 0) + staff.reduce((s, x) => s + generalFor(x.salary), 0)
    const individual = rows.reduce((s, r) => s + indiv(r), 0) + staff.reduce((s, x) => s + x.discount, 0)
    const otros = general - isr - imss + individual
    const otros_gen = general - isr - imss
    const neto = rows.reduce((s, r) => s + netOf(r), 0) + staff.reduce((s, x) => s + netStaff(x), 0)
    return { bruto, isr, imss, otros, otros_gen, individual, desc: general + individual, neto }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, staff, deductions, discounts, bonuses, bases])

  const nextPay = periodStart ? fmtDate(new Date(periodEnd(period, periodStart, cycleDays).getTime() + 86400000)) : '—'

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
      const r = await saveStaffAction(s.id, { salary: s.salary, days_worked: s.days_worked, discount: s.discount, bonus: s.bonus })
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

  async function exportAll() {
    // Por empleado: archivos individuales (no uno solo)
    for (const r of rows) {
      await exportOneForEmployee(r, true)
    }
    for (const s of staff) {
      await exportOneForEmployee(s, false)
    }
    toast.success('Archivos individuales por empleado generados')
  }

  async function exportOneForEmployee(item: PayrollRow | Staff, isEmp: boolean) {
    const name = isEmp ? (item.name ?? 'Empleado') : ((item as Staff).name || 'Empleado')
    const safe = name.replace(/\s+/g, '-').toLowerCase()
    // Excel individual
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const rowData = isEmp ? {
      Empleado: name, Tipo: 'Con acceso', Tel: (item as PayrollRow).phone ?? '', 'Días': (item as PayrollRow).daysPresent, Base: (item as PayrollRow).base, Bono: parseFloat(bonuses[(item as PayrollRow).employeeId]??'0')||0 , Neto: Math.round(netOf(item as PayrollRow)*100)/100, Estado: (item as PayrollRow).paid ? 'Pagado':'Pendiente'
    } : {
      Empleado: name, Tipo: 'Registro', Tel: (item as Staff).phone ?? '', 'Días': (item as Staff).days_worked, Base: (item as Staff).salary, Bono: (item as Staff).bonus, Neto: Math.round(netStaff(item as Staff)*100)/100, Estado: (item as Staff).paid ? 'Pagado':'Pendiente'
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([rowData]), 'Nómina')
    XLSX.writeFile(wb, `nomina-${safe}-${periodLabel.toLowerCase()}-${periodStart}.xlsx`)
    // PDF individual
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text(`Nómina - ${name}`, 14, 16)
    doc.setFontSize(10); doc.text(`Periodo: ${periodLabel} · ${periodStart}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [['Concepto', 'Valor']],
      body: [
        ['Días', isEmp ? (item as PayrollRow).daysPresent : (item as Staff).days_worked],
        ['Base', formatCurrency(isEmp ? (item as PayrollRow).base : (item as Staff).salary)],
        ['Bono', formatCurrency(isEmp ? (parseFloat(bonuses[(item as PayrollRow).employeeId]??'0')||0) : (item as Staff).bonus)],
        ['Neto', formatCurrency(isEmp ? netOf(item as PayrollRow) : netStaff(item as Staff))],
        ['Estado', isEmp ? ((item as PayrollRow).paid?'Pagado':'Pendiente') : ((item as Staff).paid?'Pagado':'Pendiente')],
      ],
      styles: { fontSize: 9 }
    })
    doc.save(`nomina-${safe}-${periodLabel.toLowerCase()}-${periodStart}.pdf`)
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
          {/* Periodo de Pago */}
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/50 shadow-sm p-3.5 col-span-2 sm:col-span-1">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-2"><CalendarClock size={17} className="text-white" /></span>
            <p className="text-[11px] text-violet-700/80 font-medium mb-1">Periodo de pago</p>
            <select value={period} onChange={e => setPeriod(e.target.value as PayrollPeriod)} className="w-full h-8 text-xs font-semibold text-violet-700 border border-violet-200 rounded-lg px-1.5 bg-white">
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {period === 'custom' && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-violet-700/70">Cada</span>
                  <input type="number" min="1" value={cycleDays} onChange={e => setCycleDays(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 h-7 text-xs text-center border border-violet-200 rounded-md bg-white" />
                  <span className="text-[10px] text-violet-700/70">días, desde:</span>
                </div>
                <input type="date" value={cycleAnchor} onChange={e => setCycleAnchor(e.target.value)} className="w-full h-7 text-xs border border-violet-200 rounded-md px-1 bg-white" />
              </div>
            )}
            {/* Config editable de semana laboral y día de pago (jefe) */}
            <div className="mt-1.5 pt-1 border-t border-violet-200/60 space-y-1 text-[9px]">
              <div className="flex items-center gap-1 text-violet-700/80">
                <span>Lab:</span>
                <select value={workWeekStart} onChange={e => { const v = parseInt(e.target.value); setWorkWeekStart(v); if (workWeekEnd < v) setWorkWeekEnd(v); }} className="h-5 text-[9px] border border-violet-200 rounded px-0.5 bg-white">
                  {WD.map((w,i)=> <option key={i} value={i}>{w}</option>)}
                </select>
                <span>-</span>
                <select value={workWeekEnd} onChange={e => setWorkWeekEnd(parseInt(e.target.value))} className="h-5 text-[9px] border border-violet-200 rounded px-0.5 bg-white">
                  {WD.map((w,i)=> <option key={i} value={i}>{w}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-violet-700/80">Pago:</span>
                <input value={payDay} onChange={e=>setPayDay(e.target.value)} onBlur={saveCycle} className="w-16 h-5 text-[9px] border border-violet-200 rounded px-1 bg-white" placeholder="friday / 15" />
                <button type="button" onClick={saveCycle} disabled={isPending} className="text-[8px] px-1.5 py-0 bg-violet-600 text-white rounded">Guardar</button>
              </div>
            </div>
            <p className="text-[10px] text-violet-700/70 mt-1">Próximo: <span className="font-semibold">{nextPay}</span></p>
          </div>
        </div>
      </div>

      {/* Tabla de nómina */}
      <div className="rounded-2xl border border-gray-100 bg-white/80 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Wallet size={16} className="text-indigo-600" /> Nómina · {periodLabel} <span className="ml-2 text-[10px] font-normal text-gray-400">(edita sueldo/bonos/desc. — guarda al salir del campo)</span></p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => requireUnlock(exportExcel)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-sm"><FileSpreadsheet size={14} /> Excel</button>
            <button onClick={() => requireUnlock(exportPDF)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm"><FileText size={14} /> PDF</button>
            <button onClick={() => requireUnlock(exportAll)} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-amber-300 bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 shadow-sm" title="Excel + PDF con datos completos y descuentos"><FileSpreadsheet size={13} />+<FileText size={13} /> Todas</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
        ) : totalCount === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin empleados para la nómina.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1920px] border-separate border-spacing-0">
              <thead className="bg-indigo-50 text-indigo-900 text-xs">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-indigo-50 z-20 border-b border-indigo-100">Empleado</th>
                  {['Teléfono', 'Emergencia', 'NSS', 'Sucursal', 'Entrada', 'Salida', 'Horas'].map(h => <th key={h} className="text-left px-1 py-2.5 font-semibold border-b border-indigo-100 whitespace-nowrap">{h}</th>)}
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Días (L-D)</th>
                  <th className="text-right px-2 py-2.5 font-semibold border-b border-indigo-100">Pago base</th>
                  <th className="text-center px-2 py-2.5 font-semibold border-b border-indigo-100">Bonos</th>
                  {deductions.map((d, idx) => (
                    <th key={d.id || idx} className="text-center px-1 py-1 font-semibold border-b border-indigo-100 text-[8px] leading-none" title={d.concept}>
                      <div className="flex flex-col items-center">
                        <span className="truncate max-w-[42px]">{d.concept.length > 7 ? d.concept.slice(0,6) : d.concept}</span>
                        <input
                          type="number" min="0" step="0.1"
                          value={d.value}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            setDeductions(ds => ds.map((dd, i) => i===idx ? {...dd, value: val} : dd))
                          }}
                          onBlur={() => saveDed(idx)}
                          onClick={e=>e.stopPropagation()}
                          className="w-12 h-5 text-[9px] text-center border border-violet-300 rounded bg-white mt-0.5"
                          title={`Editar ${d.concept}`}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="text-left px-2 py-2.5 font-semibold border-b border-indigo-100">Notas</th>
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
                    <tr key={r.employeeId} onClick={() => setEditing({ id: r.employeeId, name: r.name ?? 'Empleado', discount: indiv(r) })} className="group bg-white/90 hover:bg-indigo-50/30 cursor-pointer">
                      <td className="px-3 py-2 sticky left-0 bg-white group-hover:bg-indigo-50/30 z-10 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{(r.name || '?').charAt(0).toUpperCase()}</span>
                          <span className="font-medium text-gray-900 whitespace-nowrap">{r.name ?? 'Empleado'}</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 rounded px-1 py-0.5">Acceso</span>
                        </div>
                      </td>
                      <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.phone ?? '—'}</td>
                      <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.emergency ?? '—'}</td>
                      <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.insurance ?? '—'}</td>
                      <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{r.branch ?? '—'}</td>
                      <td className="px-1 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap">{fmtTime(last?.checkIn ?? null)}</td>
                      <td className="px-1 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap">{fmtTime(last?.checkOut ?? null)}</td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={hoursOverrides[r.employeeId] ?? hours.toFixed(1)}
                          onChange={e => setHoursOverrides(h => ({...h, [r.employeeId]: e.target.value }))}
                          className="w-20 h-6 text-right text-xs border border-gray-200 focus:border-indigo-400 rounded"
                        />
                      </td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {week.map((date, i) => {
                            const d = dayMap.get(date)
                            const status = getDayStatus(d)
                            const late = status === 'present' && (d?.note || '').toLowerCase().includes('tarde')
                            const cls = late ? 'bg-amber-100 text-amber-600' : DAY_COLORS[status]
                            const icon = late ? <Clock4 size={10} /> : DAY_ICON(status)
                            return (
                              <span
                                key={date}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDaySelector({ empId: r.employeeId, date })
                                }}
                                title={`${formatDayShort(date)} (${WD[i]}) — ${DAY_COLOR_NAME[status]}`}
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] cursor-pointer select-none hover:scale-110 transition-all ${cls}`}
                              >{icon}</span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <Input type="number" min="0" step="0.01"
                          value={bases[r.employeeId] ?? String(r.base)}
                          onChange={e => setBases(b => ({ ...b, [r.employeeId]: e.target.value }))}
                          onBlur={() => {
                            const newBase = parseFloat(bases[r.employeeId] ?? '0') || 0
                            if (Math.abs(newBase - r.base) > 0.01) {
                              startTransition(() => saveEmployeeSalaryAction(r.employeeId, newBase)
                                .then(res => { if (!res.success) toast.error(res.error ?? 'Error al guardar salario') }))
                            }
                          }}
                          className="w-28 h-7 text-right text-xs border border-gray-200 focus:border-indigo-400 rounded" />
                      </td>
                      <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                        <Input type="number" min="0" value={bonuses[r.employeeId] ?? '0'} onChange={e => setBonuses(b => ({ ...b, [r.employeeId]: e.target.value }))} onBlur={() => saveRow(r)} className="w-20 h-7 text-right text-xs mx-auto border border-gray-200 focus:border-indigo-400 rounded" />
                      </td>
                      {deductions.map((d, idx) => {
                        const key = d.id || d.concept
                        const ov = generalOverrides[r.employeeId]?.[key]
                        const amtStr = ov !== undefined ? ov : String(amtOf(d, baseOf(r)))
                        return (
                          <td key={d.id || idx} className="px-1 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={amtStr}
                              onChange={e => {
                                const v = e.target.value
                                setGeneralOverrides(prev => ({
                                  ...prev,
                                  [r.employeeId]: { ...(prev[r.employeeId] || {}), [key]: v }
                                }))
                              }}
                              onBlur={() => {
                                // adjust individual discount to keep net consistent with the edited general amt (persist via indiv)
                                const newGenAmt = parseFloat(amtStr) || 0
                                const origGen = amtOf(d, baseOf(r))
                                const delta = newGenAmt - origGen
                                const newInd = (parseFloat(discounts[r.employeeId] ?? '0') || 0) + delta
                                setDiscounts(dd => ({ ...dd, [r.employeeId]: String(Math.max(0, newInd)) }))
                                // trigger save for the row
                                saveRow(r)
                              }}
                              className="w-18 h-6 text-right text-[10px] border border-violet-200 focus:border-violet-400 rounded"
                            />
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-gray-500 border-b border-gray-100 max-w-[120px]"><span className="line-clamp-1" title={r.notes || ''}>{r.notes || '—'}</span></td>
                      <td className="px-2 py-2 text-right font-bold text-gray-900 border-b border-gray-100 whitespace-nowrap"
                        title={`Base ${formatCurrency(baseOf(r))} + Bono ${formatCurrency(bonoOf(r))} - Desc.gen ${formatCurrency(getRowGeneral(r.employeeId, baseOf(r)))} - Indiv ${formatCurrency(indiv(r))} = ${formatCurrency(netOf(r))}`}>
                        {formatCurrency(netOf(r))}
                      </td>
                      <td className="px-2 py-2 text-center border-b border-gray-100" onClick={e => e.stopPropagation()}>{estadoChip(r.paid, () => togglePaid(r))}</td>
                      <td className="px-3 py-2 text-center border-b border-gray-100 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => receipt({ name: r.name ?? 'Empleado', periodo: periodLabel, days: r.daysPresent, absences: 0, base: r.base, bonus: bonoOf(r), individual: indiv(r) })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50" title="Recibo PDF"><ReceiptText size={15} /></button>
                        <button onClick={() => setEditing({ id: r.employeeId, name: r.name ?? 'Empleado', discount: indiv(r) })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
                {staff.map(s => (
                  <tr key={s.id} onClick={() => setEditingStaff(s)} className="group bg-slate-50/60 hover:bg-indigo-50/30 cursor-pointer">
                    <td className="px-3 py-2 sticky left-0 bg-slate-50 group-hover:bg-indigo-50/30 z-10 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{(s.name || '?').charAt(0).toUpperCase()}</span>
                        <span className="font-medium text-gray-900 whitespace-nowrap">{s.name}</span>
                        <span className="text-[9px] bg-slate-200 text-slate-600 rounded px-1 py-0.5">Registro</span>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.phone ?? '—'}</td>
                    <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.emergency_phone ?? '—'}</td>
                    <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.insurance_no ?? '—'}</td>
                    <td className="px-1 py-2 text-gray-500 border-b border-gray-100 whitespace-nowrap">{s.branch ?? '—'}</td>
                    <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                    <td className="px-2 py-2 text-gray-300 border-b border-gray-100">—</td>
                    <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <Input type="number" min="0" step="0.1" value={hoursOverrides[s.id] ?? '0'} onChange={e => setHoursOverrides(h => ({...h, [s.id]: e.target.value}))} className="w-18 h-6 text-right text-xs border border-gray-200 focus:border-indigo-400 rounded" />
                    </td>
                    <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {week.map((date, i) => {
                          const defaultStatus = i < s.days_worked ? 'present' : 'none'
                          const status = staffDayStatuses[s.id]?.[date] || defaultStatus
                          const cls = DAY_COLORS[status]
                          const icon = DAY_ICON(status)
                          return (
                            <span key={i}
                              onClick={() => {
                                setDaySelector({ empId: s.id, date: week[i] })
                              }}
                              title={`${WD[i]} — ${DAY_COLOR_NAME[status]}`}
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] cursor-pointer select-none transition-colors ${cls}`}>
                              {icon}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <Input type="number" min="0" step="0.01" value={s.salary} onChange={e => setStaffField(s.id, { salary: parseFloat(e.target.value) || 0 })} onBlur={() => saveStaffRow(s)} className="w-28 h-7 text-right text-xs border border-gray-200 focus:border-indigo-400 rounded" />
                    </td>
                    <td className="px-2 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <Input type="number" min="0" value={s.bonus} onChange={e => setStaffField(s.id, { bonus: parseFloat(e.target.value) || 0 })} onBlur={() => saveStaffRow(s)} className="w-20 h-7 text-right text-xs border border-gray-200 focus:border-indigo-400 rounded" />
                    </td>
                    {deductions.map((d, idx) => {
                      const key = d.id || d.concept
                      const ov = generalOverrides[s.id]?.[key]
                      const amtStr = ov !== undefined ? ov : String(amtOf(d, s.salary))
                      return (
                        <td key={d.id || idx} className="px-1 py-2 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amtStr}
                            onChange={e => {
                              const v = e.target.value
                              setGeneralOverrides(prev => ({
                                ...prev,
                                [s.id]: { ...(prev[s.id] || {}), [key]: v }
                              }))
                            }}
                            onBlur={() => {
                              const newGenAmt = parseFloat(amtStr) || 0
                              const origGen = amtOf(d, s.salary)
                              const delta = newGenAmt - origGen
                              const newInd = (s.discount || 0) + delta
                              const updated = { ...s, discount: Math.max(0, newInd) }
                              setStaffField(s.id, { discount: updated.discount })
                              saveStaffRow(updated)
                            }}
                            className="w-18 h-6 text-right text-[10px] border border-violet-200 focus:border-violet-400 rounded"
                          />
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-gray-500 border-b border-gray-100 max-w-[120px]"><span className="line-clamp-1" title={s.note || ''}>{s.note || '—'}</span></td>
                    <td className="px-2 py-2 text-right font-bold text-gray-900 border-b border-gray-100 whitespace-nowrap"
                      title={`Base ${formatCurrency(s.salary)} + Bono ${formatCurrency(s.bonus)} - Desc.gen ${formatCurrency(generalFor(s.salary))} = ${formatCurrency(netStaff(s))}`}>
                      {formatCurrency(netStaff(s))}
                    </td>
                    <td className="px-2 py-2 text-center border-b border-gray-100" onClick={e => e.stopPropagation()}>{estadoChip(s.paid, () => toggleStaffPaid(s))}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => receipt({ name: s.name, periodo: 'Manual', days: s.days_worked, absences: s.absences, base: s.salary, bonus: s.bonus, individual: s.discount })} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50" title="Recibo PDF"><ReceiptText size={15} /></button>
                      <button onClick={() => setEditingStaff(s)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50/70 font-semibold text-gray-800 text-[5px]">
                  <td className="px-0 py-0 sticky left-0 bg-indigo-50 z-10" colSpan={9}>{totalCount}</td>
                  <td className="px-0 py-0 text-right text-gray-900">{formatCurrency(totals.bruto)}</td>
                  <td className="px-0 py-0" />
                  <td className="px-0 py-0 text-right text-rose-600">-{formatCurrency(totals.isr)}</td>
                  <td className="px-0 py-0 text-right text-rose-600">-{formatCurrency(totals.imss)}</td>
                  <td className="px-0 py-0 text-right text-orange-600">{totals.otros_gen > 0.005 ? `-${formatCurrency(totals.otros_gen)}` : '—'}</td>
                  <td className="px-0 py-0" />
                  <td className="px-0 py-0" />
                  <td className="px-0 py-0 text-right text-indigo-700 font-bold">{formatCurrency(totals.neto)}</td>
                  <td className="px-0 py-0" /><td className="px-0 py-0" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Descuentos generales + tira resumen compacta */}
      {!compact && (
      <div className="rounded-2xl border border-gray-100 bg-white/80 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Receipt size={16} className="text-indigo-600" /> Descuentos generales</p>
          <button onClick={() => addDed()} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><Plus size={14} /> Agregar</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DED.map(c => (
            <button key={c} onClick={() => addDed(c)} className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600">+ {c}</button>
          ))}
        </div>
        {deductions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Sin descuentos generales. Usa los botones de arriba (ISR, Seguro Social, Infonavit…).</p>
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

        {/* Tira resumen compacta - recortada más pequeña para no tapar números */}
        <div className="border-t border-gray-100 pt-0 flex flex-wrap items-center gap-0.5 text-[7px]">
          <BadgeDollarSign size={8} className="text-indigo-500 shrink-0" />
          {[
            { l: 'Bruto', v: formatCurrency(totals.bruto), cls: 'text-gray-900' },
            { l: 'ISR', v: `-${formatCurrency(totals.isr)}`, cls: 'text-rose-600' },
            { l: 'IMSS', v: `-${formatCurrency(totals.imss)}`, cls: 'text-rose-600' },
            ...(totals.otros_gen > 0.005 ? [{ l: 'Otros', v: `-${formatCurrency(totals.otros_gen)}`, cls: 'text-orange-500' }] : []),
          ].map((item, i) => (
            <span key={i} className="flex items-baseline gap-0.5 text-[7px]">
              <span className="text-gray-400">{item.l}:</span>
              <span className={`font-semibold ${item.cls}`}>{item.v}</span>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-0.5 rounded-lg bg-indigo-50 px-1 py-0">
            <span className="text-[7px] font-semibold text-indigo-900">Neto:</span>
            <span className="text-[9px] font-bold text-indigo-700">{formatCurrency(totals.neto)}</span>
          </span>
        </div>
      </div>
      )}

      {editing && <EmployeeEditModal employeeId={editing.id} employeeName={editing.name} periodStart={periodStart} initialDiscount={editing.discount} onClose={() => setEditing(null)} onSaved={() => refresh(period)} />}
      {editingStaff && <StaffEditModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSaved={() => refresh(period)} />}
      {gate}

      {/* Day type selector: solo colores, sin nombres + hora entrada/salida editable */}
      {daySelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDaySelector(null)}>
          <div className="bg-white rounded-xl shadow p-3 flex flex-col gap-2" onClick={e=>e.stopPropagation()}>
            <div className="flex gap-2">
              {[
                { t: 'present' as DayStatus, c: 'bg-emerald-500' },
                { t: 'absent' as DayStatus, c: 'bg-red-500' },
                { t: 'justified' as DayStatus, c: 'bg-blue-500' },
                { t: 'unpaid' as DayStatus, c: 'bg-violet-500' },
                { t: 'none' as DayStatus, c: 'bg-white border-2 border-gray-400' },
              ].map(opt => (
                <button
                  key={opt.t}
                  onClick={async () => {
                    const empId = daySelector.empId
                    const date = daySelector.date
                    const isLogueado = rows.some(r => r.employeeId === empId)
                    if (isLogueado) {
                      await setEmployeeDayAction(empId, date, opt.t as 'present' | 'absent' | 'justified' | 'unpaid' | 'none')
                      updateLocalAttendance(empId, date, opt.t)
                    } else {
                      // no logueado (staff/registro): set individual status for color + ajustar days_worked y guardar
                      setStaffDayStatuses(prev => ({
                        ...prev,
                        [empId]: { ...(prev[empId] || {}), [date]: opt.t }
                      }));
                      const stf = staff.find(s => s.id === empId)
                      if (stf) {
                        const idx = week.findIndex(d => d === date)
                        let newDw = stf.days_worked || 0
                        if (opt.t === 'present') newDw = Math.max(newDw, idx + 1)
                        else newDw = Math.min(newDw, idx)
                        const updated = { ...stf, days_worked: Math.max(0, newDw) }
                        setStaffField(empId, { days_worked: updated.days_worked })
                        saveStaffRow(updated)
                      }
                    }
                    setDaySelector(null)
                  }}
                  className={`w-8 h-8 rounded-full ${opt.c} border-2 border-white shadow hover:scale-110`}
                  title={DAY_COLOR_NAME[opt.t]}
                />
              ))}
            </div>
            <div className="text-xs">Hora entrada/salida (para el día):</div>
            <div className="flex gap-1 text-xs">
              <input type="time" value={timeIn} onChange={e=>setTimeIn(e.target.value)} onBlur={async () => {
                if (timeIn || timeOut) {
                  const empId = daySelector.empId
                  const date = daySelector.date
                  if (rows.some(r => r.employeeId === empId)) {
                    await setEmployeeDayTimesAction(empId, date, timeIn, timeOut)
                    updateLocalTimes(empId, date, timeIn, timeOut)
                  }
                }
              }} className="border rounded px-1" />
              <input type="time" value={timeOut} onChange={e=>setTimeOut(e.target.value)} onBlur={async () => {
                if (timeIn || timeOut) {
                  const empId = daySelector.empId
                  const date = daySelector.date
                  if (rows.some(r => r.employeeId === empId)) {
                    await setEmployeeDayTimesAction(empId, date, timeIn, timeOut)
                    updateLocalTimes(empId, date, timeIn, timeOut)
                  }
                }
              }} className="border rounded px-1" />
            </div>
            <button onClick={() => setDaySelector(null)} className="text-xs self-end px-2 py-0.5 border rounded">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
