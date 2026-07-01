'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CreditCard, Check, Trash2, Link2, Copy, Loader2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getStripeConfigStatus, saveStripeConfigAction, clearStripeConfigAction, createStripePaymentLinkAction,
} from '@/lib/actions/stripe'

/**
 * Pagos con Stripe (sencillo): el comercio pega su Publishable + Secret Key,
 * se guardan server-side y se pueden generar links de pago.
 * La Secret Key nunca se muestra ni se pre-rellena desde el servidor.
 */
export default function StripePaymentSection() {
  const [pk, setPk] = useState('')
  const [sk, setSk] = useState('')
  const [configured, setConfigured] = useState(false)
  const [ready, setReady] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Generar link de pago
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  const refresh = useCallback(async () => {
    const res = await getStripeConfigStatus()
    setConfigured(res.configured)
    if (res.publishableKey) setPk(res.publishableKey)
    setReady(true)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  function save() {
    if (!pk.trim() || !sk.trim()) { toast.error('Pega la Publishable Key y la Secret Key'); return }
    startTransition(async () => {
      const res = await saveStripeConfigAction(pk, sk)
      if (res.success) { toast.success('Stripe conectado'); setSk(''); refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function disconnect() {
    if (!confirm('¿Desconectar Stripe? Se borrarán las llaves guardadas.')) return
    startTransition(async () => {
      const res = await clearStripeConfigAction()
      if (res.success) { toast.success('Stripe desconectado'); setSk(''); setLinkUrl(''); refresh() }
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
          <p className="font-semibold text-gray-900 text-[15px] leading-tight">Pagos con Stripe</p>
          <p className="text-xs text-gray-400">Pega tus llaves de Stripe para generar links de pago y cobrar tus ventas (el dinero va a tu cuenta de Stripe).</p>
        </div>
      </div>

      {ready && configured ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="text-sm text-green-700 flex items-center gap-2"><Check size={16} /> Stripe conectado</span>
            <button type="button" onClick={disconnect} disabled={isPending}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
              <Trash2 size={13} /> Desconectar
            </button>
          </div>

          {/* Generar link de pago */}
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
        <div className="space-y-2.5">
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Publishable Key</label>
            <Input value={pk} onChange={e => setPk(e.target.value)} placeholder="pk_test_..." className="h-10 text-sm font-mono" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Secret Key</label>
            <Input type="password" value={sk} onChange={e => setSk(e.target.value)} placeholder="sk_test_..." className="h-10 text-sm font-mono" autoComplete="off" />
          </div>
          <button type="button" onClick={save} disabled={isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl text-base flex items-center justify-center gap-2 shadow transition disabled:opacity-50">
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />} Guardar llaves de Stripe
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Consíguelas en Stripe → Developers → API keys. Se guardan de forma segura; la Secret Key nunca se muestra de nuevo.
          </p>
        </div>
      )}
    </div>
  )
}
