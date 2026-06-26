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

  // Avisos al volver del OAuth de Mercado Pago (?mp=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mp = params.get('mp')
    if (!mp) return
    if (mp === 'ok') { toast.success('Cuenta de Mercado Pago conectada'); refresh() }
    else if (mp === 'cfg') toast('Para el botón de conexión, el administrador debe configurar MERCADOPAGO_CLIENT_ID. Mientras tanto, pega tu Access Token.', { duration: 8000, icon: 'ℹ️' })
    else if (mp === 'err') toast.error('No se pudo conectar Mercado Pago. Intenta de nuevo o pega tu token.')
    params.delete('mp')
    const qs = params.toString()
    window.history.replaceState({}, '', `/settings${qs ? `?${qs}` : ''}`)
  }, [refresh])

  function save() {
    if (!token.trim()) { toast.error('Pega tu Access Token de Mercado Pago'); return }
    startTransition(async () => {
      const res = await saveStorePaymentTokenAction(token)
      if (res.success) { toast.success('Cuenta de cobros guardada'); setToken(''); refresh() }
      else toast.error(res.error ?? 'Error', { duration: 6000 })
    })
  }
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
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Pagos con Mercado Pago (opcional para online)</p>
          <p className="text-xs text-gray-400">Conecta para cobrar pedidos online con MP. (Contra entrega y transferencia ya funcionan sin esto.)</p>
        </div>
      </div>

      {ready && configured ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-sm text-green-700 flex items-center gap-2"><Check size={16} /> Cuenta de cobros conectada</span>
          <button onClick={clear} disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
            <Trash2 size={13} /> Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={token} onChange={e => setToken(e.target.value)} type="password"
            placeholder="Access Token de Mercado Pago (APP_USR-…)" className="h-10 text-sm" />
          <Button onClick={save} disabled={isPending} className="h-10 bg-gradient-to-r from-sky-500 to-cyan-500 hover:opacity-90">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet size={16} className="mr-1.5" /> Guardar token de cobros</>}
          </Button>
          <p className="text-[11px] text-gray-400">
            Pega tu Access Token de <span className="font-medium">Mercado Pago → Tus integraciones → tu app → Credenciales</span>. Se guarda en tu tienda y nunca se muestra en el catálogo.
          </p>

          {/* Botón visible para conectar vía OAuth (flujo recomendado) */}
          <div className="pt-2">
            <a
              href="/api/oauth/mercadopago/start"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition"
            >
              Conectar mi cuenta de Mercado Pago (OAuth)
            </a>
            <p className="text-[10px] text-gray-400 mt-1 text-center">Usa OAuth para conectar sin pegar token (requiere CLIENT_ID en Vercel).</p>
          </div>
        </div>
      )}
    </div>
  )
}
