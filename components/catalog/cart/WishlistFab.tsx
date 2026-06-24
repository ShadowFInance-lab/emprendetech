'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heart, X, ShoppingCart, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

export interface WishlistItem {
  product_id: string
  name: string
  price: number
  image_url: string | null
}

const KEY = (slug: string) => `mb_wishlist_${slug}`

export function useWishlist(slug: string) {
  const [items, setItems] = useState<WishlistItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(slug))
      if (raw) setItems(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [slug])

  const save = (next: WishlistItem[]) => {
    setItems(next)
    try { localStorage.setItem(KEY(slug), JSON.stringify(next)) } catch { /* ignore */ }
  }

  const toggle = useCallback((item: WishlistItem) => {
    setItems(prev => {
      const has = prev.some(i => i.product_id === item.product_id)
      const next = has ? prev.filter(i => i.product_id !== item.product_id) : [...prev, item]
      try { localStorage.setItem(KEY(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const remove = (id: string) => save(items.filter(i => i.product_id !== id))
  const has = (id: string) => items.some(i => i.product_id === id)

  return { items, toggle, remove, has, count: items.length }
}

export default function WishlistFab({
  slug,
  color,
  currency,
  onAddToCart,
}: {
  slug: string
  color: string
  currency?: string
  onAddToCart?: (item: WishlistItem) => void
}) {
  const { items, remove, count } = useWishlist(slug)
  const [open, setOpen] = useState(false)

  const fmt = (n: number) => formatCurrency(n, currency)

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ backgroundColor: color }}
        title="Mi lista de deseos"
      >
        <Heart size={22} className="text-white" fill="white" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Heart size={18} style={{ color }} fill={color} />
                <span className="font-bold text-gray-900">Mi lista de deseos</span>
                {count > 0 && <span className="text-xs bg-rose-50 text-rose-600 rounded-full px-2 py-0.5 font-semibold">{count}</span>}
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <Heart size={48} className="text-gray-200 mb-3" />
                  <p className="text-gray-500 font-medium">Tu lista está vacía</p>
                  <p className="text-xs text-gray-400 mt-1">Toca el corazón en los productos para guardarlos aquí</p>
                </div>
              ) : (
                items.map(item => (
                  <div key={item.product_id} className="flex items-center gap-2.5 bg-white rounded-xl border border-gray-100 p-2.5 shadow-sm">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                      <p className="text-base font-bold mt-0.5" style={{ color }}>{fmt(item.price)}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {onAddToCart && (
                        <button onClick={() => { onAddToCart(item); remove(item.product_id) }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110"
                          style={{ backgroundColor: color }} title="Agregar al carrito y quitar de lista">
                          <ShoppingCart size={14} />
                        </button>
                      )}
                      <button onClick={() => remove(item.product_id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Quitar de la lista">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && onAddToCart && (
              <div className="border-t border-gray-100 p-3">
                <button
                  onClick={() => { items.forEach(i => onAddToCart(i)); setOpen(false) }}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: color }}>
                  <ShoppingCart size={16} /> Agregar todo al carrito
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
