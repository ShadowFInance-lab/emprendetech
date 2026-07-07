import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import ExportSalesButtons from '@/components/sales/ExportSalesButtons'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Reembolsada', color: 'bg-amber-100 text-amber-700' },
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'Pago online',
  other: 'Otro',
}

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Tienda efectiva: propia (dueño) o la del jefe (empleado)
  let { data: store } = await supabase
    .from('stores').select('id, name').eq('owner_id', user.id).maybeSingle()
  if (!store) {
    const { data: prof } = await supabase.from('profiles').select('boss_id').eq('id', user.id).maybeSingle()
    if (prof?.boss_id) {
      const { data: bs } = await supabase.from('stores').select('id, name').eq('owner_id', prof.boss_id).maybeSingle()
      store = bs
    }
  }
  if (!store) redirect('/onboarding')

  // Exportar disponible en Modo Gratis completo (free / vip_plus)
  await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const isPaid = true // Modo Gratis completo activado

  // Ventas con cliente
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name), sale_items(quantity)')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(100)

  // Total de hoy
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: todaySales } = await supabase
    .from('sales')
    .select('total')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', todayStart.toISOString())

  const totalToday = todaySales?.reduce((s, r) => s + Number(r.total), 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500 text-sm mt-1">
            Hoy: <span className="font-semibold text-green-600">{formatCurrency(totalToday)}</span>
            {' · '}{todaySales?.length ?? 0} ventas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportSalesButtons
            storeName={store.name}
            isPaid={isPaid}
            sales={(sales ?? []).map((s: {
              folio: string; created_at: string; total: number; profit: number
              status: string; payment_method: string; customers: { name: string } | null
            }) => ({
              folio: s.folio,
              created_at: s.created_at,
              customer: s.customers?.name ?? '',
              payment_method: s.payment_method,
              total: Number(s.total),
              profit: Number(s.profit),
              status: s.status,
            }))}
          />
          <Link href="/sales/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Nueva venta
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabla de ventas */}
      {sales && sales.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Cliente</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Pago</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((sale: {
                  id: string
                  folio: string
                  total: number
                  profit: number
                  status: string
                  payment_method: string
                  created_at: string
                  customers: { name: string } | null
                  sale_items: { quantity: number }[]
                }) => {
                  const itemCount = sale.sale_items?.reduce((s, i) => s + i.quantity, 0) ?? 0
                  const status = STATUS_LABELS[sale.status] ?? STATUS_LABELS.completed
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/sales/${sale.id}`} className="font-medium text-blue-600 hover:underline">
                          {sale.folio}
                        </Link>
                        <p className="text-xs text-gray-400">{itemCount} productos</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {sale.customers?.name ?? 'Público general'}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-500 text-xs">
                        {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <ShoppingCart size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700">Sin ventas aún</h3>
          <p className="text-gray-400 text-sm mt-1 mb-6">
            Registra tu primera venta para comenzar
          </p>
          <Link href="/sales/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Registrar primera venta
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
