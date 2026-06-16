'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Users, UserPlus, Loader2, Lock, Crown, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createEmployeeAction, listEmployeesAction, type Employee } from '@/lib/actions/employees'
import EmployeeManageCard from './EmployeeManageCard'
import TeamAttendance from './TeamAttendance'
import PayrollTable from './PayrollTable'
import TeamGroupChat from '@/components/team/TeamGroupChat'

const PAID = ['emprendedor', 'negocio', 'vip_plus']

export default function EmployeesSection({ plan }: { plan: string }) {
  const isPaid = PAID.includes(plan)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', password: '' })
  const [lastCreated, setLastCreated] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setEmployees(await listEmployeesAction())
    setLoading(false)
  }, [])
  useEffect(() => { if (isPaid) refresh() }, [isPaid, refresh])

  function create() {
    if (!form.name.trim() || !form.password) { toast.error('Nombre y contraseña requeridos'); return }
    startTransition(async () => {
      const res = await createEmployeeAction(form)
      if (res.success) {
        toast.success('Empleado creado')
        setLastCreated(res.loginEmail ?? null)
        setForm({ name: '', password: '' })
        refresh()
      } else toast.error(res.error ?? 'Error', { duration: 6000 })
    })
  }
  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success('Usuario copiado')).catch(() => {})
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Users size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Empleados</p>
          <p className="text-xs text-gray-400">Crea cuentas, gestiona datos, ventas, asistencia y chatea con tu personal.</p>
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
          {/* Crear empleado — solo Nombre + Contraseña */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <UserPlus size={14} /> Nuevo empleado
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del empleado" className="h-10 text-sm" />
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña (mín. 6)" className="h-10 text-sm" />
            </div>
            <Button onClick={create} disabled={isPending} className="h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus size={16} className="mr-1.5" /> Crear empleado</>}
            </Button>
            <p className="text-[11px] text-gray-400">Sin correo: se genera un usuario a partir del nombre. El empleado entra con ese usuario y la contraseña, y solo verá el POS.</p>

            {lastCreated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-green-800 flex items-center gap-1.5"><Check size={15} /> Empleado creado. Comparte estos datos:</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 bg-white border border-green-200 rounded px-2 py-1 text-xs text-gray-700 break-all">{lastCreated}</code>
                  <button onClick={() => copy(lastCreated)} className="text-green-700 hover:text-green-900"><Copy size={15} /></button>
                </div>
                <p className="text-[11px] text-green-700 mt-1">Usuario de acceso · la contraseña es la que escribiste.</p>
              </div>
            )}
          </div>

          {/* Lista de empleados (gestión completa) */}
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : employees.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aún no tienes empleados.</p>
          ) : (
            <div className="space-y-2">
              {employees.map(emp => <EmployeeManageCard key={emp.id} emp={emp} onChange={refresh} />)}
            </div>
          )}

          <TeamGroupChat />
          <TeamAttendance />
          <PayrollTable />
        </div>
      )}
    </div>
  )
}
