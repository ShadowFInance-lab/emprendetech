'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Trash2, Save, Send, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  deleteEmployeeAction, getEmployeeMeta, saveEmployeeMetaAction, getEmployeeStats,
  type Employee, type EmployeeMeta,
} from '@/lib/actions/employees'
import { bossSendMessageAction, getThreadAction, type TeamMessage } from '@/lib/actions/team'
import { formatCurrency } from '@/lib/utils/format'

const EMPTY: EmployeeMeta = { phone: '', insurance_no: '', emergency_phone: '', branch: '', salary: null }

export default function EmployeeManageCard({ emp, onChange }: { emp: Employee; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [meta, setMeta] = useState<EmployeeMeta>(EMPTY)
  const [stats, setStats] = useState({ todayCount: 0, todayTotal: 0, weekTotal: 0 })
  const [thread, setThread] = useState<TeamMessage[]>([])
  const [msg, setMsg] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function load() {
    const [m, s, t] = await Promise.all([getEmployeeMeta(emp.id), getEmployeeStats(emp.id), getThreadAction(emp.id)])
    if (m) setMeta({ phone: m.phone ?? '', insurance_no: m.insurance_no ?? '', emergency_phone: m.emergency_phone ?? '', branch: m.branch ?? '', salary: m.salary })
    setStats(s); setThread(t); setLoaded(true)
  }
  function toggle() { const n = !open; setOpen(n); if (n && !loaded) load() }
  function saveMeta() {
    startTransition(async () => {
      const r = await saveEmployeeMetaAction(emp.id, meta)
      if (r.success) toast.success('Datos guardados'); else toast.error(r.error ?? 'Error')
    })
  }
  function send() {
    if (!msg.trim()) return
    startTransition(async () => {
      const r = await bossSendMessageAction(emp.id, msg)
      if (r.success) { setMsg(''); setThread(await getThreadAction(emp.id)); toast.success('Mensaje enviado') }
      else toast.error(r.error ?? 'Error')
    })
  }
  function remove() {
    if (!confirm('¿Quitar el acceso de este empleado?')) return
    startTransition(async () => {
      const r = await deleteEmployeeAction(emp.id)
      if (r.success) { toast.success('Acceso quitado'); onChange() } else toast.error(r.error ?? 'Error')
    })
  }

  return (
    <div className="border border-gray-100 rounded-xl">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {(emp.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{emp.name || 'Empleado'}</p>
          <p className="text-xs text-gray-400 truncate">Usuario: {emp.email ?? '—'}</p>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-50 pt-3">
          {!loaded ? (
            <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
          ) : (
            <>
              {/* Ventas del empleado */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-[11px] text-gray-400">Ventas hoy</p><p className="text-sm font-bold text-gray-900">{stats.todayCount}</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-[11px] text-gray-400">Cobrado hoy</p><p className="text-sm font-bold text-gray-900">{formatCurrency(stats.todayTotal)}</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-[11px] text-gray-400">Semana</p><p className="text-sm font-bold text-gray-900">{formatCurrency(stats.weekTotal)}</p></div>
              </div>

              {/* Datos del empleado */}
              <div className="grid grid-cols-2 gap-2">
                <Input value={meta.phone ?? ''} onChange={e => setMeta(m => ({ ...m, phone: e.target.value }))} placeholder="Teléfono" className="h-9 text-sm" />
                <Input value={meta.emergency_phone ?? ''} onChange={e => setMeta(m => ({ ...m, emergency_phone: e.target.value }))} placeholder="Tel. emergencia" className="h-9 text-sm" />
                <Input value={meta.insurance_no ?? ''} onChange={e => setMeta(m => ({ ...m, insurance_no: e.target.value }))} placeholder="N° de seguro" className="h-9 text-sm" />
                <Input value={meta.branch ?? ''} onChange={e => setMeta(m => ({ ...m, branch: e.target.value }))} placeholder="Sucursal / caja" className="h-9 text-sm" />
                <Input type="number" value={meta.salary ?? ''} onChange={e => setMeta(m => ({ ...m, salary: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Sueldo (opcional)" className="h-9 text-sm" />
                <button onClick={saveMeta} disabled={isPending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  <Save size={14} /> Guardar datos
                </button>
              </div>

              {/* Chat con el empleado */}
              <div className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Chat con {emp.name || 'el empleado'}</p>
                <div className="max-h-32 overflow-y-auto space-y-1.5 mb-2 flex flex-col">
                  {thread.length === 0 ? <p className="text-xs text-gray-400">Sin mensajes todavía.</p> : thread.map(t => (
                    <div key={t.id} className={`text-xs px-2.5 py-1.5 rounded-lg max-w-[85%] ${t.from_role === 'boss' ? 'bg-indigo-600 text-white self-end' : 'bg-white border border-gray-200 text-gray-700 self-start'}`}>
                      {t.message}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Escribe un mensaje…" className="h-9 text-sm" onKeyDown={e => { if (e.key === 'Enter') send() }} />
                  <button onClick={send} disabled={isPending} className="inline-flex items-center px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"><Send size={15} /></button>
                </div>
              </div>

              <button onClick={remove} disabled={isPending} className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-600">
                <Trash2 size={13} /> Quitar acceso
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
