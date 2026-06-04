import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { PLAN_LIMITS } from '@/lib/constants/plans'
import type { Plan } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Planes y Precios',
  description: 'Planes flexibles para tu negocio. Comienza gratis y crece a tu ritmo.',
}

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    '100 productos',
    'Catálogo público',
    '1 skin (Moderna)',
    'Punto de venta básico',
    'Dashboard de ventas',
    'Botón WhatsApp',
  ],
  emprendedor: [
    '5,000 productos',
    'Sin anuncios',
    '2 skins (Moderna y Minimalista)',
    'Exportar PDF y Excel',
    'Reportes completos',
    'Soporte prioritario',
  ],
  negocio: [
    'Productos ilimitados',
    'Todo lo de Emprendedor',
    'Usuarios adicionales',
    'Dominio personalizado',
    'Respaldos automáticos',
    'Soporte por chat',
  ],
  vip_plus: [
    'Todo ilimitado, pago único',
    '1,000 ventas/mes incluidas',
    'Solo $0.50 por venta extra',
    '(con Mercado Pago directo)',
    'Cobro automático en la app',
  ],
}

export default function PricingPage() {
  const plans: Plan[] = ['free', 'emprendedor', 'negocio', 'vip_plus']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">EmprendeTech</span>
          </Link>
          <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Crear cuenta gratis
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900">Planes para cada negocio</h1>
          <p className="text-gray-500 text-lg mt-4 max-w-xl mx-auto">
            Comienza gratis. Mejora cuando lo necesites. Sin comisión por venta.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(planId => {
            const plan = PLAN_LIMITS[planId]
            const isPopular = planId === 'emprendedor'
            const isVip = planId === 'vip_plus'
            return (
              <div
                key={planId}
                className={`rounded-2xl p-6 flex flex-col relative ${
                  isVip ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-2xl ring-2 ring-amber-300'
                    : isPopular ? 'bg-white ring-2 ring-blue-500 shadow-xl'
                    : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Más popular
                  </span>
                )}
                {isVip && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-amber-600 text-xs font-bold px-3 py-1 rounded-full shadow">
                    👑 Premium
                  </span>
                )}
                <h3 className={`font-bold text-lg ${isVip ? 'text-white' : 'text-gray-900'}`}>{plan.label}</h3>
                <div className="mt-2 mb-1">
                  <span className={`text-3xl font-extrabold ${isVip ? 'text-white' : 'text-gray-900'}`}>{plan.price_label}</span>
                </div>
                <ul className="space-y-3 mt-6 mb-8 flex-1">
                  {PLAN_FEATURES[planId].map((feature, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${isVip ? 'text-white/95' : 'text-gray-600'}`}>
                      <CheckCircle2 size={16} className={`flex-shrink-0 mt-0.5 ${isVip ? 'text-white' : 'text-green-500'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`text-center py-3 rounded-xl font-medium transition-colors ${
                    isVip
                      ? 'bg-white text-amber-600 hover:bg-amber-50'
                      : isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {planId === 'free' ? 'Comenzar gratis' : isVip ? 'Obtener VIP Plus' : 'Elegir plan'}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Back */}
        <div className="text-center mt-12">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm">
            <ArrowLeft size={16} /> Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  )
}
