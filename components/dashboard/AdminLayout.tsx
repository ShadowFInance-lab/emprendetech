import { redirect } from 'next/navigation'
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

  const [{ data: profile }, { data: store }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('stores').select('*').eq('owner_id', user.id).single(),
  ])

  if (!profile?.onboarding_done || !store) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
