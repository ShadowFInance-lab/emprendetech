'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { ClipboardCheck, Check, CalendarClock } from 'lucide-react'
import { listMyTasksAction, toggleTaskAction, type Task } from '@/lib/actions/tasks'

/** Empleado: sus tareas asignadas (en la sección Mensajes). */
export default function MyTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loaded, setLoaded] = useState(false)
  const [, startTransition] = useTransition()

  const refresh = useCallback(async () => { setTasks(await listMyTasksAction()); setLoaded(true) }, [])
  useEffect(() => {
    refresh()
    const i = setInterval(refresh, 30000)
    return () => clearInterval(i)
  }, [refresh])

  function toggle(t: Task) {
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))
    startTransition(async () => { const r = await toggleTaskAction(t.id, !t.done); if (r.success && !t.done) toast.success('¡Tarea completada!') })
  }

  if (!loaded || tasks.length === 0) return null
  const pending = tasks.filter(t => !t.done).length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-2"><ClipboardCheck size={16} className="text-indigo-600" /> Mis tareas {pending > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5">{pending} pendiente(s)</span>}</p>
      <div className="space-y-1.5">
        {tasks.map(t => (
          <div key={t.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${t.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
            <button onClick={() => toggle(t)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
              {t.done && <Check size={13} className="text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
              {t.due_date && <p className="text-[11px] text-gray-400 flex items-center gap-1"><CalendarClock size={11} /> vence {t.due_date}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
