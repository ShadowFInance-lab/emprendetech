import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Plus, Search, Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import InventoryTable from '@/components/inventory/InventoryTable'
import { getPlanLimits } from '@/lib/constants/plans'
import type { Plan } from '@/lib/types'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; status?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, low_stock_alert')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/onboarding')

  // ─── Construir query con filtros ─────────────────────────
  let query = supabase
    .from('products')
    .select('*, categories(name), product_images(url, is_primary)')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`)
  }
  if (searchParams.category && searchParams.category !== 'all') {
    query = query.eq('category_id', searchParams.category)
  }
  if (searchParams.status === 'active') query = query.eq('is_active', true)
  if (searchParams.status === 'inactive') query = query.eq('is_active', false)
  if (searchParams.status === 'low_stock') {
    query = query.lte('stock', store.low_stock_alert).gt('stock', 0)
  }
  if (searchParams.status === 'out_of_stock') query = query.eq('stock', 0)

  const { data: products } = await query

  // ─── Categorías para el filtro ───────────────────────────
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('name')

  // ─── Conteos para badges ─────────────────────────────────
  const { count: totalCount } = await supabase
    .from('products').select('*', { count: 'exact', head: true }).eq('store_id', store.id)
  const { count: lowCount } = await supabase
    .from('products').select('*', { count: 'exact', head: true })
    .eq('store_id', store.id).lte('stock', store.low_stock_alert).gt('stock', 0)
  const { count: outCount } = await supabase
    .from('products').select('*', { count: 'exact', head: true })
    .eq('store_id', store.id).eq('stock', 0)

  // ─── Uso del plan: productos + variantes vs. límite ──────────
  const { data: planProfile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const plan = ((planProfile?.plan as Plan) ?? 'free')
  const limits = getPlanLimits(plan)
  const { data: variantRows } = await supabase.from('products').select('variants').eq('store_id', store.id)
  const variantCount = (variantRows ?? []).reduce(
    (s, p) => s + (Array.isArray((p as { variants?: unknown[] }).variants) ? (p as { variants: unknown[] }).variants.length : 0), 0)
  const usedCount = (totalCount ?? 0) + variantCount
  const limitNum = limits.max_products
  const unlimited = !Number.isFinite(limitNum)
  const pct = unlimited ? 0 : Math.min(100, Math.round((usedCount / limitNum) * 100))
  const nearLimit = !unlimited && usedCount >= limitNum * 0.8

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 text-sm mt-1">{totalCount ?? 0} productos en total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/categories">
            <Button variant="outline" size="sm">Categorías</Button>
          </Link>
          <Link href="/inventory/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo producto
            </Button>
          </Link>
        </div>
      </div>

      {/* Uso del plan (productos + variantes vs. límite) */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Package size={16} className="text-gray-400" />
            <span className="font-bold text-gray-900">{usedCount}</span>
            <span className="text-gray-500">{unlimited ? 'productos · ilimitado' : `de ${limitNum} productos`}</span>
            {variantCount > 0 && <span className="text-[11px] text-gray-400">· incluye {variantCount} variante{variantCount !== 1 ? 's' : ''}</span>}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${unlimited ? 'bg-emerald-50 text-emerald-700' : nearLimit ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            Plan {limits.label}
          </span>
        </div>
        {!unlimited && (
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {!unlimited && nearLimit && (
          <p className="text-[11px] text-amber-600 mt-1.5">
            {pct >= 100 ? 'Llegaste al límite de tu plan. ' : 'Estás cerca del límite. '}
            <Link href="/subscription" className="font-semibold underline">Mejora tu plan</Link> para agregar más.
          </p>
        )}
      </div>

      {/* Badges de estado rápido */}
      <div className="flex flex-wrap gap-2">
        <Link href="/inventory">
          <Badge variant={!searchParams.status ? 'default' : 'secondary'} className="cursor-pointer">
            Todos ({totalCount ?? 0})
          </Badge>
        </Link>
        <Link href="/inventory?status=low_stock">
          <Badge className={`cursor-pointer ${searchParams.status === 'low_stock' ? 'bg-amber-500' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
            <AlertTriangle size={12} className="mr-1" /> Stock bajo ({lowCount ?? 0})
          </Badge>
        </Link>
        <Link href="/inventory?status=out_of_stock">
          <Badge className={`cursor-pointer ${searchParams.status === 'out_of_stock' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
            Agotados ({outCount ?? 0})
          </Badge>
        </Link>
      </div>

      {/* Barra de búsqueda y filtros */}
      <form className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          name="category"
          defaultValue={searchParams.category}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todas las categorías</option>
          {categories?.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">Buscar</Button>
        {(searchParams.q || searchParams.category) && (
          <Link href="/inventory">
            <Button type="button" size="sm" variant="ghost">Limpiar</Button>
          </Link>
        )}
      </form>

      {/* Tabla de productos con selección múltiple + ofertas masivas */}
      {products && products.length > 0 ? (
        <InventoryTable products={products as never} lowStockThreshold={store.low_stock_alert} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">
            {searchParams.q || searchParams.category
              ? 'No se encontraron productos'
              : 'Aún no tienes productos'}
          </h3>
          <p className="text-gray-500 text-sm mt-2 mb-6">
            {searchParams.q || searchParams.category
              ? 'Intenta con otros filtros de búsqueda'
              : 'Agrega tu primer producto para comenzar a vender'}
          </p>
          {!searchParams.q && !searchParams.category && (
            <Link href="/inventory/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Agregar primer producto
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
