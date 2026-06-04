import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import AddCustomerButton from '@/components/customers/AddCustomerButton'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) redirect('/onboarding')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('store_id', store.id)
    .order('total_spent', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{customers?.length ?? 0} clientes registrados</p>
        </div>
        <AddCustomerButton />
      </div>

      {customers && customers.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Teléfono</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total gastado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map(customer => (
                <tr key={customer.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 group">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{customer.name}</p>
                        {customer.email && <p className="text-xs text-gray-400">{customer.email}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {customer.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(customer.total_spent)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                    {formatDate(customer.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <Users size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700">Sin clientes aún</h3>
          <p className="text-gray-400 text-sm mt-1 mb-5">
            Agrega tu primer cliente con el botón de arriba, o se crearán solos al registrar ventas
          </p>
          <AddCustomerButton />
        </div>
      )}
    </div>
  )
}
