import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import QuoteBuilder from '@/components/quotes/QuoteBuilder'

export default async function NewQuotePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('id, currency').eq('owner_id', user.id).single()
  if (!store) redirect('/onboarding')

  const { data: customers } = await supabase
    .from('customers').select('id, name, phone').eq('store_id', store.id).order('name')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva cotización</h1>
          <p className="text-gray-500 text-xs">Arma la cotización con productos de tu inventario</p>
        </div>
        <Link href="/quotes"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
          <History size={15} /> Historial
        </Link>
      </div>
      <QuoteBuilder mode="create" customers={customers ?? []} currency={store.currency ?? 'MXN'} />
    </div>
  )
}
