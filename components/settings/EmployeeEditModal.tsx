'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Save, Trash2, Check, Shield, UserRound, CalendarClock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getEmployeeMeta, saveEmployeeMetaAction, deleteEmployeeAction, setEmployeeRoleAction, setEmployeeNameAction, type EmployeeMeta } from '@/lib/actions/employees'
import { savePayrollDiscountAction } from '@/lib/actions/payroll'
import { getEmployeeWeekAction, setEmployeeDayAction, setEmployeeDayTimesAction, type AttendanceRow, type DayState } from '@/lib/actions/attendance'
import { useBossGate } from './BossGate'

const EMPTY: EmployeeMeta = { phone: '', insurance_no: '', emergency_phone: '', branch: '', salary: null, rfc: '', position: '', hire_date: '', photo_url: '' }
const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function weekDates(): string[] {
  const now = new Date(); const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return toISO(d) })
}

interface Props {
  employeeId: string
  employeeName: string
  periodStart: string
  initialDiscount: number
  onClose: () => void
  onSaved: () => void
}

export default function EmployeeEditModal({ employeeId, employeeName, periodStart, initialDiscount, onClose, onSaved }: Props) {
  const [meta, setMeta] = useState<EmployeeMeta>(EMPTY)
  const [name, setName] = useState(employeeName)
  const [discount, setDiscount] = useState(String(initialDiscount || 0))
  const [week, setWeek] = useState<AttendanceRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { requireUnlock, gate } = useBossGate()
  const days = useMemo(() => weekDates(), [])
  const [daySel, setDaySel] = useState(days[0])
  const [tIn, setTIn] = useState(''); const [tOut, setTOut] = useState('')

  async function loadWeek() { setWeek(await getEmployeeWeekAction(employeeId)) }
  useEffect(() => {
    Promise.all([getEmployeeMeta(employeeId), getEmployeeWeekAction(employeeId)]).then(([m, w]) => {
      if (m) setMeta({ ...EMPTY, ...m })
      setWeek(w); setLoaded(true)
    })
  }, [employeeId])

  const weekMap = new Map(week.map(r => [r.work_date, r]))
  const stateOf = (date: string): DayState => {
    const r = weekMap.get(date)
    if (r?.check_in) return 'present'
    if (!r) return 'none'
    return (r.note ?? '').toLowerCase().includes('justific') ? 'justified' : 'absent'
  }
  const nextState = (s: DayState): DayState => s === 'none' ? 'present' : s === 'present' ? 'absent' : s === 'absent' ? 'justified' : 'none'

  function cycleDay(date: string) {
    const next = nextState(stateOf(date))
    startTransition(async () => { const r = await setEmployeeDayAction(employeeId, date, next); if (r.success) loadWeek(); else toast.error(r.error ?? 'Error') })
  }
  function saveTimes() {
    if (!daySel) return
    startTransition(async () => { const r = await setEmployeeDayTimesAction(employeeId, daySel, tIn, tOut); if (r.success) { toast.success('Horario guardado'); loadWeek() } else toast.error(r.error ?? 'Error') })
  }
  function save() {
    startTransition(async () => {
      const ops: Promise<{ success: boolean; error?: string }>[] = [
        saveEmployeeMetaAction(employeeId, meta),
        savePayrollDiscountAction(employeeId, periodStart, parseFloat(discount) || 0),
      ]
      if (name.trim() && name.trim() !== employeeName) ops.push(setEmployeeNameAction(employeeId, name))
      const res = await Promise.all(ops)
      if (res.every(r => r.success)) { toast.success('Empleado actualizado'); onSaved(); onClose() }
      else toast.error(res.find(r => !r.success)?.error || 'Error')
    })
  }
  function setRole(role: 'employee' | 'supervisor') {
    startTransition(async () => { const r = await setEmployeeRoleAction(employeeId, role); if (r.success) toast.success(role === 'supervisor' ? 'Ahora es supervisor' : 'Ahora es empleado'); else toast.error(r.error ?? 'Error') })
  }
  function remove() {
    requireUnlock(() => {
      if (!confirm('¿Quitar el acceso de este empleado? No podrá iniciar sesión.')) return
      startTransition(async () => { const r = await deleteEmployeeAction(employeeId); if (r.success) { toast.success('Acceso quitado'); onSaved(); onClose() } else toast.error(r.error ?? 'Error') })
    })
  }

  type StrKey = 'phone' | 'emergency_phone' | 'insurance_no' | 'branch' | 'rfc' | 'position' | 'hire_date' | 'photo_url'
  const txt = (k: StrKey, label: string, ph = '', type = 'text') => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
      <Input type={type} value={meta[k] ?? ''} onChange={e => setMeta(m => ({ ...m, [k]: e.target.value }))} className="h-9 text-sm" placeholder={ph} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-500 to-violet-600">
          <div className="flex items-center gap-3">
            {meta.photo_url
              ? <img src={meta.photo_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/40" />
              : <span className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">{(employeeName || '?').charAt(0).toUpperCase()}</span>}
            <div>
              <p className="text-sm font-bold text-white leading-tight">{employeeName}</p>
              <p className="text-[11px] text-white/75">{meta.position || 'Editar empleado'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {!loaded ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Datos + perfil */}
            <div>
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><UserRound size={13} /> Datos y perfil</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Nombre</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" placeholder="Nombre del empleado" />
                </div>
                {txt('phone', 'Teléfono', '55 1234 5678')}
                {txt('emergency_phone', 'Tel. emergencia', '55 8765 4321')}
                {txt('insurance_no', 'N° Seguro Social (NSS)', '12345678901')}
                {txt('rfc', 'RFC', 'XXXX000000XXX')}
                {txt('position', 'Puesto', 'Cajero')}
                {txt('branch', 'Sucursal / caja', 'Centro')}
                {txt('hire_date', 'Fecha de ingreso', '', 'date')}
                {txt('photo_url', 'Foto (URL)', 'https://…')}
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Sueldo base</label>
                  <Input type="number" min="0" value={meta.salary ?? ''} onChange={e => setMeta(m => ({ ...m, salary: e.target.value ? parseFloat(e.target.value) : null }))} className="h-9 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Descuento del periodo</label>
                  <Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className="h-9 text-sm" placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Rol */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><Shield size={13} /> Rol / permisos</p>
              <div className="flex gap-2">
                <button onClick={() => setRole('employee')} disabled={isPending} className="flex-1 h-9 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-indigo-300">Empleado</button>
                <button onClick={() => setRole('supervisor')} disabled={isPending} className="flex-1 h-9 rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-700 hover:bg-indigo-100">Supervisor</button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Supervisor: además del POS puede ver el panel de Empleados.</p>
            </div>

            {/* Asistencia manual */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><CalendarClock size={13} /> Asistencia de la semana</p>
              <div className="flex items-center justify-between gap-1 mb-2">
                {days.map((date, i) => {
                  const st = stateOf(date)
                  const cls = st === 'present' ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                    : st === 'absent' ? 'bg-red-100 text-red-500 border-red-200'
                    : st === 'justified' ? 'bg-blue-100 text-blue-500 border-blue-200'
                    : 'bg-white text-gray-300 border-gray-200'
                  return (
                    <button key={date} onClick={() => cycleDay(date)} disabled={isPending} title={`${date} (clic: presente → falta → justificada → ninguno)`}
                      className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg border py-1.5 ${cls}`}>
                      <span className="text-[9px] font-semibold">{WD[i]}</span>
                      {st === 'present' ? <Check size={13} /> : st === 'absent' ? <X size={13} /> : st === 'justified' ? <Check size={12} /> : <span className="text-xs">·</span>}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mb-2">🟢 Presente · 🔴 Falta · 🔵 Justificada · clic para cambiar</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400">Día</label>
                  <select value={daySel} onChange={e => setDaySel(e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded-lg px-1 bg-white">
                    {days.map((d, i) => <option key={d} value={d}>{WD[i]} {d.slice(5)}</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] text-gray-400">Entrada</label><Input type="time" value={tIn} onChange={e => setTIn(e.target.value)} className="h-8 text-xs w-28" /></div>
                <div><label className="text-[10px] text-gray-400">Salida</label><Input type="time" value={tOut} onChange={e => setTOut(e.target.value)} className="h-8 text-xs w-28" /></div>
                <button onClick={saveTimes} disabled={isPending} className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">Guardar</button>
              </div>
            </div>

            <button onClick={save} disabled={isPending} className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Guardar cambios</>}
            </button>
            <button onClick={remove} disabled={isPending} className="w-full inline-flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-600"><Trash2 size={13} /> Quitar acceso</button>
          </div>
        )}
      </div>
      {gate}
    </div>
  )
}
