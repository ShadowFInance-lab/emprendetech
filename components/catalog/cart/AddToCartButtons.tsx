'use client'

import { ShoppingCart, Zap } from 'lucide-react'
import { useCart, type ProductForCart } from './CartProvider'

/**
 * Botones "Agregar al carrito" / "Comprar ahora" para el catálogo en modo
 * Venta Online. variant="full" (página de producto) o "compact" (tarjeta del grid).
 */
export default function AddToCartButtons({
  product, variant = 'full', rounded = 'rounded-2xl',
}: {
  product: ProductForCart
  variant?: 'full' | 'compact'
  rounded?: string
}) {
  const { add, buyNow, color, pending } = useCart()

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => add(product)}
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
      <button
        type="button"
        onClick={() => buyNow(product)}
        disabled={pending}
        className={`flex w-full items-center justify-center gap-2.5 font-bold py-4 text-base text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-60 ${rounded}`}
        style={{ backgroundColor: color }}
      >
        <Zap size={20} /> Comprar ahora
      </button>
      <button
        type="button"
        onClick={() => add(product)}
        disabled={pending}
        className={`flex w-full items-center justify-center gap-2.5 font-bold py-4 text-base hover:bg-gray-50 active:scale-[0.98] transition-all border-2 disabled:opacity-60 ${rounded}`}
        style={{ color, borderColor: color }}
      >
        <ShoppingCart size={20} /> Agregar al carrito
      </button>
    </div>
  )
}
