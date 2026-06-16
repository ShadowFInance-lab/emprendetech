import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMyRole } from '@/lib/actions/employees'
import POSInterface from '@/components/sales/POSInterface'
import EmployeeNotices from '@/components/sales/EmployeeNotices'
import EmployeeClock from '@/components/sales/EmployeeClock'
import MyPayrollCard from '@/components/sales/MyPayrollCard'

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

  const { role } = await getMyRole()
  const isEmployee = role === 'employee'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {presetCustomer && (
            <Link href={`/customers/${presetCustomer.id}`} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nueva venta</h1>
            <p className="text-gray-500 text-xs">
              {presetCustomer ? `Venta para ${presetCustomer.name}` : 'Selecciona productos y registra la venta'}
            </p>
          </div>
        </div>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <History size={15} /> Historial
        </Link>
      </div>
      {isEmployee && <EmployeeClock />}
      {isEmployee && <MyPayrollCard />}
      <EmployeeNotices />
      <POSInterface presetCustomer={presetCustomer} />
    </div>
  )
}
