import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import { TrendingUp, ShoppingBag, DollarSign, AlertTriangle, Package, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SalesChart from '@/components/dashboard/SalesChart'
import DailySalesExport from '@/components/dashboard/DailySalesExport'
import type { ExportSale } from '@/lib/utils/salesExport'
import { getSalesChartData } from '@/lib/actions/dashboard'
import { getMeteredUsage } from '@/lib/actions/subscriptions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug, low_stock_alert, currency')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/onboarding')

  // ─── Fechas para los KPIs ────────────────────────────────
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ─── Ventas del día ──────────────────────────────────────
  const { data: salesToday } = await supabase
    .from('sales')
    .select('total, profit')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', todayStart)

  const totalToday = salesToday?.reduce((s, r) => s + Number(r.total), 0) ?? 0

  // ─── Ventas de la semana ─────────────────────────────────
  const { data: salesWeek } = await supabase
    .from('sales')
    .select('total')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', weekStart)

  const totalWeek = salesWeek?.reduce((s, r) => s + Number(r.total), 0) ?? 0

  // ─── Ventas del mes ──────────────────────────────────────
  const { data: salesMonth } = await supabase
    .from('sales')
    .select('total, profit')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', monthStart)

  const totalMonth = salesMonth?.reduce((s, r) => s + Number(r.total), 0) ?? 0
  const profitMonth = salesMonth?.reduce((s, r) => s + Number(r.profit), 0) ?? 0

  // ─── Margen promedio del mes ─────────────────────────────
  const marginMonth = totalMonth > 0 ? (profitMonth / totalMonth) * 100 : 0

  // ─── Productos con bajo stock ────────────────────────────
  const { data: lowStockProducts } = await supabase
    .from('products')
    .select('id, name, stock, sku')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .lte('stock', store.low_stock_alert)
    .gt('stock', 0)
    .order('stock', { ascending: true })
    .limit(5)

  // ─── Productos agotados ──────────────────────────────────
  const { count: outOfStockCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('stock', 0)

  // ─── Más vendidos ────────────────────────────────────────
  const { data: bestSellers } = await supabase
    .from('products')
    .select('name, total_sold, sale_price')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('total_sold', { ascending: false })
    .limit(5)

  // ─── Alertas sin leer ────────────────────────────────────
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5)

  // ─── Datos de la gráfica de ventas (30 días) ─────────────
  const chartData = await getSalesChartData(30)

  // ─── Uso VIP Plus (contador de ventas medidas) ───────────
  const { data: profilePlan } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single()
  const currentPlan = (profilePlan?.plan ?? 'free') as string
  const vipUsage = currentPlan === 'vip_plus' ? await getMeteredUsage() : null
  const vipPct = vipUsage ? Math.min(100, (vipUsage.salesThisMonth / vipUsage.included) * 100) : 0
  // Modo Gratis completo: free y vip_plus (y otros) dan acceso total sin cobro
  const isPaid = true // Modo Gratis completo: free/vip_plus + planes pagos dan acceso total sin cobro

  // ─── Ventas detalladas (para exportar PDF/Excel por rango) ──
  // Una sola query desde la fecha más temprana (semana o inicio de mes),
  // luego se filtra en Hoy / Semana / Mes.
  const earliestStart = weekStart < monthStart ? weekStart : monthStart
  const { data: detailedRaw } = await supabase
    .from('sales')
    .select('folio, total, payment_method, created_at, customers(name), sale_items(product_name, quantity, unit_price, subtotal)')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', earliestStart)
    .order('created_at', { ascending: false })
    .limit(1000)

  type RawSale = {
    folio: string; total: number; payment_method: string; created_at: string
    customers: { name: string } | { name: string }[] | null
    sale_items: { product_name: string; quantity: number; unit_price: number; subtotal: number }[] | null
  }
  const allDetailed: ExportSale[] = (detailedRaw as RawSale[] | null ?? []).map(s => {
    const cust = Array.isArray(s.customers) ? s.customers[0] : s.customers
    return {
      folio: s.folio,
      created_at: s.created_at,
      total: Number(s.total),
      payment_method: s.payment_method,
      customer_name: cust?.name ?? null,
      items: (s.sale_items ?? []).map(it => ({
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: Number(it.unit_price),
        subtotal: Number(it.subtotal),
      })),
    }
  })
  const reportToday = allDetailed.filter(s => s.created_at >= todayStart)
  const reportWeek = allDetailed.filter(s => s.created_at >= weekStart)
  const reportMonth = allDetailed.filter(s => s.created_at >= monthStart)
  const todayLabel = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

  const hasNoSales = (salesMonth?.length ?? 0) === 0 && (salesWeek?.length ?? 0) === 0 && (salesToday?.length ?? 0) === 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  const KPI_CARDS = [
    {
      title: 'Ventas de hoy',
      value: formatCurrency(totalToday),
      sub: `${salesToday?.length ?? 0} transacciones`,
      icon: ShoppingBag,
      gradient: 'from-blue-500 to-blue-600',
      ring: 'ring-blue-100',
    },
    {
      title: 'Esta semana',
      value: formatCurrency(totalWeek),
      sub: `${salesWeek?.length ?? 0} transacciones`,
      icon: TrendingUp,
      gradient: 'from-violet-500 to-purple-600',
      ring: 'ring-purple-100',
    },
    {
      title: 'Este mes',
      value: formatCurrency(totalMonth),
      sub: `${salesMonth?.length ?? 0} transacciones`,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-green-600',
      ring: 'ring-green-100',
    },
    {
      title: 'Ganancia del mes',
      value: formatCurrency(profitMonth),
      sub: `Margen ${marginMonth.toFixed(1)}%`,
      icon: TrendingUp,
      gradient: 'from-amber-500 to-orange-600',
      ring: 'ring-amber-100',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {greeting} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <a href="/sales/new"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 text-sm">
          <ShoppingBag size={17} /> Nueva venta
        </a>
      </div>

      {/* Publicidad ligera (solo plan Gratis) */}
      {!isPaid && (
        <Link
          href="/subscription"
          className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 px-4 py-2.5 text-sm text-amber-800 hover:from-amber-100 hover:to-orange-100 transition-all"
        >
          <span className="text-base">✨</span>
          <span className="flex-1">
            <span className="font-semibold">Plan Gratis</span> — mejora a un plan de pago para
            quitar anuncios, descargar reportes y personalizar tu catálogo.
          </span>
          <span className="font-semibold underline whitespace-nowrap">Ver planes →</span>
        </Link>
      )}

      {/* Estado vacío motivador */}
      {hasNoSales && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-8 sm:p-10 text-white shadow-xl">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative">
            <span className="text-4xl">🚀</span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-3">¡Tu primera venta te espera!</h2>
            <p className="text-blue-100 mt-2 max-w-lg">
              Registra tu primera venta o comparte tu catálogo por WhatsApp para empezar a vender hoy mismo.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <a href="/sales/new"
                className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-5 py-3 rounded-xl hover:bg-blue-50 transition-all hover:scale-105">
                <ShoppingBag size={18} /> Registrar venta
              </a>
              <a href={`/catalog/${store.slug ?? ''}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/25 transition-all ring-1 ring-white/30">
                🌐 Ver mi catálogo
              </a>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map(kpi => (
          <div key={kpi.title}
            className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] border border-gray-100/70 transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg ring-4 ${kpi.ring} group-hover:scale-110 transition-transform`}>
                <kpi.icon size={22} className="text-white" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mt-4 tracking-tight">{kpi.value}</p>
            <p className="text-sm font-medium text-gray-600 mt-0.5">{kpi.title}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Reportes de ventas (Hoy / Semana / Mes) + descarga PDF/Excel */}
      <DailySalesExport
        today={reportToday}
        week={reportWeek}
        month={reportMonth}
        isPaid={isPaid}
        storeName={store.name}
        currency={store.currency ?? 'MXN'}
        dateLabel={todayLabel}
      />

      {/* Contador VIP Plus (ventas medidas del mes) */}
      {vipUsage && (
        <Link href="/subscription" className="block">
          <Card className="border-0 shadow-sm ring-1 ring-amber-200 hover:ring-amber-300 transition-all">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" /> VIP Plus · ventas de este mes
                </p>
                <span className="text-sm text-gray-500">
                  {vipUsage.salesThisMonth.toLocaleString()} / {vipUsage.included.toLocaleString()} incluidas
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${vipUsage.extraSales > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${vipPct}%` }}
                />
              </div>
              {vipUsage.extraSales > 0 ? (
                <p className="text-xs text-amber-700 mt-2">
                  {vipUsage.extraSales.toLocaleString()} ventas extra × {formatCurrency(vipUsage.feePerSale)} ={' '}
                  <strong>{formatCurrency(vipUsage.amountDue)}</strong> este mes (solo ventas con Mercado Pago)
                </p>
              ) : (
                <p className="text-xs text-green-600 mt-2">✓ Dentro de tus 1,000 ventas incluidas. Sin cargos extra.</p>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Gráfica de ventas 30 días */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Ventas de los últimos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={chartData} />
        </CardContent>
      </Card>

      {/* Segunda fila */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Más vendidos */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Más vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestSellers && bestSellers.length > 0 ? (
              <div className="space-y-3">
                {bestSellers.map((product, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(product.sale_price)}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {product.total_sold} uds
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Aún no hay ventas registradas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stock bajo */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Stock bajo
              {outOfStockCount && outOfStockCount > 0 ? (
                <Badge className="bg-red-100 text-red-700 text-xs">{outOfStockCount} agotados</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts && lowStockProducts.length > 0 ? (
              <div className="space-y-3">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="flex items-center gap-3">
                    <Package size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      {product.sku && (
                        <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                      )}
                    </div>
                    <Badge
                      className={`text-xs flex-shrink-0 ${
                        product.stock <= 2
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {product.stock} uds
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                ✅ Todos los productos tienen stock suficiente
              </p>
            )}
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              Alertas recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts && alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`flex gap-2 p-2.5 rounded-lg text-sm ${
                      alert.type === 'out_of_stock'
                        ? 'bg-red-50 text-red-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    <span>{alert.type === 'out_of_stock' ? '🔴' : '🟡'}</span>
                    <div>
                      <p className="font-medium text-xs">{alert.title}</p>
                      {alert.body && <p className="text-xs opacity-75">{alert.body}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                ✅ Sin alertas pendientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
