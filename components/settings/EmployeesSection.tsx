'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Users, UserPlus, Trash2, Send, Loader2, Lock, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createEmployeeAction, listEmployeesAction, deleteEmployeeAction, notifyEmployeeAction,
  type Employee,
} from '@/lib/actions/employees'

const PAID = ['emprendedor', 'negocio', 'vip_plus']

export default function EmployeesSection({ plan }: { plan: string }) {
  const isPaid = PAID.includes(plan)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [notifyFor, setNotifyFor] = useState<string | null>(null)
  const [notifyMsg, setNotifyMsg] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setEmployees(await listEmployeesAction())
    setLoading(false)
  }, [])
  useEffect(() => { if (isPaid) refresh() }, [isPaid, refresh])

  function create() {
    if (!form.email.trim() || !form.password) { toast.error('Correo y contraseña requeridos'); return }
    startTransition(async () => {
      const res = await createEmployeeAction(form)
      if (res.success) { toast.success('Empleado creado'); setForm({ name: '', email: '', password: '' }); refresh() }
      else toast.error(res.error ?? 'Error', { duration: 6000 })
    })
  }
  function remove(id: string) {
    if (!confirm('¿Eliminar este empleado? Perderá el acceso.')) return
    startTransition(async () => {
      const res = await deleteEmployeeAction(id)
      if (res.success) { toast.success('Empleado eliminado'); refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }
  function send(id: string) {
    if (!notifyMsg.trim()) { toast.error('Escribe un mensaje'); return }
    startTransition(async () => {
      const res = await notifyEmployeeAction(id, notifyMsg)
      if (res.success) { toast.success('Notificación enviada'); setNotifyFor(null); setNotifyMsg('') }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Users size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Equipo · Jefe y Empleados</p>
          <p className="text-xs text-gray-400">Crea cuentas para tu personal. Los empleados solo acceden al POS (Ventas) y ven el stock.</p>
        </div>
      </div>

      {!isPaid ? (
        <div className="flex flex-col items-center text-center gap-3 py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <span className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Lock size={22} className="text-amber-600" />
          </span>
          <div>
            <p className="font-semibold text-gray-800">Cuentas de empleado</p>
            <p className="text-sm text-gray-500 mt-0.5">Disponible en los planes de pago (Emprendedor, Negocio o VIP Plus).</p>
          </div>
          <Link href="/subscription"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md hover:opacity-90">
            <Crown size={15} /> Mejorar plan
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Crear empleado */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <UserPlus size={14} /> Nuevo empleado
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre" className="h-10 text-sm" />
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Correo" className="h-10 text-sm" />
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña (mín. 6)" className="h-10 text-sm" />
            </div>
            <Button onClick={create} disabled={isPending} className="h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus size={16} className="mr-1.5" /> Crear empleado</>}
            </Button>
            <p className="text-[11px] text-gray-400">El empleado inicia sesión con ese correo y contraseña. Solo podrá usar el POS y cobrar.</p>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : employees.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aún no tienes empleados.</p>
          ) : (
            <div className="space-y-2">
              {employees.map(emp => (
                <div key={emp.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {(emp.name || emp.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.name || 'Empleado'}</p>
                      <p className="text-xs text-gray-400 truncate">{emp.email ?? '—'}</p>
                    </div>
                    <button onClick={() => { setNotifyFor(notifyFor === emp.id ? null : emp.id); setNotifyMsg('') }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                      <Send size={13} /> Notificar
                    </button>
                    <button onClick={() => remove(emp.id)} disabled={isPending}
                      className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={15} /></button>
                  </div>
                  {notifyFor === emp.id && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <Input value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} placeholder="Mensaje para el empleado…"
                        className="h-9 text-sm" onKeyDown={e => { if (e.key === 'Enter') send(emp.id) }} />
                      <Button onClick={() => send(emp.id)} disabled={isPending} className="h-9 bg-indigo-600 hover:bg-indigo-700">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={15} />}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
