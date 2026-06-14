'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Wallet, Loader2, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStorePaymentStatus, saveStorePaymentTokenAction, clearStorePaymentTokenAction } from '@/lib/actions/payments'

/**
 * Cuenta de Mercado Pago de la tienda — SOLO para cobrar ventas de productos.
 * Las suscripciones de plan se cobran con la cuenta de la plataforma (no aquí).
 */
export default function StorePaymentSection() {
  const [configured, setConfigured] = useState(false)
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState('')
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    const res = await getStorePaymentStatus()
    setConfigured(res.configured)
    setReady(true)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  function save() {
    if (!token.trim()) { toast.error('Pega tu Access Token de Mercado Pago'); return }
    startTransition(async () => {
      const res = await saveStorePaymentTokenAction(token)
      if (res.success) { toast.success('Cuenta de cobros guardada'); setToken(''); refresh() }
      else toast.error(res.error ?? 'Error', { duration: 6000 })
    })
  }
  function clear() {
    if (!confirm('¿Quitar tu cuenta de Mercado Pago para ventas?')) return
    startTransition(async () => {
      const res = await clearStorePaymentTokenAction()
      if (res.success) { toast.success('Cuenta quitada'); refresh() }
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
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Cobros de tus ventas (Mercado Pago)</p>
          <p className="text-xs text-gray-400">El dinero de tus ventas llega a TU cuenta. Las suscripciones de plan se cobran aparte.</p>
        </div>
      </div>

      {ready && configured && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-green-700 flex items-center gap-2"><Check size={15} /> Cuenta de cobros conectada</span>
          <button onClick={clear} disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
            <Trash2 size={13} /> Quitar
          </button>
        </div>
      )}

      <div className="space-y-2">
        <Input value={token} onChange={e => setToken(e.target.value)} type="password"
          placeholder={configured ? 'Pega un nuevo Access Token para reemplazar' : 'Access Token de Mercado Pago (APP_USR-…)'}
          className="h-10 text-sm" />
        <Button onClick={save} disabled={isPending} className="h-10 bg-gradient-to-r from-sky-500 to-cyan-500 hover:opacity-90">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet size={16} className="mr-1.5" /> {configured ? 'Actualizar cuenta' : 'Conectar cuenta de cobros'}</>}
        </Button>
        <p className="text-[11px] text-gray-400">
          Lo obtienes en <span className="font-medium">Mercado Pago → Tus integraciones → tu app → Credenciales</span> (Access Token).
          Se guarda cifrado en tu tienda y nunca se muestra en el catálogo. Empleados cobran a esta misma cuenta.
        </p>
      </div>
    </div>
  )
}
