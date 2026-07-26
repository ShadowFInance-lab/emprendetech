'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Package, Edit, Trash2, Eye, EyeOff, Loader2, Percent, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils/format'
import {
  applyBulkOfferAction, removeBulkOfferAction, bulkSetActiveAction, bulkDeleteAction,
} from '@/lib/actions/products'

type Row = {
  id: string
  name: string
  sku: string | null
  sale_price: number
  cost_price: number
  compare_at_price: number | null
  stock: number
  is_active: boolean
  categories: { name: string } | null
  product_images: { url: string; is_primary: boolean }[]
}

export default function InventoryTable({ products, lowStockThreshold }: { products: Row[]; lowStockThreshold: number }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [offerOpen, setOfferOpen] = useState(false)
  const [discount, setDiscount] = useState('20')

  const allSelected = products.length > 0 && selected.size === products.length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map(p => p.id)))
  }

  const ids = () => Array.from(selected)

  function runBulk(fn: () => Promise<{ success: boolean; error?: string; updated?: number }>, okMsg: string) {
    startTransition(async () => {
      const r = await fn()
      if (r.success) {
        toast.success(okMsg.replace('{n}', String(r.updated ?? selected.size)))
        setSelected(new Set())
        setOfferOpen(false)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(product => {
                const primaryImage = product.product_images?.find(i => i.is_primary) ?? product.product_images?.[0]
                const isLowStock = product.stock <= lowStockThreshold && product.stock > 0
                const isOut = product.stock === 0
                const onOffer = product.compare_at_price != null
                const isChecked = selected.has(product.id)

                return (
                  <tr key={product.id} className={`transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isChecked} onChange={() => toggle(product.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {primaryImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={primaryImage.url} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-48 flex items-center gap-1.5">
                            {product.name}
                            {onOffer && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">OFERTA</span>}
                          </p>
                          {product.sku && <p className="text-xs text-gray-400">SKU: {product.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{product.categories?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {onOffer ? (
                        <div className="leading-tight">
                          <span className="block text-gray-400 line-through text-[11px]">{formatCurrency(product.compare_at_price!)}</span>
                          <span className="block font-bold text-red-600">{formatCurrency(product.sale_price)}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-gray-900">{formatCurrency(product.sale_price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`font-mono ${isOut ? 'bg-red-100 text-red-700' : isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {product.stock}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {/* Colores explícitos: antes usaba variant="default", que toma
                          el color del tema (oscuro) y se leía mal. */}
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isOut ? 'bg-red-50 text-red-700 border-red-200'
                        : !product.is_active ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : isLowStock ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isOut ? 'Agotado' : !product.is_active ? 'Inactivo' : isLowStock ? 'Stock bajo' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/inventory/${product.id}`}>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Edit size={14} /></Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra flotante de acciones masivas */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-[95vw]">
          <span className="text-sm font-medium px-2">{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
          <div className="h-5 w-px bg-white/20" />
          <button onClick={() => setOfferOpen(true)} disabled={isPending}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
            <Percent size={14} /> Aplicar oferta
          </button>
          <button onClick={() => runBulk(() => removeBulkOfferAction(ids()), 'Ofertas quitadas')} disabled={isPending}
            className="flex items-center gap-1.5 hover:bg-white/10 text-sm px-3 py-1.5 rounded-lg transition-colors">
            Quitar oferta
          </button>
          <button onClick={() => runBulk(() => bulkSetActiveAction(ids(), false), '{n} ocultados')} disabled={isPending}
            className="flex items-center gap-1.5 hover:bg-white/10 text-sm px-3 py-1.5 rounded-lg transition-colors">
            <EyeOff size={14} /> Ocultar
          </button>
          <button onClick={() => runBulk(() => bulkSetActiveAction(ids(), true), '{n} activados')} disabled={isPending}
            className="flex items-center gap-1.5 hover:bg-white/10 text-sm px-3 py-1.5 rounded-lg transition-colors">
            <Eye size={14} /> Activar
          </button>
          <button onClick={() => { if (confirm(`¿Eliminar ${selected.size} productos?`)) runBulk(() => bulkDeleteAction(ids()), 'Productos eliminados') }} disabled={isPending}
            className="flex items-center gap-1.5 hover:bg-red-500/20 text-red-300 text-sm px-3 py-1.5 rounded-lg transition-colors">
            <Trash2 size={14} /> Eliminar
          </button>
          <button onClick={() => setSelected(new Set())} className="hover:bg-white/10 p-1.5 rounded-lg">
            <X size={16} />
          </button>
          {isPending && <Loader2 size={16} className="animate-spin" />}
        </div>
      )}

      {/* Diálogo de oferta masiva */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Percent size={18} className="text-red-500" /> Oferta masiva</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-500">
              Aplica un descuento a los <strong>{selected.size}</strong> productos seleccionados.
              El precio original se guarda y se muestra tachado en tu catálogo.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Descuento (%)</label>
              <div className="flex items-center gap-2">
                <Input type="number" min="1" max="99" value={discount}
                  onChange={e => setDiscount(e.target.value)} className="h-11 text-lg font-bold" />
                <span className="text-2xl font-bold text-gray-400">%</span>
              </div>
              <div className="flex gap-2 pt-1">
                {[10, 20, 30, 50].map(d => (
                  <button key={d} type="button" onClick={() => setDiscount(String(d))}
                    className="flex-1 py-1.5 text-sm rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-600 transition-colors">
                    {d}%
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferOpen(false)}>Cancelar</Button>
            <Button className="bg-red-500 hover:bg-red-600"
              disabled={isPending}
              onClick={() => runBulk(() => applyBulkOfferAction(ids(), parseFloat(discount) || 0), 'Oferta aplicada a {n} productos')}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Aplicar -${discount}%`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
