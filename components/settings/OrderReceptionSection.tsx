'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Inbox, Loader2, Plus, Trash2, Check, UserRound, Building2 } from 'lucide-react'
import {
  getReceptionDataAction, setReceptionAction, clearReceptionAction,
  addBranchAction, deleteBranchAction, type ReceptionData,
} from '@/lib/actions/reception'

export default function OrderReceptionSection({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<ReceptionData | null>(null)
  const [newBranch, setNewBranch] = useState('')
  const [isPending, startTransition] = useTransition()
  // Multi-select: ids seleccionados (para empleados usamos name como id estable en value)
  const [selEmps, setSelEmps] = useState<string[]>([])
  const [selBranches, setSelBranches] = useState<string[]>([])

  async function load() {
    const d = await getReceptionDataAction()
    setData(d)
    // Cargar selección actual (soporta multi o single legacy)
    const curVal = d.value || ''
    if (curVal) {
      const parts = curVal.split(',').map(p => p.trim()).filter(Boolean)
      // Para compatibilidad: si no hay ids exactos, usamos los nombres en las listas
      const empNames = (d.employees || []).map(e => e.name)
      const brNames = (d.branches || []).map(b => b.name)
      setSelEmps(parts.filter(p => empNames.includes(p)))
      setSelBranches(parts.filter(p => brNames.includes(p)))
    } else {
      setSelEmps([])
      setSelBranches([])
    }
  }
  useEffect(() => { load() }, [])

  function toggleEmp(name: string) {
    setSelEmps(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])
  }
  function toggleBranch(name: string) {
    setSelBranches(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])
  }

  function saveMulti() {
    const all = [...selEmps, ...selBranches]
    const value = all.join(', ')
    const type = all.length ? 'multi' : null
    setData(d => (d ? { ...d, type: (type || null) as 'multi' | null, id: null, value: value || null } : d))
    startTransition(async () => {
      if (!value) {
        // clear
        const r = await clearReceptionAction()
        if (!r.success) { toast.error(r.error ?? 'Error'); load() } else { toast.success('Recepción limpiada'); load() }
        return
      }
      const r = await setReceptionAction('multi', 'multi', value) // type multi, id dummy, value=lista
      if (!r.success) { toast.error(r.error ?? 'Error'); load() } else toast.success('Recepción multi guardada')
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

  const hasSel = selEmps.length + selBranches.length > 0
  const currentDisplay = data.value || (hasSel ? [...selEmps, ...selBranches].join(', ') : null)

  return (
    <div className={embedded ? 'pt-4 mt-1 border-t border-gray-100 space-y-4' : 'rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4'}>
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Inbox size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Recepción de pedidos online</p>
          <p className="text-xs text-gray-400">Selecciona múltiples empleados y/o sucursales (multi-select). Los pedidos se notificarán a todos.</p>
        </div>
      </div>

      {currentDisplay && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">
          <Check size={15} className="shrink-0" /> Los pedidos llegan a: <strong>{currentDisplay}</strong>
          <span className="text-emerald-600/70">(multi)</span>
        </div>
      )}

      {/* Multi-select Empleados */}
      <div>
        <div className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><UserRound size={14} /> Empleados</div>
        {data.employees.length === 0 ? (
          <p className="text-[11px] text-gray-400">Aún no tienes empleados creados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-auto pr-1 border border-gray-100 rounded-lg p-2 bg-white">
            {data.employees.map(e => (
              <label key={e.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selEmps.includes(e.name)} onChange={() => toggleEmp(e.name)} disabled={isPending} className="accent-indigo-600" />
                <span>{e.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Multi-select Sucursales + gestión */}
      <div>
        <div className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><Building2 size={14} /> Sucursales</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-auto pr-1 border border-gray-100 rounded-lg p-2 bg-white mb-2">
          {(data.branches || []).length === 0 ? (
            <p className="text-[11px] text-gray-400 col-span-2">No hay sucursales. Agrega abajo.</p>
          ) : (
            (data.branches || []).map(b => (
              <label key={b.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selBranches.includes(b.name)} onChange={() => toggleBranch(b.name)} disabled={isPending} className="accent-indigo-600" />
                <span>{b.name}</span>
                <button type="button" onClick={(ev) => { ev.preventDefault(); delBranch(b.id) }} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
              </label>
            ))
          )}
        </div>
        {/* Agregar sucursal inline */}
        <div className="flex gap-2">
          <input value={newBranch} onChange={e => setNewBranch(e.target.value)}
            placeholder="Nueva sucursal (ej. Centro)"
            className="flex-1 h-8 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <button type="button" onClick={addBranch} disabled={isPending}
            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50">
            <Plus size={13} /> Agregar
          </button>
        </div>
      </div>

      <div className="pt-1">
        <button type="button" onClick={saveMulti} disabled={isPending}
          className="w-full h-9 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Guardar selección multi
        </button>
        {(selEmps.length > 0 || selBranches.length > 0) && (
          <button type="button" onClick={() => { setSelEmps([]); setSelBranches([]); }} className="mt-1 text-[11px] text-gray-500 hover:text-gray-700">Limpiar selección</button>
        )}
      </div>
    </div>
  )
}
