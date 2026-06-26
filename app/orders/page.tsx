import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OrdersPanel from '@/components/orders/OrdersPanel'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, plan').eq('id', user.id).maybeSingle()

  // Solo el dueño gestiona pedidos
  if (profile?.role === 'employee' || profile?.role === 'supervisor') redirect('/sales/new')

  const paidPlans = ['emprendedor', 'negocio', 'vip_plus']
  const isPaid = paidPlans.includes((profile?.plan as string) ?? 'free')

  if (!isPaid) {
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
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">Disponible en plan pago.</p>
        </div>
      </div>
    )
  }

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
