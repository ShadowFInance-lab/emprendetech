import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { unstable_noStore } from 'next/cache'
import type { Plan } from '@/lib/types'
import StoreSettingsForm from '@/components/settings/StoreSettingsForm'

export default async function SettingsPage() {
  unstable_noStore() // fuerza store fresco para que cambios de color se apliquen inmediatamente al refrescar
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
    <div className="pb-28">
      <StoreSettingsForm store={store} plan={plan} />
    </div>
  )
}
