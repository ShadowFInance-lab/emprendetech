'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Check, Trash2, Link2, Copy, Loader2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getStripeConfigStatus, clearStripeConfigAction, createStripePaymentLinkAction,
} from '@/lib/actions/stripe'

/**
 * Pagos con Stripe vía Stripe Connect (OAuth) — sin claves manuales.
 * El comercio conecta su cuenta con un botón; guardamos su account_id y con él
 * se generan links de pago (destination charges) usando la clave de plataforma.
 */
export default function StripePaymentSection() {
  const [connected, setConnected] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [isPending, setIsPending] = useState(false)

  // Generar link de pago
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

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
      if (res.success) { toast.success('Stripe desconectado'); setLinkUrl(''); refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  async function generateLink() {
    const amt = parseFloat(amount)
    if (!(amt > 0)) { toast.error('Escribe un monto válido'); return }
    setLinkLoading(true); setLinkUrl('')
    const res = await createStripePaymentLinkAction({ amount: amt, concept: concept || 'Pago' })
    setLinkLoading(false)
    if (res.success && res.url) { setLinkUrl(res.url); toast.success('Link de pago generado') }
    else toast.error(res.error ?? 'No se pudo generar el link')
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(linkUrl); toast.success('Link copiado') }
    catch { toast.error('No se pudo copiar') }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <CreditCard size={17} className="text-white" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Cobros con Stripe</p>
          <p className="text-xs text-gray-400">Conecta tu cuenta de Stripe para generar links de pago y cobrar tus ventas (el dinero va directo a tu cuenta).</p>
        </div>
      </div>

      {ready && connected ? (
        <div className="space-y-3">
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

          {/* Generar link de pago (destination charge a tu cuenta) */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Link2 size={13} /> Generar link de pago</p>
            <div className="flex flex-wrap gap-2">
              <Input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto (MXN)" className="h-9 text-sm w-32" />
              <Input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Concepto (opcional)" className="h-9 text-sm flex-1 min-w-[160px]" />
              <button type="button" onClick={generateLink} disabled={linkLoading}
                className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                {linkLoading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Crear link
              </button>
            </div>
            {linkUrl && (
              <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5">
                <span className="text-xs text-indigo-700 truncate flex-1">{linkUrl}</span>
                <button type="button" onClick={copyLink} className="text-gray-500 hover:text-indigo-600" title="Copiar"><Copy size={14} /></button>
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-600" title="Abrir"><ExternalLink size={14} /></a>
              </div>
            )}
          </div>
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
