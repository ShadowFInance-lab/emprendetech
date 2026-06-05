import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import POSInterface from '@/components/sales/POSInterface'

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: { customer?: string }
}) {
  // Si viene ?customer=<id> (venta directa desde la ficha), precargar ese cliente
  let presetCustomer: { id: string; name: string; phone: string | null } | undefined
  const customerId = searchParams?.customer

  if (customerId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: store } = await supabase
        .from('stores').select('id').eq('owner_id', user.id).single()
      if (store) {
        const { data: customer } = await supabase
          .from('customers')
          .select('id, name, phone')
          .eq('id', customerId)
          .eq('store_id', store.id)
          .single()
        if (customer) presetCustomer = customer
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={presetCustomer ? `/customers/${presetCustomer.id}` : '/sales'} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva venta</h1>
          <p className="text-gray-500 text-xs">
            {presetCustomer ? `Venta para ${presetCustomer.name}` : 'Selecciona productos y registra la venta'}
          </p>
        </div>
      </div>
      <POSInterface presetCustomer={presetCustomer} />
    </div>
  )
}
