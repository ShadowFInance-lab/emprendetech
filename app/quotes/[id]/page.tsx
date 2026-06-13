import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getQuote } from '@/lib/actions/quotes'
import QuoteBuilder from '@/components/quotes/QuoteBuilder'
import QuoteActions from '@/components/quotes/QuoteActions'
import type { QuoteExportStore } from '@/lib/utils/quoteExport'

const STATUS_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  expirada: 'bg-amber-100 text-amber-700',
  convertida: 'bg-purple-100 text-purple-700',
}
const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada',
  rechazada: 'Rechazada', expirada: 'Expirada', convertida: 'Convertida en venta',
}

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const quote = await getQuote(params.id)
  if (!quote) redirect('/quotes')

  const { data: store } = await supabase
    .from('stores').select('name, phone, email, address, logo_url, currency').eq('owner_id', user.id).single()

  const { data: customers } = await supabase
    .from('customers').select('id, name, phone').eq('store_id', quote.store_id).order('name')

  let customerEmail: string | null = null
  let customerPhone: string | null = null
  if (quote.customer_id) {
    const { data: c } = await supabase
      .from('customers').select('email, phone').eq('id', quote.customer_id).single()
    customerEmail = c?.email ?? null
    customerPhone = c?.phone ?? null
  }

  const exportStore: QuoteExportStore = {
    name: store?.name ?? 'Mi negocio',
    phone: store?.phone, email: store?.email, address: store?.address,
    logo_url: store?.logo_url, currency: store?.currency ?? 'MXN',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {quote.folio}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.borrador}`}>
                {STATUS_LABEL[quote.status] ?? quote.status}
              </span>
            </h1>
            <p className="text-gray-500 text-xs">{quote.customer_name || 'Sin cliente'} · edita y guarda los cambios</p>
          </div>
        </div>
      </div>

      <QuoteActions
        quote={quote}
        store={exportStore}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
      />

      <QuoteBuilder
        mode="edit"
        quoteId={quote.id}
        customers={customers ?? []}
        currency={exportStore.currency}
        initial={{
          customer_id: quote.customer_id,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_phone: quote.customer_phone,
          customer_address: quote.customer_address,
          customer_rfc: quote.customer_rfc,
          items: quote.items,
          discount_amt: quote.discount_amt,
          notes: quote.notes,
          valid_until: quote.valid_until,
          payment_method: quote.payment_method,
          deposit_pct: quote.deposit_pct,
          delivery_time: quote.delivery_time,
          status: quote.status,
        }}
      />
    </div>
  )
}
