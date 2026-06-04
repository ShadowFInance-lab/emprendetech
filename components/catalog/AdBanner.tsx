import Link from 'next/link'
import { Sparkles } from 'lucide-react'

/**
 * Banner de anuncio que SOLO se muestra en catálogos de tiendas con plan Free.
 * Los planes de pago no lo ven (Fix A — monetización).
 *
 * En producción, aquí iría el slot de Google AdSense o publicidad propia.
 * Por ahora promociona el upgrade a EmprendeTech.
 */
export default function AdBanner({ variant = 'inline' }: { variant?: 'inline' | 'footer' }) {
  if (variant === 'footer') {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 text-center text-sm">
        <span className="opacity-90">
          ¿Te gusta este catálogo? Crea el tuyo gratis en{' '}
          <Link href="/" className="font-bold underline hover:opacity-80">
            EmprendeTech
          </Link>
        </span>
      </div>
    )
  }

  return (
    <div className="col-span-full">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-amber-900" />
          </div>
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              ¿Tienes un negocio?
            </p>
            <p className="text-amber-700 text-xs">
              Crea tu catálogo profesional gratis y vende por WhatsApp
            </p>
          </div>
        </div>
        <Link
          href="/register"
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Empezar gratis
        </Link>
      </div>
    </div>
  )
}
