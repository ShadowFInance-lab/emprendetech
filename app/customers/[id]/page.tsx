import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ArrowLeft, Phone, Mail, MapPin, ShoppingBag, TrendingUp, Calendar, StickyNote,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import { getReminders } from '@/lib/actions/reminders'
import RemindersCard from '@/components/customers/RemindersCard'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) redirect('/onboarding')

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .single()

  if (!customer) notFound()

  // Historial de ventas del cliente
  const { data: sales } = await supabase
    .from('sales')
    .select('id, folio, total, profit, status, payment_method, created_at, sale_items(quantity)')
    .eq('store_id', store.id)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  const completedSales = (sales ?? []).filter((s: { status: string }) => s.status === 'completed')
  const totalSpent = completedSales.reduce((a: number, s: { total: number }) => a + Number(s.total), 0)
  const avgTicket = completedSales.length > 0 ? totalSpent / completedSales.length : 0

  // Recordatorios de entrega (resiliente si falta la migración 008)
  const { reminders, missingTable } = await getReminders(customer.id)

  const initials = customer.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Detalle de cliente</h1>
      </div>

      {/* Tarjeta del cliente */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center ring-4 ring-white">
              <span className="text-2xl font-bold text-blue-600">{initials || '👤'}</span>
            </div>
            <div className="flex-1 pb-1">
              <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                {customer.phone && <span className="flex items-center gap-1"><Phone size={13} /> {customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail size={13} /> {customer.email}</span>}
                {customer.address && <span className="flex items-center gap-1"><MapPin size={13} /> {customer.address}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/sales/new?customer=${customer.id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:scale-105 flex items-center gap-2"
              >
                <ShoppingBag size={15} /> Registrar venta
              </Link>
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:scale-105 flex items-center gap-2"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>

          {customer.notes && (
            <div className="mt-4 flex items-start gap-2 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
              <StickyNote size={15} className="mt-0.5 flex-shrink-0" />
              <span>{customer.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs del cliente */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total gastado', value: formatCurrency(totalSpent), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Compras', value: completedSales.length.toString(), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Ticket promedio', value: formatCurrency(avgTicket), icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(kpi => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
              <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recordatorios de entrega */}
      <RemindersCard customerId={customer.id} initialReminders={reminders} missingTable={missingTable} />

      {/* Historial de compras */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag size={16} className="text-blue-600" /> Historial de compras
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales && sales.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {sales.map((sale: {
                id: string; folio: string; total: number; status: string
                created_at: string; sale_items: { quantity: number }[]
              }) => {
                const items = sale.sale_items?.reduce((a, i) => a + i.quantity, 0) ?? 0
                return (
                  <Link key={sale.id} href={`/sales/${sale.id}`}
                    className="flex items-center justify-between py-3 hover:bg-gray-50/50 -mx-2 px-2 rounded-lg transition-colors">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{sale.folio}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(sale.created_at)} · {items} productos</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={sale.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {sale.status === 'completed' ? 'Completada' : 'Cancelada'}
                      </Badge>
                      <span className="font-semibold text-sm">{formatCurrency(sale.total)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <ShoppingBag size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Este cliente aún no tiene compras</p>
              <Link href="/sales/new" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                Registrar una venta →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
