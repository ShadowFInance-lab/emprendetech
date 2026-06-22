import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/server'
import ModernaSkin from '@/components/catalog/skins/ModernaSkin'
import MinimalistaSkin from '@/components/catalog/skins/MinimalistaSkin'
import { CartProvider } from '@/components/catalog/cart/CartProvider'
import CartFab from '@/components/catalog/cart/CartFab'
import type { Store, Category, Product } from '@/lib/types'

// ISR: revalidar cada 5 minutos
export const revalidate = 300

interface PageProps {
  params: { slug: string }
  searchParams: { category?: string; q?: string; filter?: string }
}

// ─── SEO: generateMetadata ───────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createPublicClient()
  const { data: store } = await supabase
    .from('stores')
    .select('name, description, tagline, logo_url, banner_url, slug')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!store) return { title: 'Tienda no encontrada' }

  const title = `${store.name}${store.tagline ? ` — ${store.tagline}` : ''}`
  const description = store.description ?? `Visita el catálogo de ${store.name} y encuentra lo que buscas.`
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/catalog/${store.slug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: store.banner_url
        ? [{ url: store.banner_url, width: 1200, height: 630, alt: store.name }]
        : store.logo_url
          ? [{ url: store.logo_url, width: 400, height: 400, alt: store.name }]
          : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: url },
  }
}

// ─── PÁGINA PRINCIPAL DEL CATÁLOGO ──────────────────────────
export default async function CatalogPage({ params, searchParams }: PageProps) {
  const supabase = createPublicClient()

  // 1. Cargar tienda (con manejo defensivo de errores de conexión)
  let store
  try {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .eq('catalog_active', true)
      .single()
    store = data
  } catch {
    store = null
  }

  if (!store) notFound()

  // 1b. Plan del dueño → anuncios solo si plan Free (Fix A)
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', store.owner_id)
    .single()
  const showAds = (ownerProfile?.plan ?? 'free') === 'free'

  // 2. Categorías activas
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  // 3. Productos con filtros
  let query = supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('store_id', store.id)
    .eq('is_active', true)

  // Filtro de categoría
  if (searchParams.category) {
    const cat = categories?.find(c => c.slug === searchParams.category)
    if (cat) query = query.eq('category_id', cat.id)
  }

  // Filtro especial
  if (searchParams.filter === 'new') query = query.eq('is_new', true)
  if (searchParams.filter === 'featured') query = query.eq('is_featured', true)
  if (searchParams.filter === 'best_sellers') query = query.order('total_sold', { ascending: false })

  // Búsqueda por texto
  if (searchParams.q) query = query.ilike('name', `%${searchParams.q}%`)

  // Orden según configuración de la tienda
  if (!searchParams.filter || searchParams.filter === 'featured') {
    switch (store.product_order) {
      case 'featured':
        query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false })
        break
      case 'best_sellers':
        query = query.order('total_sold', { ascending: false })
        break
      case 'new':
        query = query.order('is_new', { ascending: false }).order('created_at', { ascending: false })
        break
      default:
        query = query.order('sort_order').order('created_at', { ascending: false })
    }
  }

  const { data: products } = await query

  // 4. Ordenar imágenes de cada producto
  const sortedProducts = products?.map(p => ({
    ...p,
    product_images: (p.product_images ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  })) ?? []

  // 5. Elegir skin
  const skinProps = {
    store: store as Store,
    categories: (categories ?? []) as Category[],
    products: sortedProducts as Product[],
    activeCategory: searchParams.category ?? null,
    activeFilter: searchParams.filter ?? null,
    searchQuery: searchParams.q ?? '',
    showAds,
  }

  // Schema.org JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    description: store.description,
    url: `${process.env.NEXT_PUBLIC_APP_URL}/catalog/${store.slug}`,
    telephone: store.whatsapp,
    sameAs: [store.facebook, store.instagram, store.tiktok].filter(Boolean),
  }

  const online_sales = !!(store as { online_sales?: boolean }).online_sales

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CartProvider
        enabled={online_sales}
        storeId={store.id}
        storeName={store.name}
        color={store.primary_color ?? '#2563EB'}
        currency={store.currency}
        whatsapp={store.whatsapp}
      >
        {store.skin === 'minimalista' ? (
          <MinimalistaSkin {...skinProps} />
        ) : (
          <ModernaSkin {...skinProps} />
        )}
        <CartFab />
      </CartProvider>
    </>
  )
}
