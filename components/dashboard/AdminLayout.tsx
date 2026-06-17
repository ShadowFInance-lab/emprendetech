import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
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

  const themeVars = {
    '--brand': store.primary_color || '#4f46e5',
    '--brand-2': store.secondary_color || '#7c3aed',
    '--brand-btn': store.button_color || '#4f46e5',
  } as CSSProperties

  return (
    <div className="min-h-screen bg-gray-50 flex mb-theme" style={themeVars}>
      <Sidebar store={store} profile={profile} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Header store={store} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
