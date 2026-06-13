import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History, FileText } from 'lucide-react'
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
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <FileText size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Nueva cotización</h1>
            <p className="text-gray-500 text-sm">Arma la cotización con productos de tu inventario</p>
          </div>
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
