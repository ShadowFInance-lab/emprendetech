'use client'

import { useState } from 'react'
import { ShoppingCart, Zap, ChevronDown } from 'lucide-react'
import { useCart, type ProductForCart } from './CartProvider'
import type { ProductVariantGroup } from '@/lib/types'

/**
 * Botones "Agregar al carrito" / "Comprar ahora" para el catálogo en modo
 * Venta Online. variant="full" (página de producto) o "compact" (tarjeta del grid).
 * Si el producto tiene variantes, primero muestra los selectores.
 */
export default function AddToCartButtons({
  product, variant = 'full', rounded = 'rounded-2xl', productVariants,
}: {
  product: ProductForCart
  variant?: 'full' | 'compact'
  rounded?: string
  productVariants?: ProductVariantGroup[] | null
}) {
  const { add, buyNow, color, pending } = useCart()
  const groups = productVariants?.filter(g => g.name && g.values.length > 0) ?? []
  const [selected, setSelected] = useState<Record<string, string>>({})

  const allSelected = groups.length === 0 || groups.every(g => selected[g.name])
  const variantText = groups.length > 0
    ? groups.map(g => `${g.name}: ${selected[g.name] ?? '—'}`).join(' / ')
    : undefined

  function pick(groupName: string, value: string) {
    setSelected(s => ({ ...s, [groupName]: value }))
  }

  const VariantPickers = () => (
    <div className="space-y-2 mb-3">
      {groups.map(group => (
        <div key={group.name}>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">{group.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.values.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => pick(group.name, val)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selected[group.name] === val
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
                style={selected[group.name] === val ? { backgroundColor: color, borderColor: color } : {}}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  if (variant === 'compact') {
    if (groups.length > 0 && !allSelected) {
      return (
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById(`variants-${product.product_id}`)
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
          className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:scale-[1.03] active:scale-95"
          style={{ backgroundColor: color }}
        >
          <ChevronDown size={16} /> Elige opciones
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={() => add(product, allSelected ? variantText : undefined)}
        disabled={pending}
        className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-60"
        style={{ backgroundColor: color }}
      >
        <ShoppingCart size={16} />
        Agregar al carrito
      </button>
    )
  }

  return (
    <div className="space-y-2.5">
      {groups.length > 0 && <VariantPickers />}
      <button
        type="button"
        onClick={() => buyNow(product, allSelected ? variantText : undefined)}
        disabled={pending || !allSelected}
        className={`flex w-full items-center justify-center gap-2.5 font-bold py-4 text-base text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-60 ${rounded}`}
        style={{ backgroundColor: color }}
      >
        <Zap size={20} /> {allSelected ? 'Comprar ahora' : 'Elige una opción'}
      </button>
      <button
        type="button"
        onClick={() => add(product, allSelected ? variantText : undefined)}
        disabled={pending || !allSelected}
        className={`flex w-full items-center justify-center gap-2.5 font-bold py-4 text-base hover:bg-gray-50 active:scale-[0.98] transition-all border-2 disabled:opacity-60 ${rounded}`}
        style={{ color, borderColor: color }}
      >
        <ShoppingCart size={20} /> Agregar al carrito
      </button>
    </div>
  )
}
