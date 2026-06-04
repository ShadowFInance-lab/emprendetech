import { create } from 'zustand'
import type { CartItem } from '@/lib/types'

interface CartState {
  items: CartItem[]
  addItem: (product: Omit<CartItem, 'quantity'>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
  // Computed
  subtotal: () => number
  totalItems: () => number
}

/**
 * Store del carrito del POS (Punto de Venta).
 * Vive en memoria — se limpia al cerrar venta o recargar.
 */
export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product) => set(state => {
    const existing = state.items.find(i => i.product_id === product.product_id)
    if (existing) {
      // Si ya existe, incrementar cantidad (sin pasar el stock)
      if (existing.quantity >= product.stock) return state
      return {
        items: state.items.map(i =>
          i.product_id === product.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      }
    }
    // Nuevo item
    if (product.stock < 1) return state
    return { items: [...state.items, { ...product, quantity: 1 }] }
  }),

  removeItem: (productId) => set(state => ({
    items: state.items.filter(i => i.product_id !== productId),
  })),

  updateQuantity: (productId, quantity) => set(state => {
    if (quantity < 1) {
      return { items: state.items.filter(i => i.product_id !== productId) }
    }
    return {
      items: state.items.map(i =>
        i.product_id === productId
          ? { ...i, quantity: Math.min(quantity, i.stock) }
          : i
      ),
    }
  }),

  clear: () => set({ items: [] }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.sale_price * i.quantity, 0),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
