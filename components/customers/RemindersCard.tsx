'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Bell, Plus, Check, Trash2, Loader2, CalendarClock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  createReminderAction,
  toggleReminderAction,
  deleteReminderAction,
  type Reminder,
} from '@/lib/actions/reminders'

interface Props {
  customerId: string
  initialReminders: Reminder[]
  missingTable?: boolean
}

export default function RemindersCard({ customerId, initialReminders, missingTable }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    if (!title.trim()) {
      toast.error('Escribe qué quieres recordar')
      return
    }
    startTransition(async () => {
      const result = await createReminderAction({
        customer_id: customerId,
        title: title.trim(),
        due_date: dueDate || undefined,
        due_time: dueTime || undefined,
      })
      if (result.success) {
        // Optimista: agregar a la lista (se confirma al refrescar)
        setReminders(prev => [
          {
            id: crypto.randomUUID(),
            store_id: '',
            customer_id: customerId,
            title: title.trim(),
            due_date: dueDate || null,
            due_time: dueTime || null,
            done: false,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ])
        setTitle('')
        setDueDate('')
        setDueTime('')
        toast.success('Recordatorio agregado')
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  function toggle(r: Reminder) {
    setReminders(prev => prev.map(x => (x.id === r.id ? { ...x, done: !x.done } : x)))
    startTransition(async () => {
      const result = await toggleReminderAction(r.id, !r.done)
      if (!result.success) {
        setReminders(prev => prev.map(x => (x.id === r.id ? { ...x, done: r.done } : x)))
        toast.error(result.error ?? 'Error')
      }
    })
  }

  function remove(id: string) {
    const prev = reminders
    setReminders(p => p.filter(x => x.id !== id))
    startTransition(async () => {
      const result = await deleteReminderAction(id)
      if (!result.success) {
        setReminders(prev)
        toast.error(result.error ?? 'Error')
      }
    })
  }

  function fmtDate(d: string | null) {
    if (!d) return null
    const date = new Date(d + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.round((date.getTime() - today.getTime()) / 86400000)
    const label = date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    if (diff === 0) return { label: 'Hoy', urgent: true }
    if (diff === 1) return { label: 'Mañana', urgent: true }
    if (diff < 0) return { label: `Atrasado (${label})`, urgent: true }
    return { label, urgent: false }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell size={16} className="text-amber-500" /> Recordatorios de entrega
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {missingTable ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              Para activar los recordatorios, ejecuta la migración{' '}
              <code className="bg-amber-100 px-1 rounded">008_reminders.sql</code> en Supabase → SQL Editor.
            </span>
          </div>
        ) : (
          <>
            {/* Agregar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()}
                placeholder="Ej: Entregar pedido de collares"
                className="flex-1"
              />
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="sm:w-36"
                title="Fecha de entrega"
              />
              <Input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="sm:w-28"
                title="Hora (alarma)"
              />
              <Button type="button" onClick={add} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Agregar
              </Button>
            </div>

            {/* Lista */}
            {reminders.length > 0 ? (
              <div className="space-y-1.5">
                {reminders.map(r => {
                  const d = fmtDate(r.due_date)
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                        r.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(r)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          r.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                        }`}
                        aria-label={r.done ? 'Marcar pendiente' : 'Marcar hecho'}
                      >
                        {r.done && <Check size={13} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${r.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {r.title}
                        </p>
                        {(d || r.due_time) && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              r.done ? 'text-gray-300' : d?.urgent ? 'text-red-500' : 'text-gray-400'
                            }`}
                          >
                            <CalendarClock size={11} />
                            {d ? d.label : 'Sin fecha'}{r.due_time ? ` · ${r.due_time.slice(0, 5)}` : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-gray-300 hover:text-red-500 flex-shrink-0"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3">
                Sin recordatorios. Agenda entregas o seguimientos para este cliente.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
