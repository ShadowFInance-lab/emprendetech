'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { ClipboardCheck, Plus, Trash2, Loader2, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createTaskAction, listTasksBossAction, toggleTaskAction, deleteTaskAction, type Task } from '@/lib/actions/tasks'
import { type Employee } from '@/lib/actions/employees'

/** Jefe: crea y asigna tareas a empleados; ve el estado de cumplimiento. */
export default function TasksManager({ employees }: { employees: Employee[] }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [due, setDue] = useState('')
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => { setTasks(await listTasksBossAction()); setLoading(false) }, [])
  useEffect(() => { refresh() }, [refresh])

  const nameOf = (id: string | null) => id ? (employees.find(e => e.id === id)?.name ?? 'Empleado') : 'Sin asignar'

  function add() {
    if (!title.trim()) { toast.error('Escribe la tarea'); return }
    startTransition(async () => {
      const r = await createTaskAction({ title, assignedTo: assignTo || undefined, dueDate: due || undefined })
      if (r.success) { setTitle(''); setDue(''); toast.success('Tarea creada'); refresh() } else toast.error(r.error ?? 'Error')
    })
  }
  function toggle(t: Task) {
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))
    startTransition(async () => { await toggleTaskAction(t.id, !t.done) })
  }
  function remove(id: string) {
    setTasks(ts => ts.filter(x => x.id !== id))
    startTransition(async () => { await deleteTaskAction(id) })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><ClipboardCheck size={16} className="text-indigo-600" /> Tareas del equipo</p>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Ej. Limpiar bodega, contar caja…" className="h-9 text-sm flex-1" />
        <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="h-9 text-sm border border-gray-200 rounded-lg px-2 bg-white sm:w-40">
          <option value="">Sin asignar</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name || 'Empleado'}</option>)}
        </select>
        <Input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-9 text-sm sm:w-36" />
        <button onClick={add} disabled={isPending} className="h-9 px-3 inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />} Crear
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">Sin tareas. Crea y asigna la primera.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(t => (
            <div key={t.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${t.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
              <button onClick={() => toggle(t)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                {t.done && <Check size={13} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                <p className="text-[11px] text-gray-400">{nameOf(t.assigned_to)}{t.due_date ? ` · vence ${t.due_date}` : ''}</p>
              </div>
              <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
