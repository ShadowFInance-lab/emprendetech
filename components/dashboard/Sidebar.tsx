'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Settings, CreditCard, ExternalLink, Menu, X,
  LogOut, Store, FileText, History, UserCog, MessageCircle, Inbox,
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
  { href: '/orders', label: 'Pedidos', icon: Inbox },
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

  const role = profile.role
  const isEmployee = role === 'employee'
  const isSupervisor = role === 'supervisor'
  const isGerente = role === 'gerente'
  const staffNav = [
    { href: '/sales/new', label: 'Ventas (POS)', icon: ShoppingCart },
    { href: '/sales', label: 'Historial', icon: History },
    { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
  ]
  const navItems = isEmployee
    ? staffNav
    : isSupervisor
      ? [...staffNav, { href: '/employees', label: 'Empleados', icon: UserCog }]
      : isGerente
        ? NAV_ITEMS.filter(i => i.href !== '/subscription' && i.href !== '/settings')
        : NAV_ITEMS

  const planLabel: Record<string, string> = {
    free: 'Gratis',
    emprendedor: 'Emprendedor',
    negocio: 'Negocio',
    vip_plus: 'VIP Plus',
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-white/15">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-sm" style={{ color: 'var(--brand-btn, #4f46e5)' }}>M</span>
          </div>
          <span className="font-bold text-white text-lg">Mercanta Business</span>
        </Link>
      </div>

      {/* Store info */}
      <div className="p-4 border-b border-white/15">
        <div className="flex items-center gap-3">
          {store.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo_url} alt={store.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Store size={18} className="text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{store.name}</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/20 text-white">
              {role === 'gerente' ? 'Gerente'
                : role === 'supervisor' ? 'Supervisor'
                : role === 'employee' ? 'Empleado'
                : (planLabel[profile.plan] ?? 'Gratis')}
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
                isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Catálogo público + logout */}
      <div className="p-3 border-t border-white/15">
        <a
          href={`/catalog/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
        >
          <ExternalLink size={16} />
          Ver mi catálogo
        </a>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
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
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col z-30"
        style={{ background: 'var(--brand, #4f46e5)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile toggle button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 border border-white/20 rounded-lg p-2 shadow-sm"
        style={{ background: 'var(--brand, #4f46e5)' }}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-white" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="lg:hidden fixed inset-y-0 left-0 w-72 z-50 flex flex-col shadow-xl"
            style={{ background: 'var(--brand, #4f46e5)' }}
          >
            <button
              className="absolute top-4 right-4"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} className="text-white/70" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
