'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelSaleAction } from '@/lib/actions/sales'

export default function CancelSaleButton({ saleId, hasPin = false }: { saleId: string; hasPin?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    if (!confirm('¿Cancelar esta venta? El stock de los productos será devuelto al inventario.')) return

    let pin: string | undefined
    if (hasPin) {
      const entered = window.prompt('Ingresa el PIN de seguridad para cancelar la venta:')
      if (entered === null) return // el usuario canceló el prompt
      pin = entered
    }

    startTransition(async () => {
      const result = await cancelSaleAction(saleId, pin)
      if (result.success) {
        toast.success('Venta cancelada. Stock devuelto.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al cancelar')
      }
    })
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <XCircle className="mr-2 h-4 w-4" />
      )}
      Cancelar venta
    </Button>
  )
}
