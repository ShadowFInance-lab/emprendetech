'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Save, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { saveStaffAction, deleteStaffAction, type Staff } from '@/lib/actions/staff'

interface Props { staff: Staff; onClose: () => void; onSaved: () => void }

export default function StaffEditModal({ staff, onClose, onSaved }: Props) {
  const [s, setS] = useState<Staff>(staff)
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof Staff>(k: K, v: Staff[K]) { setS(prev => ({ ...prev, [k]: v })) }

  function save() {
    if (!s.name.trim()) { toast.error('Escribe el nombre'); return }
    startTransition(async () => {
      const r = await saveStaffAction(s.id, {
        name: s.name, phone: s.phone, emergency_phone: s.emergency_phone, insurance_no: s.insurance_no,
        branch: s.branch, salary: s.salary, days_worked: s.days_worked, absences: s.absences,
        discount: s.discount, bonus: s.bonus, paid: s.paid, note: s.note,
      })
      if (r.success) { toast.success('Empleado actualizado'); onSaved(); onClose() } else toast.error(r.error ?? 'Error')
    })
  }
  function remove() {
    if (!confirm('¿Eliminar este empleado de registro?')) return
    startTransition(async () => {
      const r = await deleteStaffAction(s.id)
      if (r.success) { toast.success('Eliminado'); onSaved(); onClose() } else toast.error(r.error ?? 'Error')
    })
  }

  const num = (k: 'salary' | 'days_worked' | 'absences' | 'discount' | 'bonus', label: string, step = '1') => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
      <Input type="number" min="0" step={step} value={s[k] ?? 0} onChange={e => set(k, (step === '1' ? parseInt(e.target.value) : parseFloat(e.target.value)) || 0)} className="h-9 text-sm" />
    </div>
  )
  const txt = (k: 'phone' | 'emergency_phone' | 'insurance_no' | 'branch', label: string, ph: string) => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
      <Input value={s[k] ?? ''} onChange={e => set(k, e.target.value)} className="h-9 text-sm" placeholder={ph} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-600 to-slate-800">
          <div>
            <p className="text-sm font-bold text-white leading-tight">Editar empleado (registro)</p>
            <p className="text-[11px] text-white/70">Sin login · solo nómina y asistencia</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Nombre</label>
            <Input value={s.name} onChange={e => set('name', e.target.value)} className="h-9 text-sm" placeholder="Nombre del empleado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {txt('phone', 'Teléfono', '55 1234 5678')}
            {txt('emergency_phone', 'Tel. emergencia', '55 8765 4321')}
            {txt('insurance_no', 'N° Seguro Social', '12345678901')}
            {txt('branch', 'Sucursal / caja', 'Centro')}
            {num('salary', 'Sueldo base', '0.01')}
            {num('bonus', 'Bonos', '0.01')}
            {num('days_worked', 'Días trabajados')}
            {num('absences', 'Faltas')}
            {num('discount', 'Descuento', '0.01')}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={s.paid} onChange={e => set('paid', e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
            Marcar como <span className="font-medium">pagado</span> este periodo
          </label>
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
    </div>
  )
}
