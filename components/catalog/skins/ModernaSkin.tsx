import Link from 'next/link'
import { MessageCircle, Search, Star, Zap, TrendingUp } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/catalog/SocialIcons'
import AdBanner from '@/components/catalog/AdBanner'
import AddToCartButtons from '@/components/catalog/cart/AddToCartButtons'
import { formatCurrency } from '@/lib/utils/format'
import { buildStoreWhatsAppLink, buildProductWhatsAppLink } from '@/lib/utils/whatsapp'
import { getAppUrl } from '@/lib/utils/app-url'
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

export default function ModernaSkin({
  store, categories, products, activeCategory, activeFilter, searchQuery, showAds = false,
}: SkinProps) {
  const primary = store.primary_color ?? '#2563EB'
  const secondary = store.secondary_color ?? '#1E40AF'
  const button = store.button_color ?? '#16A34A'
  const hasWhatsApp = !!store.whatsapp
  // Modo Venta Online: oculta WhatsApp y muestra carrito
  const online_sales = !!(store as { online_sales?: boolean }).online_sales
  const showWA = hasWhatsApp && !online_sales

  const filters = [
    { id: null, label: 'Todo', icon: null },
    { id: 'featured', label: 'Destacados', icon: Star },
    { id: 'new', label: 'Nuevos', icon: Zap },
    { id: 'best_sellers', label: 'Más vendidos', icon: TrendingUp },
  ]

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        fontFamily: 'var(--font-inter), sans-serif',
        backgroundColor: store.bg_color || undefined,
        ...(store.background_url ? {
          backgroundImage: `url(${store.background_url})`,
          backgroundSize: ((store as { bg_fit?: string }).bg_fit === 'contain' ? 'contain' : (store as { bg_fit?: string }).bg_fit === 'fill' ? '100% 100%' : 'cover'),
          backgroundPosition: (store as { bg_position?: string }).bg_position || 'center',
          backgroundRepeat: 'no-repeat',
          // Fijo al viewport: el fondo cubre la pantalla y no se estira raro en
          // catálogos largos (antes se escalaba a toda la altura de la página).
          backgroundAttachment: 'fixed',
        } : {}),
      }}
    >
      {/* CSS variables de la tienda */}
      <style>{`
        :root {
          --store-primary: ${primary};
          --store-button: ${button};
        }
      `}</style>

      {/* ─── HEADER ───────────────────────────────────────────── */}
      <header
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
        className="sticky top-0 z-40 shadow-xl backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + Nombre */}
          <div className="flex items-center gap-3 min-w-0">
            {store.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logo_url}
                alt={store.name}
                className="w-11 h-11 rounded-2xl object-cover flex-shrink-0 ring-2 ring-white/40 shadow-md"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-white/20 ring-2 ring-white/30 flex items-center justify-center flex-shrink-0 shadow-md">
                <span className="text-white font-bold text-xl">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-white font-bold text-lg sm:text-xl leading-tight truncate tracking-tight">
                {store.name}
              </h1>
              {store.tagline && (
                <p className="text-white/75 text-xs sm:text-sm truncate">{store.tagline}</p>
              )}
            </div>
          </div>

          {/* Redes + WhatsApp */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {store.instagram && (
              <a href={store.instagram} target="_blank" rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all hover:scale-110 backdrop-blur-sm">
                <InstagramIcon size={18} />
              </a>
            )}
            {store.facebook && (
              <a href={store.facebook} target="_blank" rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all hover:scale-110 backdrop-blur-sm">
                <FacebookIcon size={18} />
              </a>
            )}
            {showWA && (
              <a
                href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-3 sm:px-5 py-2.5 rounded-full shadow-lg shadow-black/10 transition-all hover:scale-105 ring-1 ring-white/20"
              >
                <MessageCircle size={18} />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ─── BANNER (hero) ────────────────────────────────────── */}
      {store.banner_url && (
        <div className="relative w-full overflow-hidden h-56 sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={store.banner_url}
            alt={`Banner de ${store.name}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10 flex flex-col justify-end">
            <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-7 sm:pb-10">
              <h2 className="text-white text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-lg">
                {store.name}
              </h2>
              {store.description && (
                <p className="text-white/90 text-sm sm:text-lg max-w-xl mt-2 leading-relaxed drop-shadow line-clamp-2">
                  {store.description}
                </p>
              )}
              {showWA && (
                <a
                  href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 bg-green-500 hover:bg-green-600 text-white font-bold px-5 py-3 rounded-full shadow-xl transition-all hover:scale-105 text-sm sm:text-base"
                >
                  <MessageCircle size={20} /> Pedir por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENIDO PRINCIPAL ─────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-7">

        {/* Barra de búsqueda */}
        <form method="GET" className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Buscar productos..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 text-sm"
            style={{ '--tw-ring-color': primary } as React.CSSProperties}
          />
          {activeCategory && (
            <input type="hidden" name="category" value={activeCategory} />
          )}
        </form>

        {/* Filtros + Categorías */}
        <div className="flex flex-wrap gap-2">
          {/* Filtros especiales */}
          {filters.map(f => {
            const isActive = activeFilter === f.id && !activeCategory
            const href = f.id
              ? `/catalog/${store.slug}?filter=${f.id}`
              : `/catalog/${store.slug}`
            return (
              <Link
                key={String(f.id)}
                href={href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm'
                }`}
                style={isActive ? { backgroundColor: primary } : {}}
              >
                {f.icon && <f.icon size={13} />}
                {f.label}
              </Link>
            )
          })}

          {/* Categorías */}
          {categories.map(cat => {
            const isActive = activeCategory === cat.slug
            return (
              <Link
                key={cat.id}
                href={`/catalog/${store.slug}?category=${cat.slug}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm'
                }`}
                style={isActive ? { backgroundColor: primary } : {}}
              >
                {cat.name}
              </Link>
            )
          })}
        </div>

        {/* Contador de resultados */}
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm">
            {products.length === 0
              ? 'Sin productos'
              : `${products.length} producto${products.length !== 1 ? 's' : ''}`}
            {searchQuery && ` para "${searchQuery}"`}
          </p>
          {(searchQuery || activeCategory || activeFilter) && (
            <Link
              href={`/catalog/${store.slug}`}
              className="text-sm font-medium"
              style={{ color: primary }}
            >
              Ver todos
            </Link>
          )}
        </div>

        {/* Anuncio — solo plan Free */}
        {showAds && <AdBanner variant="inline" />}

        {/* Grid de productos */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {products.map(product => {
              const primaryImage = product.product_images?.find(i => i.is_primary) ?? product.product_images?.[0]
              const productUrl = `/catalog/${store.slug}/product/${product.slug}`

              return (
                <div
                  key={product.id}
                  className={`group ${store.background_url ? 'bg-white/75 backdrop-blur-sm' : 'bg-white'} rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 overflow-hidden flex flex-col border border-gray-100/80 hover:-translate-y-1`}
                >
                  {/* Imagen */}
                  <Link href={productUrl} className="block relative overflow-hidden aspect-square bg-gray-100">
                    {primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryImage.url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <span className="text-4xl">📦</span>
                      </div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                      {product.compare_at_price && (
                        <span className="text-[10px] font-bold text-white bg-red-500 px-2.5 py-1 rounded-full shadow-sm">
                          -{Math.round((1 - product.sale_price / product.compare_at_price) * 100)}%
                        </span>
                      )}
                      {product.is_new && (
                        <span className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm"
                          style={{ backgroundColor: primary }}>
                          NUEVO
                        </span>
                      )}
                      {product.is_featured && (
                        <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full shadow-sm">
                          ⭐ TOP
                        </span>
                      )}
                    </div>
                    {/* Stock agotado */}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                          AGOTADO
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="p-3.5 flex flex-col flex-1">
                    <Link href={productUrl}>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-gray-600 transition-colors min-h-[2.5rem]">
                        {product.name}
                      </h3>
                    </Link>

                    <div className="mt-auto pt-2.5 space-y-2.5">
                      {store.show_prices && (
                        product.compare_at_price ? (
                          <div className="flex items-baseline gap-2">
                            <p className="text-xl font-extrabold tracking-tight text-red-600">
                              {formatCurrency(product.sale_price, product.currency || store.currency)}
                            </p>
                            <p className="text-sm text-gray-400 line-through">{formatCurrency(product.compare_at_price, product.currency || store.currency)}</p>
                          </div>
                        ) : (
                          <p className="text-xl font-extrabold tracking-tight" style={{ color: primary }}>
                            {formatCurrency(product.sale_price, product.currency || store.currency)}
                          </p>
                        )
                      )}

                      {online_sales && product.stock > 0 && (
                        <AddToCartButtons
                          variant="compact"
                          storeSlug={store.slug}
                          product={{ product_id: product.id, name: product.name, price: product.sale_price, image_url: primaryImage?.url ?? null }}
                          productVariants={product.variants}
                        />
                      )}
                      {showWA && product.stock > 0 && (
                        <a
                          href={buildProductWhatsAppLink(
                            store.whatsapp!,
                            product.name,
                            product.sale_price,
                            store.name,
                            `${getAppUrl()}/catalog/${store.slug}/product/${product.slug}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold shadow-lg shadow-green-500/25 transition-all hover:scale-[1.03] active:scale-95"
                        >
                          <MessageCircle size={17} />
                          Pedir por WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <h3 className="text-lg font-semibold text-gray-700">Sin resultados</h3>
            <p className="text-gray-400 text-sm mt-2">
              Intenta con otra búsqueda o categoría
            </p>
            <Link
              href={`/catalog/${store.slug}`}
              className="inline-block mt-4 text-sm font-medium"
              style={{ color: primary }}
            >
              Ver todos los productos
            </Link>
          </div>
        )}
      </main>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer className="mt-16 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Columna 1: Marca */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                {store.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logo_url} alt={store.name} className="w-11 h-11 rounded-xl object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-lg"
                    style={{ backgroundColor: primary }}>
                    {store.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-white font-bold text-xl">{store.name}</p>
              </div>
              {store.description && (
                <p className="text-sm leading-relaxed text-gray-400 max-w-xs">
                  {store.description}
                </p>
              )}
            </div>

            {/* Columna 2: Contacto */}
            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                Contacto
              </h4>
              <ul className="space-y-2.5 text-sm">
                {showWA && store.whatsapp && (
                  <li>
                    <a href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-white transition-colors">
                      <MessageCircle size={16} className="text-green-400" />
                      {store.whatsapp}
                    </a>
                  </li>
                )}
                {showWA && (
                  <li className="text-gray-500 text-xs pt-1">
                    Haz tu pedido por WhatsApp · Envíos a todo México
                  </li>
                )}
              </ul>
            </div>

            {/* Columna 3: Redes sociales */}
            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                Síguenos
              </h4>
              <div className="flex gap-3">
                {showWA && (
                  <a href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
                    target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                    className="w-11 h-11 rounded-full bg-gray-800 hover:bg-green-500 text-white flex items-center justify-center transition-all hover:scale-110">
                    <MessageCircle size={20} />
                  </a>
                )}
                {store.instagram && (
                  <a href={store.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                    className="w-11 h-11 rounded-full bg-gray-800 hover:bg-pink-600 text-white flex items-center justify-center transition-all hover:scale-110">
                    <InstagramIcon size={20} />
                  </a>
                )}
                {store.facebook && (
                  <a href={store.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                    className="w-11 h-11 rounded-full bg-gray-800 hover:bg-blue-600 text-white flex items-center justify-center transition-all hover:scale-110">
                    <FacebookIcon size={20} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="border-t border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <span>© {new Date().getFullYear()} {store.name}. Todos los derechos reservados.</span>
            <span>
              Catálogo creado con{' '}
              <a href="/" className="text-blue-400 hover:underline font-medium">Mercanta Business</a>
            </span>
          </div>
        </div>
      </footer>

      {/* ─── WhatsApp flotante — oculto cuando Venta Online activa (usa el carrito persistente) */}
      {showWA && (
        <a
          href={buildStoreWhatsAppLink(store.whatsapp!, store.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-green-500 hover:bg-green-600 text-white pl-4 pr-5 py-3.5 rounded-full shadow-2xl shadow-green-900/30 transition-all hover:scale-105 ring-4 ring-green-500/20"
        >
          <MessageCircle size={24} />
          <span className="text-base font-bold hidden sm:inline">Contáctanos</span>
        </a>
      )}
    </div>
  )
}
