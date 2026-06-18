import Link from 'next/link'
import { MessageCircle, Search } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/catalog/SocialIcons'
import AdBanner from '@/components/catalog/AdBanner'
import { formatCurrency } from '@/lib/utils/format'
import { buildStoreWhatsAppLink, buildProductWhatsAppLink } from '@/lib/utils/whatsapp'
import type { Store, Category, Product } from '@/lib/types'

interface SkinProps {
  store: Store
  categories: Category[]
  products: Product[]
  activeCategory: string | null
  activeFilter: string | null
  searchQuery: string
  showAds?: boolean
}

export default function MinimalistaSkin({
  store, categories, products, activeCategory, activeFilter, searchQuery, showAds = false,
}: SkinProps) {
  const primary = store.primary_color ?? '#111827'
  const button = store.button_color ?? '#111827'
  const hasWhatsApp = !!store.whatsapp

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily: 'var(--font-playfair), Georgia, serif',
        backgroundColor: store.bg_color || undefined,
        ...(store.background_url ? {
          backgroundImage: `url(${store.background_url})`,
          backgroundSize: ((store as { bg_fit?: string }).bg_fit === 'contain' ? 'contain' : (store as { bg_fit?: string }).bg_fit === 'center' ? 'auto' : 'cover'),
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : {}),
      }}
    >
      <style>{`
        :root { --store-primary: ${primary}; --store-button: ${button}; }
        .min-product-hover:hover { opacity: 0.85; }
        .min-link { border-bottom: 1px solid transparent; }
        .min-link:hover { border-bottom-color: currentColor; }
        .min-link.active { border-bottom-color: ${primary}; }
      `}</style>

      {/* ─── HEADER ───────────────────────────────────────────── */}
      <header className="border-b border-gray-100 sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + nombre */}
            <div className="flex items-center gap-3">
              {store.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
              )}
              <div>
                <h1
                  className="font-bold text-xl tracking-tight"
                  style={{ color: primary, fontFamily: 'var(--font-playfair), serif' }}
                >
                  {store.name}
                </h1>
                {store.tagline && (
                  <p className="text-xs text-gray-400 font-sans">{store.tagline}</p>
                )}
              </div>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-5 text-sm">
              {store.instagram && (
                <a href={store.instagram} target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-900 transition-colors">
                  <InstagramIcon size={16} />
                </a>
              )}
              {store.facebook && (
                <a href={store.facebook} target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-900 transition-colors">
                  <FacebookIcon size={16} />
                </a>
              )}
              {hasWhatsApp && (
                <a
                  href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-xs"
                >
                  <MessageCircle size={14} />
                  Contactar
                </a>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* ─── BANNER (minimalista: solo imagen, sin overlay) ──── */}
      {store.banner_url && (
        <div className="w-full overflow-hidden" style={{ maxHeight: '280px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={store.banner_url}
            alt={`${store.name} banner`}
            className="w-full object-cover"
            style={{ maxHeight: '280px' }}
          />
        </div>
      )}

      {/* ─── HERO TEXTO (sin banner) ─────────────────────────── */}
      {!store.banner_url && store.description && (
        <div className="max-w-5xl mx-auto px-6 py-10 text-center border-b border-gray-100">
          <p
            className="text-gray-500 text-sm max-w-md mx-auto font-sans leading-relaxed"
          >
            {store.description}
          </p>
        </div>
      )}

      {/* ─── MAIN ─────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Búsqueda */}
        <form method="GET" className="mb-8">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar..."
              className="w-full pl-9 pr-4 py-2 text-sm border-0 border-b border-gray-200 focus:outline-none focus:border-gray-900 bg-transparent font-sans transition-colors"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            />
          </div>
          {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        </form>

        {/* Filtros categóricos — texto minimalista */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-8 font-sans text-sm text-gray-500">
            <Link
              href={`/catalog/${store.slug}`}
              className={`min-link pb-0.5 transition-colors hover:text-gray-900 ${!activeCategory && !activeFilter ? 'active text-gray-900 font-medium' : ''}`}
              style={!activeCategory && !activeFilter ? { color: primary } : {}}
            >
              Todo
            </Link>
            {categories.map(cat => (
              <Link
                key={cat.id}
                href={`/catalog/${store.slug}?category=${cat.slug}`}
                className={`min-link pb-0.5 transition-colors hover:text-gray-900 ${activeCategory === cat.slug ? 'active text-gray-900 font-medium' : ''}`}
                style={activeCategory === cat.slug ? { color: primary } : {}}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {/* Resultado count */}
        {(searchQuery || activeCategory) && (
          <p className="text-xs text-gray-400 font-sans mb-6">
            {products.length} resultado{products.length !== 1 ? 's' : ''}
            {searchQuery && ` · "${searchQuery}"`}
          </p>
        )}

        {/* Anuncio — solo plan Free */}
        {showAds && <div className="mb-8"><AdBanner variant="inline" /></div>}

        {/* Grid de productos — ultra limpio */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {products.map(product => {
              const primaryImage = product.product_images?.find(i => i.is_primary) ?? product.product_images?.[0]
              const productUrl = `/catalog/${store.slug}/product/${product.slug}`

              return (
                <div key={product.id} className="group flex flex-col">
                  {/* Imagen */}
                  <Link
                    href={productUrl}
                    className="block relative overflow-hidden aspect-square bg-gray-50 mb-3"
                  >
                    {primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryImage.url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <span className="text-5xl">◻</span>
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-white text-gray-500 text-[10px] uppercase tracking-wider px-2 py-1 font-sans">
                          Agotado
                        </span>
                      </div>
                    )}
                    {product.is_new && product.stock > 0 && (
                      <div className="absolute top-2 left-2">
                        <span
                          className="text-white text-[10px] uppercase tracking-wider px-2 py-1 font-sans"
                          style={{ backgroundColor: primary }}
                        >
                          Nuevo
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* Texto del producto */}
                  <Link href={productUrl} className="block">
                    <h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 group-hover:opacity-70 transition-opacity">
                      {product.name}
                    </h3>
                  </Link>

                  {store.show_prices && (
                    <p className="text-sm font-sans mt-1">
                      {product.compare_at_price ? (
                        <>
                          <span className="text-red-600 font-medium">{formatCurrency(product.sale_price, product.currency || store.currency)}</span>
                          <span className="text-gray-400 line-through ml-2 text-xs">{formatCurrency(product.compare_at_price, product.currency || store.currency)}</span>
                        </>
                      ) : (
                        <span className="text-gray-500">{formatCurrency(product.sale_price, product.currency || store.currency)}</span>
                      )}
                    </p>
                  )}

                  {hasWhatsApp && product.stock > 0 && (
                    <a
                      href={buildProductWhatsAppLink(
                        store.whatsapp!,
                        product.name,
                        product.sale_price,
                        store.name,
                        `${process.env.NEXT_PUBLIC_APP_URL}/catalog/${store.slug}/product/${product.slug}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-sans text-gray-500 hover:text-gray-900 transition-colors border-b border-transparent hover:border-gray-900 pb-0.5 w-fit"
                    >
                      <MessageCircle size={11} />
                      Consultar precio
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-400 font-sans text-sm">Sin productos disponibles</p>
            {(searchQuery || activeCategory) && (
              <Link
                href={`/catalog/${store.slug}`}
                className="text-sm font-sans mt-4 inline-block text-gray-500 hover:text-gray-900 transition-colors underline"
              >
                Ver todo
              </Link>
            )}
          </div>
        )}
      </main>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer className="mt-20 border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 font-sans">
          <span>{store.name}</span>
          <div className="flex gap-4 items-center">
            {store.whatsapp && (
              <a href={buildStoreWhatsAppLink(store.whatsapp, store.name)}
                target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors">
                WhatsApp
              </a>
            )}
            {store.instagram && (
              <a href={store.instagram} target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors">
                Instagram
              </a>
            )}
            {store.facebook && (
              <a href={store.facebook} target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors">
                Facebook
              </a>
            )}
          </div>
          <span>
            Catálogo con{' '}
            <a href="/" className="hover:text-gray-700 transition-colors underline">Mercanta Business</a>
          </span>
        </div>
      </footer>

      {/* WhatsApp flotante minimalista */}
      {hasWhatsApp && (
        <a
          href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
          title="Contactar por WhatsApp"
        >
          <MessageCircle size={22} />
        </a>
      )}
    </div>
  )
}
