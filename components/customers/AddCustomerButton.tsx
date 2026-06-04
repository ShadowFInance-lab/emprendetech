'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { createCustomerAction } from '@/lib/actions/customers'

export default function AddCustomerButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createCustomerAction(formData)
      if (result.success) {
        toast.success('Cliente agregado')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al agregar')
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> Nuevo cliente
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-600" /> Nuevo cliente
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nombre *</Label>
            <Input id="c-name" name="name" placeholder="Nombre del cliente" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Teléfono</Label>
              <Input id="c-phone" name="phone" type="tel" placeholder="+52 55..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Correo</Label>
              <Input id="c-email" name="email" type="email" placeholder="correo@ejemplo.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-address">Dirección</Label>
            <Input id="c-address" name="address" placeholder="Calle, colonia, ciudad" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notas</Label>
            <Input id="c-notes" name="notes" placeholder="Cliente frecuente, mayoreo..." />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
