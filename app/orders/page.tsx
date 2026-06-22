import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OrdersPanel from '@/components/orders/OrdersPanel'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()

  // Solo el dueño gestiona pedidos
  if (profile?.role === 'employee' || profile?.role === 'supervisor') redirect('/sales/new')

  return (
    <div className="max-w-[1500px] space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Inbox size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Pedidos Online</h1>
          <p className="text-gray-500 text-sm">Pedidos de «Compra Online» de tu catálogo. Cambia el estado para darles seguimiento.</p>
        </div>
      </div>
      <OrdersPanel />
    </div>
  )
}
