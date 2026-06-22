import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/server'
import ProductDetailView from '@/components/catalog/ProductDetailView'
import { CartProvider } from '@/components/catalog/cart/CartProvider'
import CartFab from '@/components/catalog/cart/CartFab'

export const revalidate = 600 // 10 minutos

interface PageProps {
  params: { slug: string; productSlug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createPublicClient()

  const { data: store } = await supabase
    .from('stores').select('name, slug').eq('slug', params.slug).single()

  const { data: product } = await supabase
    .from('products')
    .select('name, description, sale_price, product_images(*)')
    .eq('slug', params.productSlug)
    .single()

  if (!store || !product) return { title: 'Producto no encontrado' }

  const primaryImage = (product.product_images as { url: string; is_primary: boolean }[])
    ?.find(i => i.is_primary) ?? product.product_images?.[0]

  const title = `${product.name} — ${store.name}`
  const description = product.description
    ?? `${product.name} disponible en ${store.name}.`
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/catalog/${store.slug}/product/${params.productSlug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: primaryImage
        ? [{ url: primaryImage.url, width: 800, height: 800, alt: product.name }]
        : [],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const supabase = createPublicClient()

  // Cargar tienda
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .eq('catalog_active', true)
    .single()

  if (!store) notFound()

  // Cargar producto con imágenes y categoría
  const { data: product } = await supabase
    .from('products')
    .select('*, product_images(*), categories(name, slug)')
    .eq('slug', params.productSlug)
    .eq('store_id', store.id)
    .eq('is_active', true)
    .single()

  if (!product) notFound()

  // Ordenar imágenes
  if (product.product_images) {
    product.product_images.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    )
  }

  // Productos relacionados (misma categoría)
  const { data: related } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('category_id', product.category_id ?? '')
    .neq('id', product.id)
    .order('total_sold', { ascending: false })
    .limit(4)

  // Schema.org JSON-LD
  const primaryImage = product.product_images?.find((i: { is_primary: boolean }) => i.is_primary)
    ?? product.product_images?.[0]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: primaryImage?.url,
    offers: {
      '@type': 'Offer',
      price: product.sale_price,
      priceCurrency: 'MXN',
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    brand: { '@type': 'Brand', name: store.name },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CartProvider
        enabled={!!(store as { online_sales?: boolean }).online_sales}
        storeId={store.id}
        storeName={store.name}
        color={store.primary_color ?? '#2563EB'}
        currency={store.currency}
        whatsapp={store.whatsapp}
      >
        <ProductDetailView
          store={store}
          product={product}
          related={related ?? []}
        />
        <CartFab />
      </CartProvider>
    </>
  )
}
