'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessagesSquare, Send, Loader2, RefreshCw } from 'lucide-react'
import { getGroupThreadAction, sendGroupMessageAction, type GroupMessage } from '@/lib/actions/team'
import { playNotificationSound, getSavedNotifSound, getSavedVolume } from '@/lib/utils/notificationSounds'

/**
 * Chat grupal del equipo (un solo hilo compartido entre el jefe y todos sus
 * empleados). Se usa igual en el panel del jefe (/employees) y en el POS del
 * empleado: el rol y el equipo se resuelven en el servidor por RLS.
 */
export default function TeamGroupChat({ compact = false }: { compact?: boolean }) {
  const [meId, setMeId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const lastCount = useRef(0)
  const inited = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function load() {
    const { meId: id, messages: msgs } = await getGroupThreadAction()
    setMeId(id)
    // Sonido cuando llega un mensaje nuevo de OTRA persona
    const fromOthers = msgs.filter(m => m.sender_id !== id)
    if (inited.current && fromOthers.length > lastCount.current) {
      try { playNotificationSound(getSavedNotifSound(), getSavedVolume()) } catch { /* noop */ }
    }
    lastCount.current = fromOthers.length
    inited.current = true
    setMessages(msgs)
    setLoaded(true)
  }
  useEffect(() => {
    load()
    const i = setInterval(load, 15000)
    return () => clearInterval(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function send() {
    const m = text.trim()
    if (!m) return
    startTransition(async () => {
      const r = await sendGroupMessageAction(m)
      if (r.success) { setText(''); load() }
      else toast.error(r.error ?? 'Error')
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-600">
        <MessagesSquare size={17} className="text-white" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white leading-tight">Chat del equipo</p>
          <p className="text-[11px] text-white/70">Grupal · jefe y empleados</p>
        </div>
        <button onClick={load} className="text-white/80 hover:text-white" title="Actualizar" aria-label="Actualizar">
          <RefreshCw size={15} />
        </button>
      </div>

      <div ref={scrollRef} className={`${compact ? 'max-h-48' : 'max-h-72'} overflow-y-auto p-3 space-y-2 flex flex-col bg-gray-50/40`}>
        {!loaded ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Sin mensajes todavía. Escribe el primero 👋</p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === meId
            return (
              <div key={m.id} className={`flex flex-col max-w-[80%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                {!mine && (
                  <span className="text-[10px] font-semibold text-gray-400 mb-0.5 px-1 flex items-center gap-1">
                    {m.sender_name || 'Equipo'}
                    {m.sender_role === 'boss' && <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1">Jefe</span>}
                  </span>
                )}
                <div className={`text-sm px-3 py-1.5 rounded-2xl ${mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'}`}>
                  {m.message}
                </div>
                <span className="text-[9px] text-gray-300 mt-0.5 px-1">
                  {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-gray-100 bg-white">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Escribe al equipo…"
          className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button onClick={send} disabled={isPending}
          className="inline-flex items-center justify-center w-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  )
}
