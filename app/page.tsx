import Link from 'next/link'
import { ShoppingBag, BarChart3, MessageCircle, Globe, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: Globe, title: 'Catálogo web profesional', desc: 'Tu tienda online lista en minutos. 2 skins profesionales.' },
  { icon: ShoppingBag, title: 'Punto de venta (POS)', desc: 'Registra ventas, descuenta stock automáticamente.' },
  { icon: BarChart3, title: 'Dashboard con KPIs', desc: 'Ventas del día, semana y mes. Stock bajo y alertas.' },
  { icon: MessageCircle, title: 'WhatsApp integrado', desc: 'Tus clientes piden directo por WhatsApp desde tu catálogo.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">EmprendeTech</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          ✅ Sin comisión por venta · 100% en línea
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight">
          Tu negocio en línea{' '}
          <span className="text-blue-600">en minutos</span>
        </h1>
        <p className="text-gray-500 text-lg sm:text-xl mt-6 max-w-2xl mx-auto">
          Crea tu catálogo web, administra tu inventario, registra ventas
          y conecta con tus clientes por WhatsApp. Todo desde un navegador.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            href="/register"
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            Comenzar gratis <ArrowRight size={20} />
          </Link>
          <Link
            href="/pricing"
            className="text-gray-600 hover:text-gray-900 font-medium text-sm"
          >
            Ver planes y precios →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-gray-50 rounded-2xl p-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <f.icon size={20} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="bg-blue-600 py-16 text-center px-4">
        <h2 className="text-3xl font-bold text-white mb-4">
          ¿Listo para crecer?
        </h2>
        <p className="text-blue-200 mb-8 max-w-md mx-auto">
          Crea tu cuenta gratis y ten tu catálogo online en menos de 5 minutos.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-colors"
        >
          Crear cuenta gratis <ArrowRight size={20} />
        </Link>
      </section>
    </div>
  )
}
