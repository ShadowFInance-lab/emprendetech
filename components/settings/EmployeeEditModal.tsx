'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Save, Phone, ShieldAlert, BadgeCheck, Store, Banknote, Percent, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getEmployeeMeta, saveEmployeeMetaAction, deleteEmployeeAction, type EmployeeMeta } from '@/lib/actions/employees'
import { savePayrollDiscountAction } from '@/lib/actions/payroll'

const EMPTY: EmployeeMeta = { phone: '', insurance_no: '', emergency_phone: '', branch: '', salary: null }

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
  const [discount, setDiscount] = useState(String(initialDiscount || 0))
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getEmployeeMeta(employeeId).then(m => {
      if (m) setMeta({ phone: m.phone ?? '', insurance_no: m.insurance_no ?? '', emergency_phone: m.emergency_phone ?? '', branch: m.branch ?? '', salary: m.salary })
      setLoaded(true)
    })
  }, [employeeId])

  function save() {
    startTransition(async () => {
      const [m, d] = await Promise.all([
        saveEmployeeMetaAction(employeeId, meta),
        savePayrollDiscountAction(employeeId, periodStart, parseFloat(discount) || 0),
      ])
      if (m.success && d.success) { toast.success('Empleado actualizado'); onSaved(); onClose() }
      else toast.error(m.error || d.error || 'Error al guardar')
    })
  }
  function remove() {
    if (!confirm('¿Quitar el acceso de este empleado? No podrá iniciar sesión.')) return
    startTransition(async () => {
      const r = await deleteEmployeeAction(employeeId)
      if (r.success) { toast.success('Acceso quitado'); onSaved(); onClose() } else toast.error(r.error ?? 'Error')
    })
  }

  const field = (icon: React.ReactNode, label: string, node: React.ReactNode) => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 flex items-center gap-1 mb-1">{icon} {label}</label>
      {node}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-500 to-violet-600">
          <div>
            <p className="text-sm font-bold text-white leading-tight">Editar empleado</p>
            <p className="text-[11px] text-white/75">{employeeName}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {!loaded ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {field(<Phone size={12} />, 'Teléfono', <Input value={meta.phone ?? ''} onChange={e => setMeta(m => ({ ...m, phone: e.target.value }))} className="h-9 text-sm" placeholder="55 1234 5678" />)}
              {field(<ShieldAlert size={12} />, 'Tel. emergencia', <Input value={meta.emergency_phone ?? ''} onChange={e => setMeta(m => ({ ...m, emergency_phone: e.target.value }))} className="h-9 text-sm" placeholder="55 8765 4321" />)}
              {field(<BadgeCheck size={12} />, 'N° Seguro Social', <Input value={meta.insurance_no ?? ''} onChange={e => setMeta(m => ({ ...m, insurance_no: e.target.value }))} className="h-9 text-sm" placeholder="12345678901" />)}
              {field(<Store size={12} />, 'Sucursal / caja', <Input value={meta.branch ?? ''} onChange={e => setMeta(m => ({ ...m, branch: e.target.value }))} className="h-9 text-sm" placeholder="Centro" />)}
              {field(<Banknote size={12} />, 'Sueldo base', <Input type="number" min="0" value={meta.salary ?? ''} onChange={e => setMeta(m => ({ ...m, salary: e.target.value ? parseFloat(e.target.value) : null }))} className="h-9 text-sm" placeholder="0.00" />)}
              {field(<Percent size={12} />, 'Descuento del periodo', <Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className="h-9 text-sm" placeholder="0.00" />)}
            </div>
            <button onClick={save} disabled={isPending}
              className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Guardar cambios</>}
            </button>
            <button onClick={remove} disabled={isPending} className="w-full inline-flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-600"><Trash2 size={13} /> Quitar acceso</button>
            <p className="text-[11px] text-gray-400 text-center">Los datos se reflejan en la nómina y el recibo del empleado.</p>
          </div>
        )}
      </div>
    </div>
  )
}
