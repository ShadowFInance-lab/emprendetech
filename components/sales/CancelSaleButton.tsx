'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { XCircle, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cancelSaleAction } from '@/lib/actions/sales'

export default function CancelSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  function confirmCancel() {
    if (!password) {
      toast.error('Ingresa tu contraseña')
      return
    }
    startTransition(async () => {
      const result = await cancelSaleAction(saleId, password)
      if (result.success) {
        toast.success('Venta cancelada. Stock devuelto.')
        setOpen(false)
        setPassword('')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al cancelar')
      }
    })
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <XCircle className="mr-2 h-4 w-4" /> Cancelar venta
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !isPending && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center">
                <ShieldCheck size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Confirmar identidad</h3>
                <p className="text-xs text-gray-500">Por seguridad, ingresa tu contraseña para cancelar.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cancel-pwd">Contraseña del dueño</Label>
              <Input
                id="cancel-pwd"
                type="password"
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmCancel() } }}
                placeholder="••••••••"
                className="h-11 rounded-xl"
              />
              <p className="text-[11px] text-gray-400">
                Devuelve el stock al inventario. Solo el dueño puede autorizar.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={confirmCancel} disabled={isPending} className="min-w-32">
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando…</> : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
