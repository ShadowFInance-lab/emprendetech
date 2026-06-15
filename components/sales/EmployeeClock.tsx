'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { LogIn, LogOut, Clock, Loader2 } from 'lucide-react'
import { clockInAction, clockOutAction, getMyTodayAttendance, type AttendanceRow } from '@/lib/actions/attendance'

/** Reloj de entrada/salida para el empleado (se muestra en su POS). */
export default function EmployeeClock() {
  const [row, setRow] = useState<AttendanceRow | null>(null)
  const [ready, setReady] = useState(false)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => { setRow(await getMyTodayAttendance()); setReady(true) }, [])
  useEffect(() => { refresh() }, [refresh])

  function clockIn() {
    startTransition(async () => {
      const r = await clockInAction()
      if (r.success) { toast.success('Entrada registrada'); refresh() } else toast.error(r.error ?? 'Error')
    })
  }
  function clockOut() {
    startTransition(async () => {
      const r = await clockOutAction()
      if (r.success) { toast.success('Salida registrada'); refresh() } else toast.error(r.error ?? 'Error')
    })
  }

  const fmt = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Clock size={16} className="text-indigo-500" />
        <span>Entrada: <b className="text-gray-900">{fmt(row?.check_in ?? null)}</b></span>
        <span className="text-gray-300">·</span>
        <span>Salida: <b className="text-gray-900">{fmt(row?.check_out ?? null)}</b></span>
      </div>
      <div className="flex gap-2">
        <button onClick={clockIn} disabled={isPending || !ready || !!row?.check_in}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />} Marcar entrada
        </button>
        <button onClick={clockOut} disabled={isPending || !ready || !row?.check_in || !!row?.check_out}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Marcar salida
        </button>
      </div>
    </div>
  )
}
