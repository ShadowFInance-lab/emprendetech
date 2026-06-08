'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCheckoutAction } from '@/lib/actions/subscriptions'
import type { Plan } from '@/lib/types'

interface Props {
  plan: Plan
  label: string
  accent?: string
}

export default function UpgradeButton({ plan, label, accent }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleUpgrade() {
    startTransition(async () => {
      const result = await createCheckoutAction(plan)
      if (result.success && result.checkoutUrl) {
        // Pago en Mercado Pago (Checkout Pro). El webhook activa el plan al aprobar.
        window.location.href = result.checkoutUrl
      } else {
        toast.error(result.error ?? 'Error al iniciar el pago')
      }
    })
  }

  return (
    <Button onClick={handleUpgrade} disabled={isPending} className={`w-full border-0 text-white hover:opacity-90 ${accent ?? ''}`}>
      {isPending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirigiendo…</>
      ) : (
        label
      )}
    </Button>
  )
}
