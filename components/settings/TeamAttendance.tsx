'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Loader2, FileSpreadsheet, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getTeamAttendance, saveAttendanceNoteAction, type AttendanceRow } from '@/lib/actions/attendance'
import { listEmployeesAction, type Employee } from '@/lib/actions/employees'

export default function TeamAttendance() {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [emps, setEmps] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setLoading(true)
    const [r, e] = await Promise.all([getTeamAttendance(7), listEmployeesAction()])
    setRows(r); setEmps(e)
    const n: Record<string, string> = {}; r.forEach(x => { n[x.id] = x.note ?? '' }); setNotes(n)
    setLoading(false)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const nameOf = (id: string) => emps.find(e => e.id === id)?.name ?? 'Empleado'
  const fmt = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

  function saveNote(id: string) {
    startTransition(async () => {
      const r = await saveAttendanceNoteAction(id, notes[id] ?? '')
      if (r.success) toast.success('Nota guardada'); else toast.error(r.error ?? 'Error')
    })
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const data = rows.map(r => ({
      Empleado: nameOf(r.employee_id), Fecha: r.work_date,
      Entrada: fmt(r.check_in), Salida: fmt(r.check_out),
      Estado: r.check_in ? 'Presente' : 'Ausente', Nota: r.note ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Empleado: '', Fecha: '', Entrada: '', Salida: '', Estado: '', Nota: '' }])
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')
    XLSX.writeFile(wb, `asistencia-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <CalendarClock size={15} className="text-indigo-600" /> Asistencia (últimos 7 días)
        </p>
        <button onClick={exportExcel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100">
          <FileSpreadsheet size={13} /> Exportar Excel
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin registros de asistencia todavía. Los empleados marcan entrada/salida desde su POS.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-2.5">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-medium text-gray-900">{nameOf(r.employee_id)}</span>
                <span className="text-xs text-gray-400">{r.work_date}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.check_in ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.check_in ? 'Presente' : 'Ausente'}
                </span>
                <span className="text-xs text-gray-500 ml-auto">⬇ {fmt(r.check_in)} · ⬆ {fmt(r.check_out)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input value={notes[r.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Nota (ej. llegó tarde, cita médica)…" className="h-8 text-xs" />
                <button onClick={() => saveNote(r.id)} disabled={isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                  <Save size={13} /> Guardar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
