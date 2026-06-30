'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Wallet, Check, Trash2 } from 'lucide-react'
import { getStorePaymentStatus, clearStorePaymentTokenAction } from '@/lib/actions/payments'

/**
 * Cuenta de Mercado Pago de la tienda — SOLO para cobrar ventas de productos.
 * Las suscripciones de plan se cobran con la cuenta de la plataforma (no aquí).
 */
export default function StorePaymentSection() {
  const [configured, setConfigured] = useState(false)
  const [ready, setReady] = useState(false)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    const res = await getStorePaymentStatus()
    setConfigured(res.configured)
    setReady(true)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  // Avisos al volver del OAuth de Mercado Pago (?mp=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mp = params.get('mp')
    if (!mp) return
    if (mp === 'ok') { toast.success('Cuenta de Mercado Pago conectada'); refresh() }
    else if (mp === 'cfg') toast('Para conectar con OAuth, el administrador debe configurar MERCADOPAGO_CLIENT_ID / SECRET. Contacta al admin si ves este mensaje.', { duration: 8000, icon: 'ℹ️' })
    else if (mp === 'err') toast.error('No se pudo conectar Mercado Pago. Intenta de nuevo.')
    params.delete('mp')
    const qs = params.toString()
    window.history.replaceState({}, '', `/settings${qs ? `?${qs}` : ''}`)
  }, [refresh])

  function clear() {
    if (!confirm('¿Desconectar tu cuenta de Mercado Pago para ventas?')) return
    startTransition(async () => {
      const res = await clearStorePaymentTokenAction()
      if (res.success) { toast.success('Cuenta desconectada'); refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center">
          <Wallet size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Pagos con Mercado Pago</p>
          <p className="text-xs text-gray-400">Conecta tu cuenta para cobrar pedidos online directamente con Mercado Pago (el dinero va a tu cuenta).</p>
        </div>
      </div>

      {ready && configured ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-sm text-green-700 flex items-center gap-2"><Check size={16} /> Cuenta de Mercado Pago conectada</span>
          <button type="button" onClick={clear} disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
            <Trash2 size={13} /> Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => window.location.href = '/api/oauth/mercadopago/start'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl text-base flex items-center justify-center gap-2"
          >
            <Wallet size={18} /> Conectar mi cuenta de Mercado Pago
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Inicia sesión en Mercado Pago y autoriza la app. No necesitas pegar tokens manuales.
          </p>
          <p className="text-[10px] text-gray-400 text-center">
            (Requiere configuración de MERCADOPAGO_CLIENT_ID / SECRET en el entorno para OAuth completo.)
          </p>
        </div>
      )}
    </div>
  )
}
