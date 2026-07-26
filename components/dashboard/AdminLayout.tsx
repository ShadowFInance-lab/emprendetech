import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { unstable_noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'

/**
 * Shell compartido para TODAS las rutas protegidas del dashboard.
 * Hace el auth check, carga store + profile, y renderiza Sidebar + Header.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  unstable_noStore() // fuerza datos frescos (sin caché) para que colores de tienda se apliquen al refrescar
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isEmployee = profile?.role === 'employee'

  // Tienda efectiva: la propia (dueño) o la del jefe (empleado)
  let { data: store } = await supabase.from('stores').select('*').eq('owner_id', user.id).maybeSingle()
  if (!store && profile?.boss_id) {
    const { data: bossStore } = await supabase.from('stores').select('*').eq('owner_id', profile.boss_id).maybeSingle()
    store = bossStore
  }

  if (!isEmployee && (!profile?.onboarding_done || !store)) redirect('/onboarding')
  if (!store) redirect('/login') // empleado sin tienda asignada (caso raro)

  const s = store as typeof store & { panel_primary?: string | null; panel_secondary?: string | null; panel_button?: string | null; dashboard_bg_url?: string | null; dashboard_bg_fit?: string | null; dashboard_bg_position?: string | null; dashboard_bg_color?: string | null }
  const themeVars = {
    '--brand': s.panel_primary || store.primary_color || '#4f46e5',
    '--brand-2': s.panel_secondary || store.secondary_color || '#7c3aed',
    '--brand-btn': s.panel_button || store.button_color || '#4f46e5',
  } as CSSProperties

  const dashBg = s.dashboard_bg_url || null
  const dashBgColor = s.dashboard_bg_color || null
  const fit = s.dashboard_bg_fit || 'cover'
  const bgSize = fit === 'contain' ? 'contain' : fit === 'fill' ? '100% 100%' : 'cover'
  const bgPos = s.dashboard_bg_position || 'center'
  const hasBg = !!(dashBg || dashBgColor)
  const contentStyle: CSSProperties = dashBg ? {
    backgroundImage: `url(${dashBg})`,
    backgroundSize: bgSize,
    backgroundPosition: bgPos,
    backgroundRepeat: 'no-repeat',
  } : (dashBgColor ? { backgroundColor: dashBgColor } : {})

  // NOTA (v7.139): antes se forzaba un color de texto claro (#f8fafc) en TODO el
  // contenido cuando el fondo del panel era oscuro. Como las tarjetas, inputs y
  // botones son blancos, el texto quedaba BLANCO SOBRE BLANCO = invisible
  // (inventario, formularios, botones "Editar"/"Guardar"). Ya no se hereda color:
  // el contenido va siempre sobre una superficie clara y con su color normal.

  return (
    <div className={`min-h-screen flex mb-theme ${hasBg ? 'bg-transparent' : 'bg-gray-50'}`} style={themeVars}>
      <Sidebar store={store} profile={profile} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 text-gray-900" style={contentStyle}>
        <Header store={store} hasBg={hasBg} />
        {/* Superficie clara SIEMPRE (semitransparente si hay fondo) para que el
            texto oscuro se lea sobre cualquier imagen o color de fondo. */}
        <main className={`flex-1 p-4 lg:p-6 overflow-auto text-gray-900 ${hasBg ? 'bg-white/80 backdrop-blur-sm' : 'bg-white/90'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
