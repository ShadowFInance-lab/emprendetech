'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { BellRing, Check, Clock, Loader2 } from 'lucide-react'
import { getMyAssignedReminders, markMyAssignedReminderDone, type DueReminder } from '@/lib/actions/reminders'
import { playNotificationSound, getSavedNotifSound, getSavedVolume } from '@/lib/utils/notificationSounds'

/**
 * Recordatorios de entrega asignados al empleado (en el POS). Muestra los
 * pendientes, suena la alarma cuando llega su fecha/hora y permite marcarlos
 * como hechos. El jefe NO recibe alarma de éstos (solo el empleado asignado).
 */
export default function EmployeeReminders() {
  const [items, setItems] = useState<DueReminder[]>([])
  const [, force] = useState(0)
  const [isPending, startTransition] = useTransition()
  const seenRef = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try { setItems(await getMyAssignedReminders()) } catch { /* noop */ }
  }, [])

  useEffect(() => {
    refresh()
    const a = setInterval(refresh, 30000)
    const b = setInterval(() => force(n => n + 1), 20000) // recalcular "vencido"
    return () => { clearInterval(a); clearInterval(b) }
  }, [refresh])

  function isDue(r: DueReminder) {
    if (!r.due_date) return false
    const time = (r.due_time || '23:59').slice(0, 5)
    const due = new Date(`${r.due_date}T${time}:00`)
    if (Number.isNaN(due.getTime())) return new Date(`${r.due_date}T23:59:59`).getTime() <= Date.now()
    return due.getTime() <= Date.now()
  }
  const dueList = items.filter(isDue)
  const hasUnseen = dueList.some(r => !seenRef.current.has(r.id))

  const playBeep = useCallback(() => {
    const v = Math.min(1, (getSavedVolume() || 0.5) * 1.7)
    playNotificationSound(getSavedNotifSound(), v)
    setTimeout(() => { try { playNotificationSound(getSavedNotifSound(), v) } catch { /* noop */ } }, 350)
  }, [])

  useEffect(() => {
    if (!hasUnseen) return
    playBeep()
    const t = setInterval(playBeep, 12000)
    return () => clearInterval(t)
  }, [hasUnseen, playBeep])

  function markSeen() { dueList.forEach(r => seenRef.current.add(r.id)) }

  function markDone(id: string) {
    seenRef.current.add(id)
    setItems(prev => prev.filter(r => r.id !== id))
    startTransition(async () => {
      const r = await markMyAssignedReminderDone(id)
      if (r.success) toast.success('Recordatorio completado')
      else { toast.error(r.error ?? 'Error'); refresh() }
    })
  }

  if (items.length === 0) return null

  const urgent = dueList.length > 0

  return (
    <div className={`rounded-xl border p-3 ${urgent ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`} onClick={markSeen}>
      <p className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2 ${urgent ? 'text-amber-700' : 'text-gray-600'}`}>
        <BellRing size={14} className={urgent && hasUnseen ? 'animate-bounce' : ''} /> Mis entregas asignadas
      </p>
      <div className="space-y-1.5">
        {items.map(r => {
          const due = isDue(r)
          return (
            <div key={r.id} className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${due ? 'bg-white border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${due ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  <Clock size={11} />
                  {r.due_date}{r.due_time ? ` · ${r.due_time.slice(0, 5)}` : ''}
                  {r.customer_name ? ` · ${r.customer_name}` : ''}
                  {due ? ' · ¡Ahora!' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => markDone(r.id)}
                disabled={isPending}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Hecho
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
