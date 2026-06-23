'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Inbox, Loader2, Plus, Trash2, Check, UserRound, Building2 } from 'lucide-react'
import {
  getReceptionDataAction, setReceptionAction,
  addBranchAction, deleteBranchAction, type ReceptionData,
} from '@/lib/actions/reception'

export default function OrderReceptionSection({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<ReceptionData | null>(null)
  const [tab, setTab] = useState<'employee' | 'branch'>('employee')
  const [newBranch, setNewBranch] = useState('')
  const [isPending, startTransition] = useTransition()

  async function load() {
    const d = await getReceptionDataAction()
    setData(d)
    if (d.type) setTab(d.type)
  }
  useEffect(() => { load() }, [])

  function choose(type: 'employee' | 'branch', id: string, value: string) {
    setData(d => (d ? { ...d, type, id, value } : d))
    startTransition(async () => {
      const r = await setReceptionAction(type, id, value)
      if (!r.success) { toast.error(r.error ?? 'Error'); load() } else toast.success('Recepción guardada')
    })
  }
  function addBranch() {
    if (!newBranch.trim()) return
    startTransition(async () => {
      const r = await addBranchAction(newBranch)
      if (!r.success) { toast.error(r.error ?? 'Error'); return }
      setNewBranch(''); toast.success('Sucursal agregada'); load()
    })
  }
  function delBranch(id: string) {
    startTransition(async () => {
      const r = await deleteBranchAction(id)
      if (!r.success) { toast.error(r.error ?? 'Error'); return }
      load()
    })
  }

  if (!data) return (
    <div className={embedded ? 'pt-4 mt-1 border-t border-gray-100 flex justify-center' : 'rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex justify-center'}>
      <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
    </div>
  )

  const opts = tab === 'employee' ? data.employees : data.branches

  return (
    <div className={embedded ? 'pt-4 mt-1 border-t border-gray-100 space-y-4' : 'rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4'}>
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Inbox size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Recepción de pedidos online</p>
          <p className="text-xs text-gray-400">Elige a quién le llegan los pedidos de «Compra Online».</p>
        </div>
      </div>

      {data.type && data.value && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">
          <Check size={15} className="shrink-0" /> Los pedidos llegan a: <strong>{data.value}</strong>
          <span className="text-emerald-600/70">({data.type === 'employee' ? 'empleado' : 'sucursal'})</span>
        </div>
      )}

      {/* Tabs: empleado / sucursal */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('employee')}
          className={`flex-1 h-10 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${tab === 'employee' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <UserRound size={15} /> Por empleado
        </button>
        <button type="button" onClick={() => setTab('branch')}
          className={`flex-1 h-10 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${tab === 'branch' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <Building2 size={15} /> Por sucursal
        </button>
      </div>

      {/* Selector */}
      <select
        value={data.type === tab ? (data.id ?? '') : ''}
        onChange={e => {
          const id = e.target.value
          const name = opts.find(o => o.id === id)?.name ?? ''
          if (id) choose(tab, id, name)
        }}
        disabled={isPending}
        className="w-full h-10 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
      >
        <option value="">{tab === 'employee' ? 'Elige un empleado…' : 'Elige una sucursal…'}</option>
        {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>

      {tab === 'employee' && data.employees.length === 0 && (
        <p className="text-[11px] text-gray-400">Aún no tienes empleados. Créalos en la sección «Empleados».</p>
      )}

      {/* Gestión de sucursales */}
      {tab === 'branch' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={newBranch} onChange={e => setNewBranch(e.target.value)}
              placeholder="Nueva sucursal (ej. Centro)"
              className="flex-1 h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="button" onClick={addBranch} disabled={isPending}
              className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold inline-flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50">
              <Plus size={15} /> Agregar
            </button>
          </div>
          {data.branches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.branches.map(b => (
                <span key={b.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full pl-2.5 pr-1 py-1 text-gray-700">
                  {b.name}
                  <button type="button" onClick={() => delBranch(b.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
