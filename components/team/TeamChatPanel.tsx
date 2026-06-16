'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Users2, Send, Loader2 } from 'lucide-react'
import { bossSendMessageAction, getThreadAction, type TeamMessage } from '@/lib/actions/team'
import { type Employee } from '@/lib/actions/employees'
import TeamGroupChat from './TeamGroupChat'

/**
 * Panel de chat para el jefe (columna derecha de /employees): alterna entre
 * chat individual con un empleado y el chat grupal del equipo.
 */
export default function TeamChatPanel({ employees }: { employees: Employee[] }) {
  const [tab, setTab] = useState<'individual' | 'group'>('individual')

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 mb-2.5">Chats del equipo</p>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab('individual')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'individual' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
              <MessageCircle size={14} /> Con empleado
            </button>
            <button onClick={() => setTab('group')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'group' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
              <Users2 size={14} /> Grupal
            </button>
          </div>
        </div>
        {tab === 'individual' && <IndividualChat employees={employees} />}
      </div>

      {tab === 'group' && <TeamGroupChat />}
    </div>
  )
}

function IndividualChat({ employees }: { employees: Employee[] }) {
  const [empId, setEmpId] = useState<string>(employees[0]?.id ?? '')
  const [thread, setThread] = useState<TeamMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!empId && employees[0]) setEmpId(employees[0].id) }, [employees, empId])

  useEffect(() => {
    if (!empId) return
    let alive = true
    const load = async () => { setLoading(true); const t = await getThreadAction(empId); if (alive) { setThread(t); setLoading(false) } }
    load()
    const i = setInterval(load, 15000)
    return () => { alive = false; clearInterval(i) }
  }, [empId])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [thread])

  function send() {
    const m = text.trim()
    if (!m || !empId) return
    startTransition(async () => {
      const r = await bossSendMessageAction(empId, m)
      if (r.success) { setText(''); setThread(await getThreadAction(empId)) }
      else toast.error(r.error ?? 'Error')
    })
  }

  if (employees.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8 px-4">Crea un empleado para chatear en privado.</p>
  }

  return (
    <div>
      <div className="px-3 pt-3">
        <select value={empId} onChange={e => setEmpId(e.target.value)}
          className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 bg-white">
          {employees.map(e => <option key={e.id} value={e.id}>{e.name || 'Empleado'}</option>)}
        </select>
      </div>
      <div ref={scrollRef} className="max-h-72 overflow-y-auto p-3 space-y-2 flex flex-col bg-gray-50/40">
        {loading && thread.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
        ) : thread.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Sin mensajes. Escribe el primero.</p>
        ) : thread.map(m => (
          <div key={m.id} className={`flex flex-col max-w-[85%] ${m.from_role === 'boss' ? 'self-end items-end' : 'self-start items-start'}`}>
            <div className={`text-sm px-3 py-1.5 rounded-2xl ${m.from_role === 'boss' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'}`}>{m.message}</div>
            <span className="text-[9px] text-gray-300 mt-0.5 px-1">{new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t border-gray-100">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Escribe un mensaje…" className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <button onClick={send} disabled={isPending} className="inline-flex items-center justify-center w-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  )
}
