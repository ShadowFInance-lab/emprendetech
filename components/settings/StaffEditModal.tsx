'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Save, Trash2, UserRound, ClipboardList, CalendarClock, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { saveStaffAction, deleteStaffAction, setStaffDayAction, type Staff } from '@/lib/actions/staff'
import { useBossGate } from './BossGate'

const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function weekDates(): string[] {
  const now = new Date(); const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return toISO(d) })
}

interface Props { staff: Staff; onClose: () => void; onSaved: () => void }

export default function StaffEditModal({ staff, onClose, onSaved }: Props) {
  const [s, setS] = useState<Staff>(staff)
  const [isPending, startTransition] = useTransition()
  const { requireUnlock, gate } = useBossGate()
  const days = weekDates()

  function set<K extends keyof Staff>(k: K, v: Staff[K]) { setS(prev => ({ ...prev, [k]: v })) }
  function cycleDay(date: string) {
    const cur = s.week_attendance?.[date] || 'none'
    const next = cur === 'none' ? 'present' : cur === 'present' ? 'absent' : cur === 'absent' ? 'justified' : 'none'
    const wa = { ...(s.week_attendance || {}) }
    if (next === 'none') delete wa[date]; else wa[date] = next
    set('week_attendance', wa)
    // Auto-guardado inmediato en la base de datos (no se pierde al recargar)
    startTransition(async () => { const r = await setStaffDayAction(s.id, date, next); if (!r.success) toast.error(r.error ?? 'Error'); else onSaved() })
  }

  function save() {
    if (!s.name.trim()) { toast.error('Escribe el nombre'); return }
    startTransition(async () => {
      const r = await saveStaffAction(s.id, {
        name: s.name, phone: s.phone, emergency_phone: s.emergency_phone, insurance_no: s.insurance_no,
        rfc: s.rfc, position: s.position, branch: s.branch, hire_date: s.hire_date, photo_url: s.photo_url,
        salary: s.salary, days_worked: s.days_worked, absences: s.absences, discount: s.discount, bonus: s.bonus, paid: s.paid, note: s.note,
      })
      if (r.success) { toast.success('Empleado actualizado'); onSaved(); onClose() } else toast.error(r.error ?? 'Error')
    })
  }
  function remove() {
    requireUnlock(() => {
      if (!confirm('¿Eliminar este empleado de registro?')) return
      startTransition(async () => {
        const r = await deleteStaffAction(s.id)
        if (r.success) { toast.success('Eliminado'); onSaved(); onClose() } else toast.error(r.error ?? 'Error')
      })
    })
  }

  type StrKey = 'name' | 'phone' | 'emergency_phone' | 'insurance_no' | 'rfc' | 'position' | 'branch' | 'hire_date' | 'photo_url'
  const txt = (k: StrKey, label: string, ph = '', type = 'text') => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
      <Input type={type} value={s[k] ?? ''} onChange={e => set(k, e.target.value)} className="h-9 text-sm" placeholder={ph} />
    </div>
  )
  const num = (k: 'salary' | 'days_worked' | 'absences' | 'discount' | 'bonus', label: string, step = '1') => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
      <Input type="number" min="0" step={step} value={s[k] ?? 0}
        onChange={e => set(k, (step === '1' ? parseInt(e.target.value) : parseFloat(e.target.value)) || 0)} className="h-9 text-sm" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-500 to-violet-600">
          <div className="flex items-center gap-3">
            {s.photo_url
              ? <img src={s.photo_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/40" />
              : <span className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">{(s.name || '?').charAt(0).toUpperCase()}</span>}
            <div>
              <p className="text-sm font-bold text-white leading-tight">{s.name || 'Empleado'}</p>
              <p className="text-[11px] text-white/75">{s.position || 'Editar empleado'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Datos + perfil (idéntico al de empleados con login) */}
          <div>
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><UserRound size={13} /> Datos y perfil</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-gray-500 mb-1 block">Nombre</label>
                <Input value={s.name} onChange={e => set('name', e.target.value)} className="h-9 text-sm" placeholder="Nombre del empleado" />
              </div>
              {txt('phone', 'Teléfono', '55 1234 5678')}
              {txt('emergency_phone', 'Tel. emergencia', '55 8765 4321')}
              {txt('insurance_no', 'N° Seguro Social (NSS)', '12345678901')}
              {txt('rfc', 'RFC', 'XXXX000000XXX')}
              {txt('position', 'Puesto', 'Cajero')}
              {txt('branch', 'Sucursal / caja', 'Centro')}
              {txt('hire_date', 'Fecha de ingreso', '', 'date')}
              {txt('photo_url', 'Foto (URL)', 'https://…')}
              {num('salary', 'Sueldo base', '0.01')}
              {num('discount', 'Descuento', '0.01')}
              {num('bonus', 'Bonos', '0.01')}
            </div>
          </div>

          {/* Registro (sin login) — equivalente al bloque "Rol / permisos" del de login */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-1"><ClipboardList size={13} /> Empleado de registro</p>
            <p className="text-[10px] text-gray-400">No inicia sesión en el POS. Su asistencia se captura manualmente.</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {num('days_worked', 'Días trabajados')}
              {num('absences', 'Faltas')}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-2">
              <input type="checkbox" checked={s.paid} onChange={e => set('paid', e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
              Marcar como <span className="font-medium">pagado</span> este periodo
            </label>
          </div>

          {/* Asistencia de la Semana — bloque destacado morado unificado */}
          <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-4">
            <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5 mb-3"><CalendarClock size={13} /> Asistencia de la Semana</p>
            <div className="flex items-center justify-between gap-1 mb-2">
              {days.map((date, i) => {
                const st = s.week_attendance?.[date] || 'none'
                const cls = st === 'present' ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                  : st === 'absent' ? 'bg-red-100 text-red-500 border-red-200'
                  : st === 'justified' ? 'bg-blue-100 text-blue-500 border-blue-200'
                  : 'bg-white text-gray-300 border-gray-200'
                return (
                  <button key={date} type="button" onClick={() => cycleDay(date)} title={`${date} (clic: presente → falta → justificada → ninguno)`}
                    className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg border py-1.5 ${cls}`}>
                    <span className="text-[9px] font-semibold">{WD[i]}</span>
                    {st === 'present' ? <Check size={13} /> : st === 'absent' ? <X size={13} /> : st === 'justified' ? <Check size={12} /> : <span className="text-xs">·</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-violet-600/70">🟢 Presente · 🔴 Falta · 🔵 Justificada · clic para cambiar</p>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Descripción / nota</label>
            <Input value={s.note ?? ''} onChange={e => set('note', e.target.value)} className="h-9 text-sm" placeholder="Ej. llegó tarde, cita médica…" />
          </div>

          <button onClick={save} disabled={isPending} className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Guardar cambios</>}
          </button>
          <button onClick={remove} disabled={isPending} className="w-full inline-flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-600"><Trash2 size={13} /> Eliminar empleado</button>
        </div>
      </div>
      {gate}
    </div>
  )
}
