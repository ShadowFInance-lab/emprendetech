'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { UserPlus, Loader2, Lock, Crown, Check, Copy, ClipboardList, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createEmployeeAction, listEmployeesAction, type Employee } from '@/lib/actions/employees'
import { createStaffAction } from '@/lib/actions/staff'
import PayrollDashboard from './PayrollDashboard'
import TasksManager from './TasksManager'
import TeamChatPanel from '@/components/team/TeamChatPanel'

const PAID = ['emprendedor', 'negocio', 'vip_plus']

export default function EmployeesSection({ plan }: { plan: string }) {
  const isPaid = PAID.includes(plan)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', password: '' })
  const [lastCreated, setLastCreated] = useState<string | null>(null)
  const [signal, setSignal] = useState(0)
  const [showNomina, setShowNomina] = useState(false)

  const refresh = useCallback(async () => {
    setEmployees(await listEmployeesAction())
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
    <>
    <div className="grid lg:grid-cols-3 gap-4 items-start">
      {/* Columna principal */}
      <div className="lg:col-span-2 space-y-4">
        <button onClick={() => setShowNomina(true)} className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-md hover:opacity-90">
          <Wallet size={17} /> Ver Nómina (ventana dedicada)
        </button>
        {/* Crear empleado + KPIs + nómina + descuentos + resumen */}
        <PayrollDashboard createSlot={createCard} refreshSignal={signal} isPaid={isPaid} />
        <TasksManager employees={employees} />
      </div>

      {/* Columna derecha: chats */}
      <div className="lg:col-span-1 lg:sticky lg:top-4 space-y-4">
        <TeamChatPanel employees={employees} />
      </div>
    </div>

    {/* Ventana dedicada de Nómina */}
    {showNomina && (
      <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" onClick={() => setShowNomina(false)}>
        <div className="relative max-w-6xl mx-auto bg-gray-50 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 rounded-t-2xl">
            <p className="font-bold text-gray-900 flex items-center gap-2"><Wallet size={18} className="text-violet-600" /> Nómina</p>
            <button onClick={() => setShowNomina(false)} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar"><X size={20} /></button>
          </div>
          <div className="p-4">
            <PayrollDashboard refreshSignal={signal} isPaid={isPaid} />
          </div>
        </div>
      </div>
    )}
    </>
  )
}
