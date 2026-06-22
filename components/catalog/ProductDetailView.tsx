'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, ChevronLeft, Share2 } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/catalog/SocialIcons'
import { formatCurrency } from '@/lib/utils/format'
import { buildStoreWhatsAppLink, buildProductWhatsAppLink } from '@/lib/utils/whatsapp'
import AddToCartButtons from '@/components/catalog/cart/AddToCartButtons'
import type { Store, Product } from '@/lib/types'

interface Props {
  store: Store
  product: Product & {
    product_images: { id: string; url: string; is_primary: boolean; sort_order: number }[]
    categories: { name: string; slug: string } | null
  }
  related: Product[]
}

export default function ProductDetailView({ store, product, related }: Props) {
  const primary = store.primary_color ?? '#2563EB'
  const isMinimalista = store.skin === 'minimalista'
  const hasWhatsApp = !!store.whatsapp
  // Modo Venta Online: oculta WhatsApp, muestra carrito
  const online_sales = !!(store as { online_sales?: boolean }).online_sales
  const showWA = hasWhatsApp && !online_sales
  const catalogUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/catalog/${store.slug}`
  const productUrl = `${catalogUrl}/product/${product.slug}`

  const images = product.product_images ?? []
  const [activeImage, setActiveImage] = useState(
    images.find(i => i.is_primary)?.url ?? images[0]?.url ?? null
  )

  const isOut = product.stock === 0

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: product.name, url: productUrl })
    } else {
      await navigator.clipboard.writeText(productUrl)
      alert('Enlace copiado al portapapeles')
    }
  }

  return (
    <div
      className={`min-h-screen ${isMinimalista ? 'bg-white' : 'bg-gray-50'}`}
      style={{ fontFamily: isMinimalista ? 'var(--font-playfair), serif' : 'var(--font-inter), sans-serif' }}
    >
      {/* Header mini */}
      <header
        className={`sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b ${
          isMinimalista ? 'bg-white border-gray-100' : 'shadow-sm'
        }`}
        style={!isMinimalista ? {
          background: `linear-gradient(135deg, ${primary} 0%, ${primary}cc 100%)`,
        } : {}}
      >
        <Link
          href={`/catalog/${store.slug}`}
          className={`flex items-center gap-1.5 text-sm font-medium ${
            isMinimalista ? 'text-gray-600 hover:text-gray-900' : 'text-white/90 hover:text-white'
          } transition-colors`}
        >
          <ChevronLeft size={16} />
          {store.name}
        </Link>

        <div className="flex items-center gap-3">
          {store.instagram && (
            <a href={store.instagram} target="_blank" rel="noopener noreferrer"
              className={isMinimalista ? 'text-gray-400 hover:text-gray-900' : 'text-white/80 hover:text-white'}>
              <InstagramIcon size={16} />
            </a>
          )}
          {store.facebook && (
            <a href={store.facebook} target="_blank" rel="noopener noreferrer"
              className={isMinimalista ? 'text-gray-400 hover:text-gray-900' : 'text-white/80 hover:text-white'}>
              <FacebookIcon size={16} />
            </a>
          )}
          <button
            onClick={handleShare}
            className={isMinimalista ? 'text-gray-400 hover:text-gray-900' : 'text-white/80 hover:text-white'}
          >
            <Share2 size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

          {/* ─── Galería de imágenes ────────────────────────── */}
          <div className="space-y-3">
            {/* Imagen principal */}
            <div className={`aspect-square overflow-hidden rounded-2xl bg-gray-100 ${
              isMinimalista ? 'rounded-none' : ''
            }`}>
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <span className="text-6xl">📦</span>
                </div>
              )}
            </div>

            {/* Miniaturas */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map(img => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(img.url)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImage === img.url
                        ? 'border-blue-500 scale-105'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    style={activeImage === img.url ? { borderColor: primary } : {}}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Info del producto ──────────────────────────── */}
          <div className="space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-gray-400 font-sans">
              <Link href={`/catalog/${store.slug}`} className="hover:underline">
                {store.name}
              </Link>
              {product.categories && (
                <>
                  <span>/</span>
                  <Link
                    href={`/catalog/${store.slug}?category=${product.categories.slug}`}
                    className="hover:underline"
                  >
                    {product.categories.name}
                  </Link>
                </>
              )}
            </div>

            {/* Nombre */}
            <div>
              <h1 className={`text-2xl sm:text-3xl font-bold leading-tight ${
                isMinimalista ? 'font-serif' : ''
              }`}>
                {product.name}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                {product.is_new && (
                  <span
                    className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full font-sans"
                    style={{ backgroundColor: primary }}
                  >
                    NUEVO
                  </span>
                )}
                {isOut && (
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full font-sans">
                    AGOTADO
                  </span>
                )}
                {product.is_featured && !isOut && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-sans">
                    ⭐ DESTACADO
                  </span>
                )}
              </div>
            </div>

            {/* Precio */}
            {store.show_prices && (
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className={`font-bold ${isMinimalista ? 'text-2xl' : 'text-3xl'} ${product.compare_at_price ? 'text-red-600' : ''}`}
                    style={!isMinimalista && !product.compare_at_price ? { color: primary } : {}}>
                    {formatCurrency(product.sale_price, product.currency || store.currency)}
                  </p>
                  {product.compare_at_price && (
                    <>
                      <p className="text-lg text-gray-400 line-through">{formatCurrency(product.compare_at_price, product.currency || store.currency)}</p>
                      <span className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full">
                        -{Math.round((1 - product.sale_price / product.compare_at_price) * 100)}%
                      </span>
                    </>
                  )}
                </div>
                {product.stock > 0 && product.stock <= 5 && (
                  <p className="text-xs text-amber-600 font-sans mt-1">
                    ⚠️ Últimas {product.stock} unidades
                  </p>
                )}
              </div>
            )}

            {/* Descripción */}
            {product.description && (
              <div>
                <p className={`text-gray-600 leading-relaxed text-sm ${isMinimalista ? 'font-sans' : ''}`}>
                  {product.description}
                </p>
              </div>
            )}

            {/* Línea divisora */}
            <hr className="border-gray-100" />

            {/* CTA: WhatsApp — verde fuerte, grande, premium */}
            {showWA && !isOut && (
              <a
                href={buildProductWhatsAppLink(
                  store.whatsapp!,
                  product.name,
                  product.sale_price,
                  store.name,
                  productUrl
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2.5 w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold text-base sm:text-lg transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/30 ${
                  isMinimalista ? 'rounded-none' : 'rounded-2xl'
                }`}
              >
                <MessageCircle size={22} />
                Pedir por WhatsApp
              </a>
            )}

            {/* CTA: Carrito (si la tienda activó Vender Online) */}
            {online_sales && !isOut && (
              <AddToCartButtons
                product={{ product_id: product.id, name: product.name, price: product.sale_price, image_url: activeImage ?? null }}
                rounded={isMinimalista ? 'rounded-none' : 'rounded-2xl'}
              />
            )}

            {/* CTA: Solo WhatsApp de tienda si agotado */}
            {showWA && isOut && (
              <a
                href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 text-gray-600 font-medium text-sm transition-all hover:bg-gray-50 font-sans"
              >
                <MessageCircle size={18} />
                Consultar disponibilidad
              </a>
            )}

            {/* Info adicional */}
            {product.sku && (
              <p className="text-xs text-gray-400 font-sans">SKU: {product.sku}</p>
            )}
          </div>
        </div>

        {/* ─── Productos relacionados ─────────────────────────── */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className={`text-xl font-bold mb-6 ${isMinimalista ? 'font-serif' : ''}`}>
              También te puede interesar
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map(relProduct => {
                const relImg = (relProduct.product_images as { url: string; is_primary: boolean }[])
                  ?.find(i => i.is_primary) ?? (relProduct.product_images as { url: string }[])?.[0]

                return (
                  <Link
                    key={relProduct.id}
                    href={`/catalog/${store.slug}/product/${relProduct.slug}`}
                    className="group"
                  >
                    <div className={`aspect-square overflow-hidden bg-gray-100 mb-2 ${
                      isMinimalista ? '' : 'rounded-xl'
                    }`}>
                      {relImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={relImg.url}
                          alt={relProduct.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <span className="text-3xl">📦</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:opacity-70 transition-opacity">
                      {relProduct.name}
                    </p>
                    {store.show_prices && (
                      <p className="text-xs text-gray-500 font-sans mt-0.5">
                        {formatCurrency(relProduct.sale_price, relProduct.currency || store.currency)}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Volver al catálogo */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <Link
            href={`/catalog/${store.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity font-sans"
            style={{ color: primary }}
          >
            <ChevronLeft size={16} />
            Volver al catálogo de {store.name}
          </Link>
        </div>
      </main>
    </div>
  )
}
