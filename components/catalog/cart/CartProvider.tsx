'use client'

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  getCartAction, addToCartAction, setCartItemQtyAction, removeCartItemAction, clearCartAction,
  type CartItem,
} from '@/lib/actions/cart'

export interface ProductForCart { product_id: string; name: string; price: number; image_url?: string | null }
type View = 'cart' | 'checkout' | 'done'

interface CartContext {
  enabled: boolean
  storeId: string
  storeName: string
  color: string
  currency?: string
  whatsapp?: string | null
  items: CartItem[]
  count: number
  subtotal: number
  loading: boolean
  pending: boolean
  add: (p: ProductForCart, variantText?: string) => void
  buyNow: (p: ProductForCart, variantText?: string) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
  reload: () => void
  // UI
  open: boolean
  view: View
  lastOrderNo: string | null
  openCart: () => void
  goCheckout: () => void
  finish: (orderNo: string) => void
  setOpen: (v: boolean) => void
}

const Ctx = createContext<CartContext | null>(null)

export function useCart(): CartContext {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return c
}

export function CartProvider({
  children, enabled, storeId, storeName, color, currency, whatsapp,
}: {
  children: ReactNode
  enabled: boolean
  storeId: string
  storeName: string
  color: string
  currency?: string | null
  whatsapp?: string | null
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(enabled)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('cart')
  const [lastOrderNo, setLastOrderNo] = useState<string | null>(null)

  async function reload() {
    if (!enabled) return
    const c = await getCartAction()
    setItems(c.items)
    setLoading(false)
  }
  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    getCartAction().then(c => { setItems(c.items); setLoading(false) })
  }, [enabled])

  // Regreso desde Stripe Checkout (?pago=exitoso | ?pago=cancelado). En el flujo
  // pago-primero el pedido lo crea el webhook al confirmarse el pago; aquí solo
  // damos feedback al comprador y limpiamos el carrito localmente (el webhook lo
  // vacía en el servidor). No tocamos el carrito del servidor para no interferir
  // con la reconstrucción del pedido por cart_id.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const pago = params.get('pago')
    if (!pago) return
    if (pago === 'exitoso') {
      setItems([])
      toast.success('¡Pago recibido! Tu pedido fue confirmado y el negocio ya lo está preparando.', { duration: 7000 })
    } else if (pago === 'cancelado') {
      toast('Pago cancelado. Tu carrito sigue disponible cuando quieras volver a intentarlo.', { icon: '🛒' })
    }
    params.delete('pago')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [enabled])

  function add(p: ProductForCart, variantText?: string) {
    startTransition(async () => {
      const c = await addToCartAction(storeId, p, 1, variantText ?? null)
      setItems(c.items)
      if (c.items.length > 0) {
        toast.success('Agregado al carrito')
      } else {
        toast.error('No se pudo agregar el producto al carrito')
      }
    })
  }
  function buyNow(p: ProductForCart, variantText?: string) {
    startTransition(async () => {
      const c = await addToCartAction(storeId, p, 1, variantText ?? null)
      setItems(c.items)
      if (c.items.length > 0) {
        setView('checkout')
        setOpen(true)
      } else {
        toast.error('No se pudo agregar el producto')
      }
    })
  }
  function setQty(id: string, qty: number) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, qty } : i)).filter(i => i.qty > 0))
    startTransition(async () => { const c = await setCartItemQtyAction(id, qty); setItems(c.items) })
  }
  function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    startTransition(async () => { const c = await removeCartItemAction(id); setItems(c.items) })
  }
  function clear() {
    setItems([])
    startTransition(async () => { await clearCartAction() })
  }

  function openCart() { setView('cart'); setOpen(true) }
  function goCheckout() { setView('checkout') }
  function finish(orderNo: string) { setLastOrderNo(orderNo); setItems([]); setView('done') }

  const count = items.reduce((s, i) => s + i.qty, 0)
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <Ctx.Provider value={{
      enabled, storeId, storeName, color, currency: currency ?? undefined, whatsapp,
      items, count, subtotal, loading, pending,
      add, buyNow, setQty, remove, clear, reload,
      open, view, lastOrderNo, openCart, goCheckout, finish, setOpen,
    }}>
      {children}
    </Ctx.Provider>
  )
}
