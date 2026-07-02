'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Check, Trash2 } from 'lucide-react'
import { getStripeConfigStatus, clearStripeConfigAction } from '@/lib/actions/stripe'

/**
 * Cobros con Stripe (Stripe Connect / OAuth) — SOLO conectar/desconectar la cuenta.
 * El generador de links de pago vive en la página de Ventas (/sales y /sales/new),
 * no aquí. Sin claves manuales.
 */
export default function StripePaymentSection() {
  const [connected, setConnected] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const refresh = useCallback(async () => {
    const res = await getStripeConfigStatus()
    setConnected(res.connected)
    setAccountId(res.accountId)
    setReady(true)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  // Avisos al volver del OAuth de Stripe (?stripe=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('stripe')
    if (!s) return
    if (s === 'ok') { toast.success('Cuenta de Stripe conectada'); refresh() }
    else if (s === 'cfg') toast('Falta configurar Stripe Connect (STRIPE_CONNECT_CLIENT_ID / STRIPE_SECRET_KEY) en el entorno.', { duration: 8000, icon: 'ℹ️' })
    else if (s === 'err') toast.error('No se pudo conectar Stripe. Intenta de nuevo.')
    params.delete('stripe')
    const qs = params.toString()
    window.history.replaceState({}, '', `/settings${qs ? `?${qs}` : ''}`)
  }, [refresh])

  function disconnect() {
    if (!confirm('¿Desconectar tu cuenta de Stripe?')) return
    setIsPending(true)
    clearStripeConfigAction().then(res => {
      setIsPending(false)
      if (res.success) { toast.success('Stripe desconectado'); refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <CreditCard size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Cobros con Stripe</p>
          <p className="text-xs text-gray-400">Conecta tu cuenta de Stripe para cobrar tus ventas (el dinero va directo a tu cuenta). Los links de pago se generan en la página de Ventas.</p>
        </div>
      </div>

      {ready && connected ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-sm text-green-700 flex items-center gap-2">
            <Check size={16} /> Cuenta de Stripe conectada
            {accountId && <span className="text-[11px] text-green-600/70 font-mono">({accountId.slice(0, 8)}…{accountId.slice(-4)})</span>}
          </span>
          <button type="button" onClick={disconnect} disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
            <Trash2 size={13} /> Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { window.location.href = '/api/oauth/stripe/start'; }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl text-base flex items-center justify-center gap-2 shadow transition"
          >
            <CreditCard size={18} /> Conectar cuenta de Stripe
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Inicia sesión en Stripe y autoriza la conexión. No necesitas pegar llaves manuales.
          </p>
          <p className="text-[10px] text-gray-400 text-center">
            (Requiere STRIPE_CONNECT_CLIENT_ID y STRIPE_SECRET_KEY en el entorno para el OAuth.)
          </p>
        </div>
      )}
    </div>
  )
}
