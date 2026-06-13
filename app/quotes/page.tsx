import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, AlertTriangle } from 'lucide-react'
import { getQuotes } from '@/lib/actions/quotes'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const STATUS_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  expirada: 'bg-amber-100 text-amber-700',
  convertida: 'bg-purple-100 text-purple-700',
}
const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada',
  rechazada: 'Rechazada', expirada: 'Expirada', convertida: 'Convertida',
}

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { quotes, missingTable } = await getQuotes()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-500 text-sm mt-1">{quotes.length} cotizaciones</p>
        </div>
        <Link href="/quotes/new"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nueva cotización
        </Link>
      </div>

      {missingTable && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Falta activar el módulo en la base de datos.</p>
            <p className="mt-0.5">Ejecuta <code className="bg-amber-100 px-1 rounded">supabase/migrations/015_quotes.sql</code> en Supabase → SQL Editor → Run, y recarga esta página.</p>
          </div>
        </div>
      )}

      {quotes.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Folio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-2">
                      <FileText size={15} className="text-gray-400" /> {q.folio}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{q.customer_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[q.status] ?? STATUS_BADGE.borrador}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(q.total)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{formatDate(q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !missingTable ? (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <FileText size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700">Sin cotizaciones aún</h3>
          <p className="text-gray-400 text-sm mt-1">
            Usa el botón <span className="font-medium text-gray-600">“Nueva cotización”</span> de arriba para crear la primera.
          </p>
        </div>
      ) : null}
    </div>
  )
}
