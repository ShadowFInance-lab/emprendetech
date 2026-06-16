'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Bell, Send, X, Loader2 } from 'lucide-react'
import { getMyThreadAction, employeeReplyAction, markBossMessagesReadAction, type TeamMessage } from '@/lib/actions/team'
import { playNotificationSound, getSavedNotifSound, getSavedVolume } from '@/lib/utils/notificationSounds'

/**
 * Chat del empleado con su jefe (en el POS). Recibe mensajes del jefe con
 * banner + sonido y permite responder. Para dueños no muestra nada.
 */
export default function EmployeeNotices() {
  const [thread, setThread] = useState<TeamMessage[]>([])
  const [reply, setReply] = useState('')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const bossCount = useRef(0)
  const inited = useRef(false)

  async function load() {
    const t = await getMyThreadAction()
    setThread(t)
    const bossMsgs = t.filter(m => m.from_role === 'boss')
    if (inited.current && bossMsgs.length > bossCount.current) {
      try {
        const v = Math.min(1, (getSavedVolume() || 0.5) * 1.7)
        playNotificationSound(getSavedNotifSound(), v)
        setTimeout(() => { try { playNotificationSound(getSavedNotifSound(), v) } catch { /* noop */ } }, 350)
      } catch { /* noop */ }
    }
    bossCount.current = bossMsgs.length
    inited.current = true
  }
  useEffect(() => {
    load()
    const i = setInterval(load, 30000)
    return () => clearInterval(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unread = thread.filter(m => m.from_role === 'boss' && !m.read)
  const hasBoss = thread.some(m => m.from_role === 'boss')

  function sendReply() {
    if (!reply.trim()) return
    startTransition(async () => {
      const r = await employeeReplyAction(reply)
      if (r.success) { setReply(''); load(); toast.success('Mensaje enviado al jefe') }
      else toast.error(r.error ?? 'Error')
    })
  }
  function openChat() {
    setOpen(true)
    if (unread.length) markBossMessagesReadAction().then(load)
  }

  // Dueños (sin mensajes) no ven nada
  if (!hasBoss && thread.length === 0) return null

  return (
    <div>
      {unread.length > 0 && !open ? (
        <button onClick={openChat} className="w-full flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-left">
          <Bell size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-800">{unread.length} mensaje(s) del jefe</p>
            <p className="text-sm text-blue-900 truncate">{unread[unread.length - 1].message}</p>
          </div>
          <span className="text-xs text-blue-600 font-medium">Abrir chat</span>
        </button>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><Bell size={14} /> Chat con el jefe</p>
            {open && <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 mb-2 flex flex-col">
            {thread.length === 0 ? <p className="text-xs text-gray-400">Sin mensajes.</p> : thread.map(m => (
              <div key={m.id} className={`text-xs px-2.5 py-1.5 rounded-lg max-w-[85%] ${m.from_role === 'employee' ? 'bg-indigo-600 text-white self-end' : 'bg-gray-100 text-gray-700 self-start'}`}>
                {m.message}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Responder al jefe…"
              className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg" onKeyDown={e => { if (e.key === 'Enter') sendReply() }} />
            <button onClick={sendReply} disabled={isPending} className="inline-flex items-center px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
