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
  variant?: 'default' | 'secondary' | 'outline'
}

export default function UpgradeButton({ plan, label, variant = 'default' }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleUpgrade() {
    startTransition(async () => {
      const result = await createCheckoutAction(plan)
      if (result.success && result.checkoutUrl) {
        // Redirigir a Mercado Pago
        window.location.href = result.checkoutUrl
      } else {
        toast.error(result.error ?? 'Error al iniciar el pago')
      }
    })
  }

  return (
    <Button onClick={handleUpgrade} disabled={isPending} variant={variant} className="w-full">
      {isPending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirigiendo...</>
      ) : (
        label
      )}
    </Button>
  )
}
