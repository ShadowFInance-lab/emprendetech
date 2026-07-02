'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Loader2,
  Package, X, CheckCircle2, Banknote, ArrowLeftRight, UserCheck, CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/stores/cart'
import { searchProductsForPOS, createSaleAction } from '@/lib/actions/sales'
import { formatCurrency } from '@/lib/utils/format'
import StripeChargeLink from './StripeChargeLink'

type POSProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number
  cost_price: number
  stock: number
  image_url: string | null
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'card', label: 'Tarjeta', icon: CreditCard },
  { id: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
] as const

interface PresetCustomer {
  id: string
  name: string
  phone: string | null
}

export default function POSInterface({ presetCustomer }: { presetCustomer?: PresetCustomer }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const { items, addItem, removeItem, updateQuantity, clear, subtotal, totalItems } = useCartStore()

  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<POSProduct[]>([])
  const [loading, setLoading] = useState(false)

  // Checkout fields
  const [discount, setDiscount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [customerName, setCustomerName] = useState(presetCustomer?.name ?? '')
  const [customerPhone, setCustomerPhone] = useState(presetCustomer?.phone ?? '')

  // ─── Buscar productos (con debounce) ─────────────────────
  const search = useCallback(async (q: string) => {
    setLoading(true)
    const results = await searchProductsForPOS(q)
    setProducts(results)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  const sub = subtotal()
  const discountNum = Math.max(0, parseFloat(discount) || 0)
  const total = Math.max(0, sub - discountNum)

  function handleCheckout() {
    if (items.length === 0) {
      toast.error('Agrega productos al carrito')
      return
    }

    startTransition(async () => {
      const result = await createSaleAction({
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.sale_price,
          unit_cost: i.cost_price,
        })),
        discount_amt: discountNum,
        payment_method: paymentMethod,
        customer_id: presetCustomer?.id,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
      })

      if (result.success) {
        toast.success(`Venta registrada: ${result.folio}`)
        clear()
        setDiscount('0')
        // Venta directa a un cliente → volver a su ficha para ver el historial
        if (presetCustomer) {
          router.push(`/customers/${presetCustomer.id}`)
          return
        }
        setCustomerName('')
        setCustomerPhone('')
        search(query) // refrescar stock
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al registrar la venta')
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-7rem)]">
      {/* ─── IZQUIERDA: Catálogo de productos ─────────────── */}
      <div className="lg:col-span-3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Búsqueda */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Cobrar con Stripe — debajo del buscador (link de pago para terminal/tarjeta) */}
        <div className="px-4 pt-3">
          <StripeChargeLink title="Cobrar con Stripe" buttonLabel="Crear link" />
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map(product => {
                const inCart = items.find(i => i.product_id === product.id)
                const isOut = product.stock === 0
                const maxed = inCart && inCart.quantity >= product.stock

                return (
                  <button
                    key={product.id}
                    onClick={() => addItem({
                      product_id: product.id,
                      product_name: product.name,
                      sale_price: product.sale_price,
                      cost_price: product.cost_price,
                      stock: product.stock,
                      image_url: product.image_url ?? undefined,
                    })}
                    disabled={isOut || maxed}
                    className={`group text-left bg-white border rounded-xl overflow-hidden transition-all ${
                      isOut || maxed
                        ? 'opacity-50 cursor-not-allowed border-gray-100'
                        : 'border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 relative">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package size={28} />
                        </div>
                      )}
                      {inCart && (
                        <div className="absolute top-1 right-1 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {inCart.quantity}
                        </div>
                      )}
                      {isOut && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-white text-xs font-bold px-2 py-1 rounded text-gray-800">AGOTADO</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">
                        {product.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-blue-600">
                          {formatCurrency(product.sale_price)}
                        </span>
                        <span className="text-[10px] text-gray-400">{product.stock} uds</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Package size={36} className="mx-auto mb-3" />
              <p className="text-sm">
                {query ? 'No se encontraron productos' : 'No hay productos. Agrégalos en Inventario.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── DERECHA: Carrito y checkout ──────────────────── */}
      <div className="lg:col-span-2 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header del carrito */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Carrito</h2>
            {totalItems() > 0 && (
              <Badge className="bg-blue-100 text-blue-700">{totalItems()}</Badge>
            )}
          </div>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 size={12} /> Cancelar compra
            </button>
          )}
        </div>

        {/* Items del carrito */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart size={40} />
              <p className="text-sm mt-3 text-gray-400">Carrito vacío</p>
              <p className="text-xs text-gray-300">Toca un producto para agregarlo</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.product_id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(item.sale_price)} c/u</p>
                </div>
                {/* Controles de cantidad */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock}
                    className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(item.sale_price * item.quantity)}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(item.product_id)}
                  className="text-gray-300 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Checkout */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Cliente */}
            {presetCustomer ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-sm">
                <UserCheck size={16} className="text-blue-600 flex-shrink-0" />
                <span className="text-blue-800">
                  Venta para <span className="font-semibold">{presetCustomer.name}</span>
                </span>
              </div>
            ) : (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 text-xs font-medium">
                  + Agregar cliente (opcional)
                </summary>
                <div className="mt-2 space-y-2">
                  <Input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="h-8 text-sm"
                  />
                </div>
              </details>
            )}

            {/* Método de pago — botones grandes tipo terminal */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                      paymentMethod === method.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-blue-200'
                    }`}
                  >
                    <method.icon size={22} />
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Descuento */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Descuento (MXN)</span>
              <Input
                type="number"
                min="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-24 h-9 text-right text-sm"
              />
            </div>

            {/* Total — pantalla de terminal */}
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 shadow-lg">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(sub)}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between text-xs text-red-300 mt-0.5">
                  <span>Descuento</span>
                  <span>-{formatCurrency(discountNum)}</span>
                </div>
              )}
              <div className="flex items-end justify-between mt-1.5 pt-1.5 border-t border-white/10">
                <span className="text-sm font-medium text-gray-300">TOTAL</span>
                <span className="text-4xl font-black tracking-tight tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Botón cobrar grande */}
            <Button
              onClick={handleCheckout}
              disabled={isPending}
              className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg font-bold rounded-xl shadow-lg shadow-green-600/20"
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-6 w-6" /> Cobrar {formatCurrency(total)}</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
