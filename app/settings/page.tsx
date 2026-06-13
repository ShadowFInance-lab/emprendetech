import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StoreSettingsForm from '@/components/settings/StoreSettingsForm'
import EmployeesSection from '@/components/settings/EmployeesSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('*').eq('owner_id', user.id).single()
  if (!store) redirect('/onboarding')

  // Plan del usuario → para limitar skins disponibles (Fix A) + rol (jefe/empleado)
  const { data: profile } = await supabase
    .from('profiles').select('plan, role').eq('id', user.id).single()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de tienda</h1>
        <p className="text-gray-500 text-sm mt-1">
          Personaliza cómo aparece tu tienda en el catálogo público
        </p>
      </div>
      <StoreSettingsForm store={store} plan={profile?.plan ?? 'free'} />
      {profile?.role !== 'employee' && <EmployeesSection plan={profile?.plan ?? 'free'} />}
    </div>
  )
}
