import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAN_LIMITS } from '@/lib/constants/plans'
import { isMercadoPagoConfigured } from '@/lib/mercadopago/client'
import { getMeteredUsage, confirmCheckoutReturn } from '@/lib/actions/subscriptions'
import { formatCurrency } from '@/lib/utils/format'
import UpgradeButton from '@/components/subscription/UpgradeButton'
import type { Plan } from '@/lib/types'

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: ['100 productos', 'Catálogo público', '5 paletas básicas', 'POS básico', 'Con anuncios ligeros'],
  emprendedor: ['5,000 productos', 'Sin anuncios', 'Personaliza 3 tonos', 'Exportar PDF/Excel', 'Reportes completos'],
  negocio: ['Productos ilimitados', 'Todo de Emprendedor', 'Usuarios adicionales', 'Dominio propio', 'Respaldos'],
  vip_plus: ['Todo ilimitado', 'Pago único $1,599', '1,000 ventas/mes incluidas', 'Solo $0.50 por venta extra (con Mercado Pago)'],
}

const PLAN_STYLE: Record<Plan, { bar: string; icon: string }> = {
  free:        { bar: 'from-slate-500 to-slate-700',    icon: '🆓' },
  emprendedor: { bar: 'from-blue-500 to-indigo-600',    icon: '🚀' },
  negocio:     { bar: 'from-purple-500 to-fuchsia-600', icon: '🏢' },
  vip_plus:    { bar: 'from-amber-500 to-orange-600',   icon: '👑' },
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: { status?: string; payment_id?: string; collection_id?: string; collection_status?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Al volver del checkout, verificar el pago con Mercado Pago y activar el
  // plan inmediatamente (no dependemos solo del webhook, que puede fallar por
  // configuración). Es idempotente y solo activa el plan del propio usuario.
  let justActivated: Plan | null = null
  if (searchParams.payment_id || searchParams.collection_id || searchParams.status === 'success' || searchParams.collection_status === 'approved') {
    const res = await confirmCheckoutReturn({
      payment_id: searchParams.payment_id,
      collection_id: searchParams.collection_id,
      status: searchParams.status,
      collection_status: searchParams.collection_status,
    })
    if (res.activated && res.plan) justActivated = res.plan
  }

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
      {(searchParams.status === 'success' || justActivated) && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">{justActivated ? '¡Plan activado!' : '¡Pago recibido!'}</p>
            <p className="text-sm text-green-600">
              {justActivated
                ? `Tu plan ${PLAN_LIMITS[justActivated].label} ya está activo. ¡Gracias!`
                : 'Estamos confirmando tu pago. Si no se activa en un minuto, recarga la página.'}
            </p>
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

      {/* Explicador claro de VIP Plus (cómo funciona el cobro) */}
      <Card className="border-0 shadow-sm ring-1 ring-amber-200 bg-gradient-to-br from-amber-50/70 to-yellow-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap size={17} className="text-amber-500" /> ¿Cómo funciona el cobro de VIP Plus?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm text-gray-700">
          {[
            <><strong>Pago único de $1,599 MXN</strong> (no es mensual).</>,
            <>Incluye las <strong>primeras 1,000 ventas por mes gratis</strong>.</>,
            <>Si superas las 1,000 ventas en un mes, cada venta adicional cuesta solo <strong>$0.50 MXN</strong> (solo si usas Mercado Pago directo desde la app).</>,
            <>El contador <strong>se reinicia cada mes</strong>.</>,
            <>Solo aplica al plan <strong>VIP Plus</strong>.</>,
          ].map((txt, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span>{txt}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Planes — tarjetas premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {(Object.keys(PLAN_LIMITS) as Plan[]).map(planId => {
          const plan = PLAN_LIMITS[planId]
          const isCurrent = planId === currentPlan
          const style = PLAN_STYLE[planId]
          const isPopular = planId === 'vip_plus'

          return (
            <div
              key={planId}
              className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                isPopular
                  ? `bg-gradient-to-br ${style.bar} text-white shadow-2xl ${isCurrent ? 'ring-4 ring-white/60' : 'ring-2 ring-amber-300'} sm:scale-[1.03]`
                  : isCurrent
                    ? 'bg-white ring-2 ring-blue-500 shadow-lg'
                    : 'bg-white border border-gray-100 shadow-sm hover:shadow-xl'
              }`}
            >
              {/* Cinta diagonal "MEJOR VALOR" */}
              {isPopular && !isCurrent && (
                <div className="absolute -right-12 top-6 rotate-45 bg-white text-amber-600 text-[11px] font-extrabold px-12 py-1 shadow-md tracking-wide">
                  MEJOR VALOR
                </div>
              )}
              {isCurrent && (
                <span className={`absolute top-4 right-4 text-[10px] font-extrabold px-3 py-1 rounded-full shadow ${isPopular ? 'bg-white text-amber-600' : 'bg-blue-600 text-white'}`}>
                  TU PLAN
                </span>
              )}

              <div className="p-6">
                {/* Icono */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-lg ${
                  isPopular ? 'bg-white/20 backdrop-blur-sm shadow-inner' : `bg-gradient-to-br ${style.bar}`
                }`}>
                  {style.icon}
                </div>

                {/* Nombre + precio */}
                <p className={`text-sm font-bold uppercase tracking-widest ${isPopular ? 'text-white/90' : 'text-gray-400'}`}>
                  {plan.label}
                </p>
                <p className={`text-5xl font-black mt-1 tracking-tight leading-none ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price_label}
                </p>
                <p className={`text-xs font-medium mt-2 ${isPopular ? 'text-white/80' : 'text-gray-400'}`}>
                  {planId === 'vip_plus' ? 'Pago único · acceso para siempre'
                    : planId === 'free' ? 'Gratis para empezar'
                    : 'Facturación mensual'}
                </p>

                {/* Features */}
                <div className={`mt-5 pt-5 space-y-3 border-t ${isPopular ? 'border-white/25' : 'border-gray-100'}`}>
                  {PLAN_FEATURES[planId].map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 size={17} className={`flex-shrink-0 mt-0.5 ${isPopular ? 'text-white' : 'text-green-500'}`} />
                      <span className={isPopular ? 'text-white/95' : 'text-gray-600'}>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="pt-6">
                  {isCurrent ? (
                    <div className={`text-center text-sm font-semibold py-2.5 rounded-xl ${isPopular ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-700'}`}>
                      ✓ Estás en este plan
                    </div>
                  ) : planId === 'free' ? (
                    <p className="text-center text-xs text-gray-400 py-2.5">Tu punto de partida</p>
                  ) : isPopular ? (
                    <UpgradeButton plan={planId} label={`Obtener ${plan.label}`} accent="bg-white !text-amber-600 hover:bg-white/90 font-bold shadow-lg" />
                  ) : (
                    <UpgradeButton plan={planId} label={`Elegir ${plan.label}`} accent={`bg-gradient-to-r ${style.bar} shadow-md`} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
