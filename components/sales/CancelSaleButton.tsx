'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelSaleAction } from '@/lib/actions/sales'

export default function CancelSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    if (!confirm('¿Cancelar esta venta? El stock de los productos será devuelto al inventario.')) return

    startTransition(async () => {
      const result = await cancelSaleAction(saleId)
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
