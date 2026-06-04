import Link from 'next/link'
import { Bell, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import type { Store } from '@/lib/types'

interface HeaderProps {
  store: Store
}

export default async function Header({ store }: HeaderProps) {
  const supabase = await createClient()

  // Contar alertas no leídas
  const { count: unreadAlerts } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('is_read', false)

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

        {/* Alertas */}
        <Link href="/dashboard" className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell size={18} className="text-gray-600" />
          {unreadAlerts && unreadAlerts > 0 ? (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {unreadAlerts > 9 ? '9+' : unreadAlerts}
            </span>
          ) : null}
        </Link>

        {/* Ver catálogo */}
        <a
          href={`/catalog/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ExternalLink size={13} />
          Ver catálogo
        </a>
      </div>
    </header>
  )
}
