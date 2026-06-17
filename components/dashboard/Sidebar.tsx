'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Settings, CreditCard, ExternalLink, Menu, X,
  LogOut, Store, FileText, History, UserCog, MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/actions/auth'
import type { Store as StoreType, Profile } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Ganancias', icon: LayoutDashboard },
  { href: '/quotes', label: 'Cotizaciones', icon: FileText },
  { href: '/employees', label: 'Empleados', icon: UserCog },
  { href: '/inventory', label: 'Inventario', icon: Package },
  { href: '/sales/new', label: 'Ventas', icon: ShoppingCart },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/settings', label: 'Configuración', icon: Settings },
  { href: '/subscription', label: 'Suscripción', icon: CreditCard },
]

interface SidebarProps {
  store: StoreType
  profile: Profile
}

export default function Sidebar({ store, profile }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Empleados/supervisores: POS + historial + mensajes. El dueño ve todo.
  const role = profile.role
  const isStaff = role === 'employee' || role === 'supervisor'
  const brand = store.primary_color || '#2563eb'
  const navItems = isStaff
    ? [
        { href: '/sales/new', label: 'Ventas (POS)', icon: ShoppingCart },
        { href: '/sales', label: 'Historial', icon: History },
        { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
      ]
    : NAV_ITEMS

  const planBadgeColor: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600',
    emprendedor: 'bg-blue-100 text-blue-700',
    negocio: 'bg-purple-100 text-purple-700',
    vip_plus: 'bg-amber-100 text-amber-700',
  }

  const planLabel: Record<string, string> = {
    free: 'Gratis',
    emprendedor: 'Emprendedor',
    negocio: 'Negocio',
    vip_plus: 'VIP Plus',
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brand }}>
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">Mercanta Business</span>
        </Link>
      </div>

      {/* Store info */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {store.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo_url} alt={store.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Store size={18} className="text-blue-600" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{store.name}</p>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              role === 'supervisor' ? 'bg-indigo-100 text-indigo-700'
                : role === 'employee' ? 'bg-emerald-100 text-emerald-700'
                : (planBadgeColor[profile.plan] ?? planBadgeColor.free)
            )}>
              {role === 'supervisor' ? 'Supervisor' : role === 'employee' ? 'Empleado' : (planLabel[profile.plan] ?? 'Gratis')}
            </span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              style={isActive ? { backgroundColor: brand } : undefined}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Catálogo público */}
      <div className="p-3 border-t border-gray-100">
        <a
          href={`/catalog/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <ExternalLink size={16} />
          Ver mi catálogo
        </a>

        {/* Logout */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile toggle button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-white border border-gray-200 rounded-lg p-2 shadow-sm"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 flex flex-col shadow-xl">
            <button
              className="absolute top-4 right-4"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} className="text-gray-500" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
