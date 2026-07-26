import Link from 'next/link'
import { ShoppingBag, BarChart3, MessageCircle, Globe, ArrowRight, Sparkles } from 'lucide-react'

const FEATURES = [
  { icon: Globe, title: 'Catálogo web profesional', desc: 'Tu tienda online lista en minutos, con tu marca y colores.' },
  { icon: ShoppingBag, title: 'Punto de venta (POS)', desc: 'Registra ventas y descuenta stock automáticamente.' },
  { icon: BarChart3, title: 'Dashboard con KPIs', desc: 'Ventas del día, semana y mes. Stock bajo y alertas.' },
  { icon: MessageCircle, title: 'WhatsApp integrado', desc: 'Tus clientes piden directo por WhatsApp desde tu catálogo.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold">M</span>
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Mercanta Business</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2">Iniciar sesión</Link>
            <Link href="/register" className="text-sm bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors font-semibold shadow-sm">
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — colorido, con la promo de la prueba gratis al frente */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
        {/* Manchas de color para dar vida al fondo */}
        <div className="pointer-events-none absolute -top-28 -right-20 w-96 h-96 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-white/10 blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 py-24 text-center">
          {/* Badge Beta + promo */}
          <div className="inline-flex items-center gap-2 bg-white/20 ring-1 ring-white/30 text-white text-sm font-bold px-4 py-1.5 rounded-full mb-6 backdrop-blur">
            <Sparkles size={15} className="text-amber-300" /> Beta · 5 días de prueba gratis
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-[1.05] tracking-tight drop-shadow-sm">
            Prueba{' '}
            <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">5 días gratis</span>
            {' '}tu negocio en línea
          </h1>

          <p className="text-white/90 text-lg sm:text-xl mt-6 max-w-2xl mx-auto font-medium">
            Gestiona ventas, inventario, empleados y cobros con QR. Todo desde un navegador.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/register" className="flex items-center gap-2 bg-white text-indigo-700 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-amber-50 transition-all shadow-2xl shadow-black/20 hover:-translate-y-0.5">
              Comenzar prueba gratis <ArrowRight size={20} />
            </Link>
            <Link href="/pricing" className="text-white/85 hover:text-white font-semibold text-sm inline-flex items-center gap-1.5">
              <Sparkles size={15} /> Ver planes y precios →
            </Link>
          </div>

          <p className="text-white/75 text-xs mt-6">
            Sin tarjeta para empezar · Hecha para emprendedores en México · Versión Beta
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-4 shadow-sm">
                <f.icon size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 to-indigo-950 py-16 text-center px-4">
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">¿Listo para crecer?</h2>
          <p className="text-slate-300 mb-8 max-w-md mx-auto">Crea tu cuenta gratis y ten tu catálogo online en menos de 5 minutos.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 px-8 py-4 rounded-2xl font-bold hover:opacity-95 transition-all shadow-xl shadow-amber-500/20">
            Crear cuenta gratis <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer legal */}
      <footer className="bg-slate-950 border-t border-white/10 py-8 px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-400">
          <Link href="/terminos" className="hover:text-white transition-colors">Términos y Condiciones</Link>
          <Link href="/privacidad" className="hover:text-white transition-colors">Aviso de Privacidad</Link>
          <Link href="/rastreo" className="hover:text-white transition-colors">Rastrear pedido</Link>
          <Link href="/reportar" className="hover:text-white transition-colors">Reportar</Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">© {new Date().getFullYear()} Mercanta Business · Versión Beta · Plataforma tecnológica para negocios.</p>
      </footer>
    </div>
  )
}
