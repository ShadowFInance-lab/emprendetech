'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Save, Trash2, Check, Shield, UserRound, CalendarClock, Upload, Mail, KeyRound, Eye, EyeOff, Lock, Clock4, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getEmployeeMeta, saveEmployeeMetaAction, deleteEmployeeAction, setEmployeeRoleAction, setEmployeeNameAction, uploadEmployeePhotoAction, getEmployeeLoginAction, setEmployeePasswordAction, type EmployeeMeta } from '@/lib/actions/employees'
import { getEmployeeWeekAction, setEmployeeDayAction, setEmployeeDayTimesAction, type AttendanceRow, type DayState } from '@/lib/actions/attendance'
import { formatCurrency } from '@/lib/utils/format'
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

// Pestañas del modal (ventanas separadas por tema)
const TABS = [
  { id: 'perfil', label: 'Datos y Perfil', icon: UserRound },
  { id: 'horario', label: 'Horarios y Asistencia', icon: CalendarClock },
  { id: 'acceso', label: 'Acceso y Contraseña', icon: KeyRound },
  { id: 'nomina', label: 'Nómina', icon: Wallet },
] as const
type TabId = typeof TABS[number]['id']

interface Props {
  employeeId: string
  employeeName: string
  periodStart: string
  initialDiscount: number
  onClose: () => void
  onSaved: () => void
}

export default function EmployeeEditModal({ employeeId, employeeName, onClose, onSaved }: Props) {
  const [meta, setMeta] = useState<EmployeeMeta>(EMPTY)
  const [name, setName] = useState(employeeName)
  const [week, setWeek] = useState<AttendanceRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { requireUnlock, gate } = useBossGate()
  const days = useMemo(() => weekDates(), [])
  const [daySel, setDaySel] = useState(days[0])
  const [tIn, setTIn] = useState(''); const [tOut, setTOut] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [tab, setTab] = useState<TabId>('perfil')

  async function loadWeek() { setWeek(await getEmployeeWeekAction(employeeId)) }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const fd = new FormData(); fd.set('id', employeeId); fd.set('isStaff', 'false'); fd.set('file', file)
    const res = await uploadEmployeePhotoAction(fd)
    if (res.success && res.url) {
      setMeta(m => ({ ...m, photo_url: res.url! }))
      toast.success('Foto actualizada')
      onSaved()
    } else {
      toast.error(res.error || 'Error subiendo foto')
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }
  useEffect(() => {
    Promise.all([getEmployeeMeta(employeeId), getEmployeeWeekAction(employeeId)]).then(([m, w]) => {
      if (m) setMeta({ ...EMPTY, ...m })
      setWeek(w); setLoaded(true)
    })
    getEmployeeLoginAction(employeeId).then(r => setEmail(r.email))
  }, [employeeId])

  // Al elegir un día, precarga sus horas guardadas — así cada día es editable
  // viendo lo que ya tiene, no escribiendo a ciegas.
  useEffect(() => {
    const r = week.find(w => w.work_date === daySel)
    setTIn(r?.check_in ? r.check_in.slice(11, 16) : '')
    setTOut(r?.check_out ? r.check_out.slice(11, 16) : '')
  }, [daySel, week])


  const weekMap = new Map(week.map(r => [r.work_date, r]))
  const stateOf = (date: string): DayState => {
    const r = weekMap.get(date)
    if (r?.check_in) return 'present'
    if (!r) return 'none'
    return (r.note ?? '').toLowerCase().includes('justific') ? 'justified' : 'absent'
  }
  const nextState = (s: DayState): DayState => s === 'none' ? 'present' : s === 'present' ? 'absent' : s === 'absent' ? 'justified' : 'none'
  // Resumen de la semana para la pestaña Nómina
  const weekSummary = {
    present: days.filter(d => stateOf(d) === 'present').length,
    absent: days.filter(d => stateOf(d) === 'absent').length,
    justified: days.filter(d => stateOf(d) === 'justified').length,
  }

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
      ]
      if (name.trim() && name.trim() !== employeeName) ops.push(setEmployeeNameAction(employeeId, name))
      const res = await Promise.all(ops)
      if (res.every(r => r.success)) { toast.success('Empleado actualizado'); onSaved(); onClose() }
      else toast.error(res.find(r => !r.success)?.error || 'Error')
    })
  }
  function savePassword() {
    if (newPw.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    startTransition(async () => {
      const r = await setEmployeePasswordAction(employeeId, newPw)
      if (r.success) { toast.success('Contraseña actualizada. Compártela con el empleado.'); setNewPw('') }
      else toast.error(r.error ?? 'Error')
    })
  }
  function setRole(role: 'employee' | 'supervisor' | 'gerente') {
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

        {/* Pestañas: ventanas separadas por tema */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 px-2">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <t.icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {!loaded ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {tab === 'perfil' && (<>
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
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Foto del empleado</label>
                  <div className="flex items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
                    {meta.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={meta.photo_url} alt="" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-violet-200 shrink-0" />
                    ) : <div className="w-20 h-20 rounded-2xl bg-white ring-2 ring-violet-100 flex items-center justify-center text-violet-300 shrink-0"><UserRound size={30} /></div>}
                    <div className="flex-1 min-w-0">
                      <label className="cursor-pointer w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-violet-500/20">
                        <Upload size={18} /> {uploadingPhoto ? 'Subiendo...' : 'Subir foto'}
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" />
                      </label>
                      <p className="mt-2 text-[10px] text-gray-400 text-center">JPG, PNG o WebP · máx 3MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={save} disabled={isPending} className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Guardar cambios</>}
            </button>
            </>)}

            {tab === 'acceso' && (<>
            {/* Acceso del empleado: correo + restablecer contraseña */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><KeyRound size={13} /> Acceso del empleado</p>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Usuario / correo de acceso</label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate">{email || '—'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Contraseña actual</label>
                  <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-lg border border-gray-200 bg-gray-100/70 text-sm text-gray-500 select-none">
                    <span className="tracking-[0.3em]">••••••••</span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><Lock size={11} /> cifrada</span>
                      <button type="button" title="Intentar mostrar"
                        onClick={() => toast('🔒 Por seguridad, la contraseña se guarda cifrada con hash irreversible: ni siquiera el sistema puede verla. Si el empleado la olvidó, asigna una nueva abajo.', { duration: 6000 })}
                        className="text-gray-400 hover:text-gray-700"><Eye size={14} /></button>
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Nueva contraseña</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mín. 6 caracteres" className="h-9 text-sm pr-9" />
                      <button type="button" onClick={() => setShowPw(v => !v)} title={showPw ? 'Ocultar' : 'Mostrar'} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    </div>
                    <button type="button" onClick={savePassword} disabled={isPending || newPw.length < 6} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">Guardar</button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">Por seguridad la contraseña se guarda cifrada y no puede mostrarse. Si el empleado la olvidó, escribe una nueva (con el 👁 la ves mientras la escribes) y compártesela.</p>
              </div>
            </div>

            {/* Rol */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><Shield size={13} /> Rol / permisos</p>
              <div className="flex gap-2">
                <button onClick={() => setRole('employee')} disabled={isPending} className="flex-1 h-9 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-indigo-300">Empleado</button>
                <button onClick={() => setRole('supervisor')} disabled={isPending} className="flex-1 h-9 rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-700 hover:bg-indigo-100">Supervisor</button>
                <button onClick={() => setRole('gerente')} disabled={isPending} className="flex-1 h-9 rounded-lg border border-amber-200 bg-amber-50 text-sm font-medium text-amber-700 hover:bg-amber-100">Gerente</button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Supervisor: POS + panel de Empleados. Gerente: casi todo el panel (sin Configuración ni Suscripción).</p>
            </div>
            <button onClick={remove} disabled={isPending} className="w-full inline-flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-600"><Trash2 size={13} /> Quitar acceso</button>
            </>)}

            {tab === 'horario' && (<>
            {/* Asistencia de la Semana — bloque EXACTO idéntico (como en Juan David para Staff y Employee) */}
            <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-4">
              <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5 mb-3"><CalendarClock size={13} /> Asistencia de la Semana</p>
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
              <p className="text-[10px] text-violet-600/70 mb-2">🟢 Presente · 🔴 Falta · 🔵 Justificada · clic para cambiar</p>
            </div>

            {/* Horario del día: selects grandes y claros (time pickers nativos) */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><Clock4 size={13} /> Horario del día</p>
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Día</label>
                  <select value={daySel} onChange={e => setDaySel(e.target.value)} className="w-full h-10 text-sm border border-gray-200 rounded-lg px-2 bg-white">
                    {days.map((d, i) => <option key={d} value={d}>{WD[i]} {d.slice(5)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Entrada</label>
                  <Input type="time" value={tIn} onChange={e => setTIn(e.target.value)} className="h-10 text-sm w-full sm:w-32 cursor-pointer" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Salida</label>
                  <Input type="time" value={tOut} onChange={e => setTOut(e.target.value)} className="h-10 text-sm w-full sm:w-32 cursor-pointer" />
                </div>
                <button onClick={saveTimes} disabled={isPending} className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 col-span-2 sm:col-span-1">Guardar horario</button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Toca el campo para abrir el selector de hora. Al guardar la entrada, el día se marca 🟢 Presente arriba.</p>
            </div>
            </>)}

            {tab === 'nomina' && (<>
            {/* Sueldo base (se guarda con el botón de abajo) */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><Wallet size={13} /> Sueldo</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Sueldo base</label>
                  <Input type="number" min="0" value={meta.salary ?? ''} onChange={e => setMeta(m => ({ ...m, salary: e.target.value ? parseFloat(e.target.value) : null }))} className="h-9 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Registrado</label>
                  <div className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 flex items-center font-semibold">
                    {meta.salary != null ? formatCurrency(meta.salary) : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen de asistencia de la semana (alimenta la nómina) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <p className="text-xl font-black text-emerald-600">{weekSummary.present}</p>
                <p className="text-[10px] font-semibold text-emerald-700">Presentes</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                <p className="text-xl font-black text-red-500">{weekSummary.absent}</p>
                <p className="text-[10px] font-semibold text-red-600">Faltas</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-xl font-black text-blue-500">{weekSummary.justified}</p>
                <p className="text-[10px] font-semibold text-blue-600">Justificadas</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400">Bonos, descuentos, ISR/IMSS, neto y el recibo PDF se gestionan en la tabla <strong>Nómina · Semanal</strong> de la página Empleados.</p>

            <button onClick={save} disabled={isPending} className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Guardar sueldo</>}
            </button>
            </>)}
          </div>
        )}
      </div>
      {gate}
    </div>
  )
}
