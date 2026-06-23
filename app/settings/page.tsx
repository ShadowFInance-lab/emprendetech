import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/lib/types'
import StoreSettingsForm from '@/components/settings/StoreSettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('*').eq('owner_id', user.id).maybeSingle()
  if (!store) redirect('/onboarding')

  // select('*') es tolerante si falta la columna role (migración 018 no aplicada)
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).maybeSingle()
  const plan = ((profile?.plan as Plan) ?? 'free')

  return (
    <div className="max-w-3xl space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de tienda</h1>
        <p className="text-gray-500 text-sm mt-1">
          Personaliza cómo aparece tu tienda en el catálogo público
        </p>
      </div>
      <StoreSettingsForm store={store} plan={plan} />
    </div>
  )
}
