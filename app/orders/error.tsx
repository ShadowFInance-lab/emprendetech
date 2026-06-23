'use client'

import { Inbox, RefreshCw } from 'lucide-react'

/** Límite de error de la ruta /orders: muestra un mensaje amable en vez de
 *  "Application error" si algo falla en el cliente. */
export default function OrdersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-md mx-auto text-center py-20 space-y-3">
      <span className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto"><Inbox size={28} /></span>
      <p className="font-semibold text-gray-800">No se pudieron cargar los pedidos</p>
      <p className="text-sm text-gray-500">Vuelve a intentarlo. Si no tienes pedidos aún, esto se mostrará vacío.</p>
      <button onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
        <RefreshCw size={15} /> Reintentar
      </button>
    </div>
  )
}
