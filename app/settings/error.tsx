'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function SettingsError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[SETTINGS ERROR]', error) }, [error])

  return (
    <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={26} className="text-amber-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">No se pudo cargar Configuración</h2>
      <p className="text-sm text-gray-500 mt-1.5">
        Ocurrió un error temporal. Intenta de nuevo; si continúa, recarga la página.
      </p>
      {error.digest && <p className="text-[11px] text-gray-300 mt-2">Ref: {error.digest}</p>}
      <div className="flex items-center justify-center gap-2 mt-5">
        <button onClick={reset}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          <RefreshCw size={15} /> Reintentar
        </button>
        <Link href="/dashboard"
          className="inline-flex items-center px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
          Ir a Ganancias
        </Link>
      </div>
    </div>
  )
}
