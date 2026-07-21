'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Search } from 'lucide-react'

export default function RastreoSearchPage() {
  const router = useRouter()
  const [code, setCode] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c) router.push(`/rastreo/${encodeURIComponent(c)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
            <Package size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rastrea tu pedido</h1>
          <p className="text-gray-500 text-sm mt-1">Escribe el número de tu pedido (empieza con MB-).</p>
        </div>
        <form onSubmit={go} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="MB-XXXXXX" autoFocus
            className="w-full h-12 px-4 text-center text-lg font-mono font-bold tracking-wider border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 uppercase" />
          <button type="submit"
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">
            <Search size={18} /> Rastrear
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">
          El número de pedido llega en tu confirmación de compra y en el correo de envío.
        </p>
      </div>
    </div>
  )
}
