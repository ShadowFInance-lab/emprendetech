'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Check, Clock, CalendarClock } from 'lucide-react'
import { getActiveReminders, toggleReminderAction, type DueReminder } from '@/lib/actions/reminders'
import { playNotificationSound, getSavedNotifSound } from '@/lib/utils/notificationSounds'

export default function NotificationBell() {
  const [active, setActive] = useState<DueReminder[]>([])
  const [open, setOpen] = useState(false)
  const [, force] = useState(0) // para recalcular "due" con el tiempo
  const seenRef = useRef<Set<string>>(new Set())

  // ¿Ya llegó su fecha/hora? (se evalúa con la hora LOCAL del usuario)
  function isDue(r: DueReminder) {
    if (!r.due_date) return false
    // due_time de la BD puede venir como "HH:MM:SS"; normalizamos a "HH:MM"
    const time = (r.due_time || '23:59').slice(0, 5)
    const due = new Date(`${r.due_date}T${time}:00`)
    if (Number.isNaN(due.getTime())) {
      // fallback: comparar solo por fecha
      return new Date(`${r.due_date}T23:59:59`).getTime() <= Date.now()
    }
    return due.getTime() <= Date.now()
  }
  const dueList = active.filter(isDue)
  const hasUnseen = dueList.some((r) => !seenRef.current.has(r.id))

  const playBeep = useCallback(() => {
    playNotificationSound(getSavedNotifSound())
  }, [])

  const refresh = useCallback(async () => {
    try { setActive(await getActiveReminders()) } catch { /* noop */ }
  }, [])

  // Cargar + refrescar cada 60s; recalcular "due" cada 20s
  useEffect(() => {
    refresh()
    const a = setInterval(refresh, 60000)
    const b = setInterval(() => force((n) => n + 1), 20000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [refresh])

  // Sonar al haber recordatorios vencidos no vistos; repetir cada 12s hasta marcar visto
  useEffect(() => {
    if (!hasUnseen) return
    playBeep()
    const t = setInterval(playBeep, 12000)
    return () => clearInterval(t)
  }, [hasUnseen, playBeep])

  function toggleOpen() {
    setOpen((o) => !o)
    // al abrir, marcamos como "vistos" → detiene parpadeo y sonido
    if (!open) dueList.forEach((r) => seenRef.current.add(r.id))
  }

  async function markDone(id: string) {
    seenRef.current.add(id)
    setActive((prev) => prev.filter((r) => r.id !== id))
    try { await toggleReminderAction(id, true) } catch { /* noop */ }
  }

  const count = dueList.length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className={`relative p-2 rounded-lg transition-colors ${count > 0 ? 'hover:bg-red-50' : 'hover:bg-gray-100'}`}
        aria-label="Notificaciones"
      >
        <Bell size={18} className={count > 0 ? 'text-red-500' : 'text-gray-600'} />
        {count > 0 && (
          <span
            className={`absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold ${hasUnseen ? 'animate-ping-slow' : ''}`}
            style={hasUnseen ? { animation: 'notif-blink 1s steps(2,start) infinite' } : undefined}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* keyframes inline (parpadeo) */}
      <style>{`@keyframes notif-blink{0%,100%{opacity:1}50%{opacity:.25}}`}</style>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl ring-1 ring-black/5 z-40 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Bell size={16} className="text-red-500" />
              <p className="font-semibold text-gray-900 text-sm">Recordatorios pendientes</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {count === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  <CalendarClock size={28} className="mx-auto mb-2 text-gray-300" />
                  No tienes recordatorios vencidos.
                </div>
              ) : (
                dueList.map((r) => (
                  <div key={r.id} className="px-4 py-3 border-b border-gray-50 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        {r.due_date}{r.due_time ? ` · ${r.due_time.slice(0, 5)}` : ''}
                        {r.customer_name ? ` · ${r.customer_name}` : ''}
                      </p>
                      {r.customer_id && (
                        <Link href={`/customers/${r.customer_id}`} onClick={() => setOpen(false)}
                          className="text-[11px] text-blue-600 hover:underline">Ver cliente →</Link>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => markDone(r.id)}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg"
                    >
                      <Check size={13} /> Visto
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
