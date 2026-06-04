import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLAN_LIMITS } from '@/lib/constants/plans'
import { isMercadoPagoConfigured } from '@/lib/mercadopago/client'
import { getMeteredUsage } from '@/lib/actions/subscriptions'
import { formatCurrency } from '@/lib/utils/format'
import UpgradeButton from '@/components/subscription/UpgradeButton'
import type { Plan } from '@/lib/types'

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: ['100 productos', 'Catálogo público', '1 skin', 'POS básico', 'Con anuncios'],
  emprendedor: ['5,000 productos', 'Sin anuncios', '2 skins', 'Exportar PDF/Excel', 'Reportes completos'],
  negocio: ['Productos ilimitados', 'Todo de Emprendedor', 'Usuarios adicionales', 'Dominio propio', 'Respaldos'],
  vip_plus: ['Todo ilimitado', 'Pago único $1,599', '1,000 ventas/mes incluidas', 'Solo $0.50 por venta extra (con Mercado Pago)'],
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const currentPlan = profile.plan as Plan
  const limits = PLAN_LIMITS[currentPlan]
  const mpConfigured = isMercadoPagoConfigured()
  const usage = await getMeteredUsage()
  const usagePct = Math.min(100, (usage.salesThisMonth / usage.included) * 100)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suscripción</h1>
        <p className="text-gray-500 text-sm mt-1">Plan actual y opciones de mejora</p>
      </div>

      {/* Mensaje de estado de pago */}
      {searchParams.status === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">¡Pago recibido!</p>
            <p className="text-sm text-green-600">Tu plan se activará en unos momentos.</p>
          </div>
        </div>
      )}
      {searchParams.status === 'failure' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">El pago no se completó. Intenta de nuevo.</p>
        </div>
      )}
      {searchParams.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">Tu pago está pendiente de confirmación.</p>
        </div>
      )}

      {/* Plan actual */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Plan actual</p>
              <h2 className="text-3xl font-bold mt-1">{limits.label}</h2>
              <p className="text-blue-200 mt-1">{limits.price_label}</p>
              {profile.plan_expires_at && (
                <p className="text-blue-300 text-xs mt-2">
                  Renueva: {new Date(profile.plan_expires_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
            <CreditCard size={48} className="text-blue-300" />
          </div>
        </CardContent>
      </Card>

      {/* Contador de ventas medidas (VIP Plus) */}
      {currentPlan === 'vip_plus' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap size={16} className="text-amber-500" /> Ventas de este mes
              </p>
              <span className="text-sm text-gray-500">
                {usage.salesThisMonth.toLocaleString()} / {usage.included.toLocaleString()} incluidas
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usage.extraSales > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {usage.extraSales > 0 ? (
              <div className="mt-3 flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                <span className="text-sm text-amber-700">
                  {usage.extraSales.toLocaleString()} ventas extra × {formatCurrency(usage.feePerSale)}
                </span>
                <span className="font-bold text-amber-700">{formatCurrency(usage.amountDue)}</span>
              </div>
            ) : (
              <p className="text-xs text-green-600 mt-2">
                ✓ Dentro de tus 1,000 ventas incluidas. Sin cargos extra este mes.
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-2">
              El cargo de {formatCurrency(usage.feePerSale)} por venta adicional solo aplica a ventas
              cobradas con Mercado Pago directo desde la app.
            </p>
          </CardContent>
        </Card>
      )}

      {!mpConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          ⚠️ Los pagos en línea están en configuración. Para cambiar de plan,
          contáctanos por WhatsApp.
        </div>
      )}

      {/* Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(PLAN_LIMITS) as Plan[]).map(planId => {
          const plan = PLAN_LIMITS[planId]
          const isCurrent = planId === currentPlan
          return (
            <Card key={planId} className={`border-0 shadow-sm ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.label}</CardTitle>
                  {isCurrent && <Badge className="bg-blue-100 text-blue-700">Actual</Badge>}
                </div>
                <p className="text-2xl font-bold text-gray-900">{plan.price_label}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {PLAN_FEATURES[planId].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    {feature}
                  </div>
                ))}

                {!isCurrent && planId !== 'free' && mpConfigured && (
                  <div className="pt-4">
                    <UpgradeButton plan={planId} label={`Cambiar a ${plan.label}`} />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
