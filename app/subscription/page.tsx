import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Zap, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAN_LIMITS } from '@/lib/constants/plans'
import { confirmCheckoutReturn, activateFreeModeAction, ensurePlanCurrentAction } from '@/lib/actions/subscriptions'
import UpgradeButton from '@/components/subscription/UpgradeButton'
import type { Plan } from '@/lib/types'

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: ['100 productos', 'Catálogo público', 'POS básico', 'Con anuncios ligeros', '3% comisión por venta'],
  emprendedor: ['5,000 productos', 'Sin anuncios', 'Personaliza 3 tonos', 'Exportar PDF/Excel', 'Reportes completos', '0% comisión por venta'],
  negocio: ['Productos ilimitados', 'Todo de Emprendedor', 'Usuarios adicionales', 'Dominio propio', 'Respaldos', '0% comisión por venta'],
  vip_plus: ['Todo ilimitado', 'Pago único — sin mensualidades', 'Ventas ilimitadas sin cargos extra', '2% comisión por venta (con Stripe)'],
}

const PLAN_STYLE: Record<Plan, { bar: string; icon: string }> = {
  free:        { bar: 'from-teal-500 via-cyan-600 to-sky-700',         icon: '🆓' },
  emprendedor: { bar: 'from-blue-500 via-blue-600 to-cyan-700',        icon: '🚀' },
  negocio:     { bar: 'from-fuchsia-500 via-purple-600 to-pink-700',   icon: '🏢' },
  vip_plus:    { bar: 'from-amber-400 via-orange-500 to-rose-600',     icon: '👑' },
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: { status?: string; payment_id?: string; collection_id?: string; collection_status?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Baja a Gratis los planes vencidos (fin de la prueba de 5 días o mes no renovado).
  await ensurePlanCurrentAction()

  // Verificación legada al volver de un checkout antiguo (los params payment_id/
  // collection_id solo los manda el proveedor anterior). Los planes nuevos se pagan
  // con Stripe y los activa el webhook. Idempotente; solo activa el plan propio.
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

  // Tras ensurePlanCurrent: perfil ya puede tener el trial de 5 días activado.
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const currentPlan = profile.plan as Plan
  const limits = PLAN_LIMITS[currentPlan]
  // Los planes se pagan con Stripe (checkout de la plataforma).
  const paymentsConfigured = !!process.env.STRIPE_SECRET_KEY

  const trialDaysLeft = profile.plan_expires_at
    ? Math.max(0, Math.ceil((new Date(profile.plan_expires_at).getTime() - Date.now()) / 86400000))
    : 0
  // Prueba gratis activa: Emprendedor con vencimiento ≤5 días o status trial.
  const statusIsTrial = (['trial', 'trialing'] as string[]).includes(String(profile.plan_status))
  const looksLikeTrialFallback =
    currentPlan === 'emprendedor' &&
    !!profile.plan_expires_at &&
    trialDaysLeft <= 5
  const showTrialCountdown =
    currentPlan === 'emprendedor' &&
    !!profile.plan_expires_at &&
    (statusIsTrial || looksLikeTrialFallback)
  const trialLabel =
    trialDaysLeft <= 0
      ? 'Prueba gratis — termina hoy'
      : trialDaysLeft === 1
        ? 'Prueba gratis — termina en 1 día'
        : `Prueba gratis — termina en ${trialDaysLeft} días`

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suscripción</h1>
        <p className="text-gray-500 text-sm mt-1">Plan actual y opciones de mejora</p>
      </div>

      {/* Banner grande de Prueba gratis */}
      {showTrialCountdown && (
        <div
          className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-4 sm:p-5 shadow-sm"
          data-testid="trial-banner"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-700">
                Prueba gratis
              </p>
              <p className="text-lg sm:text-xl font-black text-amber-900 mt-0.5">
                {trialLabel}
              </p>
              <p className="text-sm text-amber-800/80 mt-1">
                Estás en plan Emprendedor sin costo. Al terminar pasas a Gratis automáticamente.
              </p>
            </div>
            <span className="inline-flex items-center justify-center self-start sm:self-center rounded-full bg-amber-500 text-white text-sm font-bold px-4 py-2 shadow">
              {trialDaysLeft <= 0 ? 'Último día' : `${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>
      )}

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
              {showTrialCountdown && (
                <p
                  className="text-amber-100 text-sm font-bold mt-3 bg-amber-500/25 border border-amber-300/40 inline-block px-3.5 py-1.5 rounded-full shadow-sm"
                  data-testid="trial-countdown"
                >
                  🎁 {trialLabel}
                </p>
              )}
              {!showTrialCountdown && profile.plan_expires_at && (
                <p className="text-blue-300 text-xs mt-2">
                  Renueva: {new Date(profile.plan_expires_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
            <CreditCard size={48} className="text-blue-300" />
          </div>
        </CardContent>
      </Card>

      {/* Opción simple para Modo Gratis (solo para VIP Plus) */}
      {currentPlan === 'vip_plus' && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Eres VIP Plus. Puedes cambiar a <strong>Modo Gratis completo</strong> (plan free con acceso total).
          </p>
          <form action={activateFreeModeAction} className="inline">
            <button
              type="submit"
              className="text-sm px-4 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 font-medium"
            >
              Cambiar a Modo Gratis (free)
            </button>
          </form>
        </div>
      )}

      {!paymentsConfigured && (
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
            <><strong>Pago único de $1,599 MXN</strong> — de por vida, sin mensualidades.</>,
            <>Ventas <strong>ilimitadas</strong>: sin contadores ni cargos por venta extra.</>,
            <>Única comisión: <strong>2% por venta con tarjeta</strong> (la procesa Stripe). Ventas en efectivo o transferencia: <strong>0%</strong>.</>,
            <>Comparativa: plan Gratis paga <strong>3%</strong> por venta · Emprendedor y Negocio <strong>0%</strong> (con mensualidad).</>,
          ].map((txt, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span>{txt}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Planes — tarjetas premium (solo planes pagos; Gratis normal sin tarjeta extra) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {(['emprendedor', 'negocio', 'vip_plus'] as Plan[]).map(planId => {
          const plan = PLAN_LIMITS[planId]
          const isCurrent = planId === currentPlan
          const style = PLAN_STYLE[planId]
          const isPopular = planId === 'vip_plus'

          return (
            <div
              key={planId}
              className={`group relative rounded-3xl overflow-hidden text-white transition-all duration-300 hover:-translate-y-2 hover:brightness-110 bg-gradient-to-br ${style.bar} ${
                isPopular
                  ? `shadow-2xl shadow-orange-500/40 ${isCurrent ? 'ring-4 ring-white/70' : 'ring-2 ring-white/50'} sm:scale-[1.05] hover:shadow-orange-500/50`
                  : `shadow-xl ${isCurrent ? 'ring-4 ring-white/70' : 'ring-1 ring-white/15'} hover:shadow-2xl`
              }`}
            >
              <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/15 blur-3xl" />
              {isPopular && <div className="pointer-events-none absolute -bottom-24 -left-16 w-52 h-52 rounded-full bg-white/15 blur-3xl" />}
              <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-[300%] transition-transform duration-700 ease-out" />

              {isPopular && (
                <div className="w-full bg-white text-orange-600 text-center py-2 text-xs font-extrabold tracking-[0.2em] shadow-md">
                  ⭐ MÁS POPULAR
                </div>
              )}
              {isCurrent && (
                <span className="absolute top-3 right-3 z-10 text-[10px] font-extrabold px-3 py-1 rounded-full shadow bg-white text-gray-900">
                  TU PLAN
                </span>
              )}

              <div className="relative p-6 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-white/20 backdrop-blur-sm shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  {style.icon}
                </div>

                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">{plan.label}</p>
                <p className="text-4xl font-black mt-1.5 tracking-tight leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]">{plan.price_label}</p>
                <p className="text-xs font-medium mt-2 text-white/80">
                  {planId === 'vip_plus' ? 'Pago único · de por vida'
                    : 'Facturación mensual'}
                </p>

                <div className="mt-5 pt-5 space-y-3 border-t border-white/25">
                  {PLAN_FEATURES[planId].map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px]">
                      <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-white/25">
                        <Check size={12} strokeWidth={3} className="text-white" />
                      </span>
                      <span className="text-white/95">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 mt-auto">
                  {isCurrent ? (
                    <div className="text-center text-sm font-semibold py-3 rounded-xl bg-white/20 text-white">✓ Tu plan actual</div>
                  ) : (
                    <UpgradeButton plan={planId} label={`Elegir ${plan.label}`} accent="bg-white !text-gray-900 hover:bg-white/90 font-bold shadow-lg" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Términos de cobros y pagos */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-600">Términos de cobros y pagos</p>
        <p>
          Mercanta Business solo cobra la comisión por venta indicada en cada plan
          (Gratis 3% · Emprendedor y Negocio 0% · VIP Plus 2%). Sin cargos ocultos.
        </p>
        <p>
          Los pagos con tarjeta los procesa <strong>Stripe</strong>, un proveedor externo e
          independiente. Mercanta no almacena datos de tarjetas ni es responsable del
          procesamiento de pagos, contracargos o disputas, que se rigen por los términos de Stripe.
        </p>
      </div>
    </div>
  )
}
