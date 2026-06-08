'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCheckoutAction } from '@/lib/actions/subscriptions'
import type { Plan } from '@/lib/types'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY

interface Props {
  plan: Plan
  label: string
  accent?: string
}

/**
 * Checkout Bricks (Wallet Brick) de Mercado Pago: embebe el pago en la app.
 * Carga el SDK dinámicamente (cliente). Si no hay public key, hace fallback
 * al checkout por redirección.
 */
export default function MpBrick({ plan, label, accent }: Props) {
  const [preferenceId, setPreferenceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Wallet, setWallet] = useState<any>(null)

  // Cargar e inicializar el SDK de MP en el cliente
  useEffect(() => {
    if (!PUBLIC_KEY) return
    let active = true
    import('@mercadopago/sdk-react')
      .then((mod) => {
        if (!active) return
        try { mod.initMercadoPago(PUBLIC_KEY as string) } catch { /* noop */ }
        setWallet(() => mod.Wallet)
      })
      .catch(() => { /* SDK no disponible */ })
    return () => { active = false }
  }, [])

  async function start() {
    setLoading(true)
    const r = await createCheckoutAction(plan)
    setLoading(false)
    if (!r.success) {
      toast.error(r.error ?? 'No se pudo iniciar el pago')
      return
    }
    // Si tenemos SDK + preferenceId → pago embebido (Brick). Si no → redirección.
    if (PUBLIC_KEY && Wallet && r.preferenceId) {
      setPreferenceId(r.preferenceId)
    } else if (r.checkoutUrl) {
      window.location.href = r.checkoutUrl
    } else {
      toast.error('No se pudo generar el pago')
    }
  }

  if (preferenceId && Wallet) {
    return (
      <div className="pt-1">
        <Wallet initialization={{ preferenceId }} />
        <p className="text-[11px] text-gray-400 text-center mt-1">Pago seguro con Mercado Pago.</p>
      </div>
    )
  }

  return (
    <Button onClick={start} disabled={loading} className={`w-full border-0 text-white hover:opacity-90 ${accent ?? ''}`}>
      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando pago…</> : label}
    </Button>
  )
}
