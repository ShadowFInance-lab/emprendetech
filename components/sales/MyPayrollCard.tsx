'use client'

import { useEffect, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { getMyPayrollAction, type PayrollRow } from '@/lib/actions/payroll'
import { formatCurrency } from '@/lib/utils/format'

/** Registro del empleado (solo lectura): días, sueldo base, descuento y neto. */
export default function MyPayrollCard() {
  const [row, setRow] = useState<PayrollRow | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { getMyPayrollAction('week').then(setRow) }, [])
  if (!row) return null

  const fmt = (s: string | null) => s ? new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 p-3 text-left">
        <Wallet size={16} className="text-indigo-500 flex-shrink-0" />
        <span className="text-sm text-gray-700">Mi registro (semana): <b>{row.daysPresent} días</b> · Neto <b>{formatCurrency(row.net)}</b></span>
        <ChevronDown size={16} className={`text-gray-400 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-50 pt-2">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Sueldo base</p><p className="font-bold text-gray-900">{formatCurrency(row.base)}</p></div>
            <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Descuento</p><p className="font-bold text-gray-900">{formatCurrency(row.discount)}</p></div>
            <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Neto</p><p className="font-bold text-gray-900">{formatCurrency(row.net)}</p></div>
          </div>
          <div className="space-y-1">
            {row.days.length === 0 ? <p className="text-xs text-gray-400">Sin registros esta semana.</p> : row.days.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                <span>{d.date}</span>
                <span>⬇ {fmt(d.checkIn)} · ⬆ {fmt(d.checkOut)}{d.note ? ` · ${d.note}` : ''}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">Solo lectura · tu jefe gestiona la nómina.</p>
        </div>
      )}
    </div>
  )
}
