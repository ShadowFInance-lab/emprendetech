import { ExternalLink } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NotificationBell from '@/components/dashboard/NotificationBell'
import type { Store } from '@/lib/types'

interface HeaderProps {
  store: Store
}

export default function Header({ store }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      {/* Espacio para el botón móvil */}
      <div className="w-8 lg:w-0" />

      {/* Centro: nombre de la tienda en mobile */}
      <h1 className="lg:hidden font-semibold text-gray-900 text-sm truncate px-4">
        {store.name}
      </h1>

      {/* Derecha: acciones */}
      <div className="flex items-center gap-2">
        {/* Traductor de idioma */}
        <LanguageSwitcher />

        {/* Campana de notificaciones (recordatorios vencidos) */}
        <NotificationBell />

        {/* Ver catálogo */}
        <a
          href={`/catalog/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--brand, #2563eb)', borderColor: 'color-mix(in srgb, var(--brand, #2563eb) 30%, #e5e7eb)' }}
        >
          <ExternalLink size={13} />
          Ver catálogo
        </a>
      </div>
    </header>
  )
}
