'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Loader2, Copy, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createStripePaymentLinkAction } from '@/lib/actions/stripe'

/**
 * Cobro rápido con Stripe desde la página de Ventas: monto + concepto → genera
 * un link de pago (Checkout) y lo abre para cobrar con terminal o tarjeta.
 * Reutiliza la cuenta de Stripe conectada (Stripe Connect) del comercio.
 */
export default function StripeChargeLink({
  title = 'Cobro rápido con Stripe',
  buttonLabel = 'Generar link de pago Stripe',
}: { title?: string; buttonLabel?: string } = {}) {
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function generate() {
    const amt = parseFloat(amount)
    if (!(amt > 0)) { toast.error('Escribe un monto válido'); return }
    setLoading(true); setUrl('')
    const res = await createStripePaymentLinkAction({ amount: amt, concept: concept || 'Cobro en tienda' })
    setLoading(false)
    if (res.success && res.url) {
      setUrl(res.url)
      window.open(res.url, '_blank', 'noopener')
      toast.success('Link de pago abierto — cobra con terminal o tarjeta')
    } else {
      toast.error(res.error ?? 'No se pudo generar el link')
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success('Link copiado') }
    catch { toast.error('No se pudo copiar') }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-200 ring-1 ring-indigo-100 p-4">
      <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3">
        <CreditCard size={16} className="text-indigo-600" /> {title}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">Monto (MXN)</label>
          <Input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-10 w-32 text-sm" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">Concepto</label>
          <Input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej. Venta en mostrador" className="h-10 text-sm" />
        </div>
        <button type="button" onClick={generate} disabled={loading}
          className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5 shadow transition">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} {buttonLabel}
        </button>
      </div>
      {url && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 px-2.5 py-1.5">
          <span className="text-xs text-indigo-700 truncate flex-1">{url}</span>
          <button type="button" onClick={copy} className="text-gray-500 hover:text-indigo-600" title="Copiar"><Copy size={14} /></button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-600" title="Abrir"><ExternalLink size={14} /></a>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">Abre Stripe Checkout para cobrar con tarjeta o terminal. Requiere conectar tu cuenta de Stripe en Configuración.</p>
    </div>
  )
}
