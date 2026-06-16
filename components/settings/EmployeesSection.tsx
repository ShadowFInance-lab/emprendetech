'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { UserPlus, Loader2, Lock, Crown, Check, Copy, Users, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createEmployeeAction, listEmployeesAction, type Employee } from '@/lib/actions/employees'
import { createStaffAction } from '@/lib/actions/staff'
import EmployeeManageCard from './EmployeeManageCard'
import TeamAttendance from './TeamAttendance'
import PayrollDashboard from './PayrollDashboard'
import TeamChatPanel from '@/components/team/TeamChatPanel'

const PAID = ['emprendedor', 'negocio', 'vip_plus']

export default function EmployeesSection({ plan }: { plan: string }) {
  const isPaid = PAID.includes(plan)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', password: '' })
  const [lastCreated, setLastCreated] = useState<string | null>(null)
  const [signal, setSignal] = useState(0)

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
        refresh(); setSignal(s => s + 1)
      } else toast.error(res.error ?? 'Error', { duration: 6000 })
    })
  }
  function createStaff() {
    if (!form.name.trim()) { toast.error('Escribe el nombre'); return }
    startTransition(async () => {
      const res = await createStaffAction(form.name)
      if (res.success) {
        toast.success('Empleado de registro creado')
        setForm({ name: '', password: '' })
        setSignal(s => s + 1)
      } else toast.error(res.error ?? 'Error', { duration: 6000 })
    })
  }
  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success('Usuario copiado')).catch(() => {})
  }

  const createCard = (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 h-full">
      <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-1">
        <UserPlus size={16} className="text-indigo-600" /> Crear empleado
      </p>
      <p className="text-[11px] text-gray-400 mb-2">Con contraseña = entra al POS. Sin contraseña = solo aparece en nómina/asistencia.</p>
      <div className="space-y-2">
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del empleado" className="h-10 text-sm" />
        <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña (mín. 6) — opcional" className="h-10 text-sm" />
        <Button onClick={create} disabled={isPending} className="w-full h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus size={16} className="mr-1.5" /> Crear con acceso (POS)</>}
        </Button>
        <button onClick={createStaff} disabled={isPending} className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          <ClipboardList size={15} /> Solo registro (sin login)
        </button>
      </div>
      {lastCreated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm mt-2">
          <p className="font-medium text-green-800 flex items-center gap-1.5"><Check size={15} /> Empleado creado:</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-200 rounded px-2 py-1 text-xs text-gray-700 break-all">{lastCreated}</code>
            <button onClick={() => copy(lastCreated)} className="text-green-700 hover:text-green-900"><Copy size={15} /></button>
          </div>
          <p className="text-[11px] text-green-700 mt-1">La contraseña es la que escribiste.</p>
        </div>
      )}
    </div>
  )

  if (!isPaid) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <div className="flex flex-col items-center text-center gap-3 py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <span className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center"><Lock size={22} className="text-amber-600" /></span>
          <div>
            <p className="font-semibold text-gray-800">Cuentas de empleado</p>
            <p className="text-sm text-gray-500 mt-0.5">Disponible en los planes de pago (Emprendedor, Negocio o VIP Plus).</p>
          </div>
          <Link href="/subscription" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md hover:opacity-90">
            <Crown size={15} /> Mejorar plan
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 items-start">
      {/* Columna principal */}
      <div className="lg:col-span-2 space-y-4">
        {/* Crear empleado + KPIs + Cartocena + nómina + descuentos + resumen */}
        <PayrollDashboard createSlot={createCard} refreshSignal={signal} isPaid={isPaid} />

        {/* Gestión de cada empleado */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><Users size={16} className="text-indigo-600" /> Equipo · datos y ventas</p>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : employees.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aún no tienes empleados.</p>
          ) : (
            <div className="space-y-2">{employees.map(emp => <EmployeeManageCard key={emp.id} emp={emp} onChange={refresh} />)}</div>
          )}
        </div>

        {/* Asistencia */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <TeamAttendance />
        </div>
      </div>

      {/* Columna derecha: chats */}
      <div className="lg:col-span-1 lg:sticky lg:top-4 space-y-4">
        <TeamChatPanel employees={employees} />
      </div>
    </div>
  )
}
