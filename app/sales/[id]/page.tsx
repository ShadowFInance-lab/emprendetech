import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, User, Calendar, CreditCard, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import CancelSaleButton from '@/components/sales/CancelSaleButton'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro',
}

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) redirect('/onboarding')

  const { data: sale } = await supabase
    .from('sales')
    .select('*, customers(name, phone), sale_items(*)')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .single()

  if (!sale) notFound()

  const isCompleted = sale.status === 'completed'

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sale.folio}</h1>
            <Badge className={isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
              {isCompleted ? 'Completada' : sale.status === 'cancelled' ? 'Cancelada' : 'Reembolsada'}
            </Badge>
          </div>
        </div>
        {isCompleted && <CancelSaleButton saleId={sale.id} />}
      </div>

      {/* Info de la venta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Calendar size={16} className="text-gray-400 mb-1" />
            <p className="text-xs text-gray-500">Fecha</p>
            <p className="text-sm font-medium">{formatDateTime(sale.created_at)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <User size={16} className="text-gray-400 mb-1" />
            <p className="text-xs text-gray-500">Cliente</p>
            <p className="text-sm font-medium">{sale.customers?.name ?? 'Público general'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <CreditCard size={16} className="text-gray-400 mb-1" />
            <p className="text-xs text-gray-500">Pago</p>
            <p className="text-sm font-medium">{PAYMENT_LABELS[sale.payment_method]}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <TrendingUp size={16} className="text-green-500 mb-1" />
            <p className="text-xs text-gray-500">Ganancia</p>
            <p className="text-sm font-medium text-green-600">{formatCurrency(sale.profit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Productos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Productos vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-50">
            {sale.sale_items?.map((item: {
              id: string
              product_name: string
              quantity: number
              unit_price: number
              subtotal: number
            }) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                  <p className="text-xs text-gray-400">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <p className="font-semibold text-sm">{formatCurrency(item.subtotal)}</p>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount_amt > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Descuento</span>
                <span>-{formatCurrency(sale.discount_amt)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1">
              <span>Total</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {sale.notes && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Notas</p>
            <p className="text-sm text-gray-700">{sale.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
