'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Package, Palette, ShoppingBag, Inbox, ChevronLeft, ChevronRight, X, Rocket } from 'lucide-react'

// Se muestra AUTOMÁTICAMENTE solo la PRIMERA vez que el dueño entra al panel
// (bandera en localStorage). Se re-abre a voluntad desde Configuración
// ("Ver tutorial" → SHOW_KEY) o con ?tutorial=1.
const SEEN_KEY = 'mb_tutorial_v1_seen'
const SHOW_KEY = 'mb_tutorial_show'

// Textos en español → los traduce el sistema de idioma de la app (widget del
// header), igual que el resto de la interfaz.
const STEPS = [
  { icon: Sparkles, title: '¡Bienvenido a Mercanta Business!', text: 'Te mostramos lo básico en 1 minuto para que empieces a vender hoy mismo.', href: null as string | null, cta: null as string | null, accent: 'from-indigo-500 via-violet-600 to-purple-600' },
  { icon: Package, title: 'Agrega tus productos', text: 'Ve a Inventario → Nuevo producto. Sube fotos, pon precio y stock. También puedes crear variantes (tallas, colores).', href: '/inventory/new', cta: 'Ir a agregar productos', accent: 'from-blue-500 via-cyan-500 to-sky-600' },
  { icon: Palette, title: 'Pon tus colores y logo', text: 'En Configuración → Diseño y Colores elige tu paleta; en Información sube tu logo y banner. Tu tienda se verá única.', href: '/settings', cta: 'Ir a personalizar', accent: 'from-amber-500 via-orange-500 to-rose-500' },
  { icon: ShoppingBag, title: 'Activa Vender Online', text: 'En Configuración → Vender Online actívalo para recibir pedidos con pago en línea directo en tu catálogo (planes de pago).', href: '/settings', cta: 'Ir a Vender Online', accent: 'from-emerald-500 via-green-500 to-teal-600' },
  { icon: Inbox, title: 'Revisa tus pedidos', text: 'Tus ventas en línea llegan a Ventas Online, con seguimiento, guía de envío y aviso automático al cliente.', href: '/orders', cta: 'Ver Ventas Online', accent: 'from-fuchsia-500 via-pink-500 to-rose-600' },
]

export default function OnboardingTutorial() {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    try {
      const forced = new URLSearchParams(window.location.search).get('tutorial') === '1' || localStorage.getItem(SHOW_KEY) === '1'
      const seen = localStorage.getItem(SEEN_KEY) === '1'
      if (forced || !seen) { setI(0); setOpen(true) }
    } catch { /* sin localStorage: no mostrar */ }
  }, [])

  // Cierra y marca como visto → NO se vuelve a mostrar automáticamente.
  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, '1'); localStorage.removeItem(SHOW_KEY) } catch { /* ignore */ }
    try {
      const u = new URL(window.location.href)
      if (u.searchParams.has('tutorial')) { u.searchParams.delete('tutorial'); window.history.replaceState({}, '', u.pathname + (u.search || '')) }
    } catch { /* ignore */ }
    setOpen(false)
  }

  if (!open) return null
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const Icon = step.icon
  const pct = Math.round(((i + 1) / STEPS.length) * 100)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={dismiss} />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Barra de progreso superior animada */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/10 z-20">
          <div className="h-full bg-white/90 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>

        {/* Saltar tutorial — visible en todo momento */}
        <button type="button" onClick={dismiss}
          className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 text-xs font-semibold text-white/90 bg-white/15 hover:bg-white/30 backdrop-blur px-3 py-1.5 rounded-full transition-colors">
          Saltar tutorial <X size={13} />
        </button>

        {/* Encabezado con degradado + icono animado (re-anima por paso con key) */}
        <div className={`bg-gradient-to-br ${step.accent} px-6 pt-12 pb-8 text-center transition-colors duration-500`}>
          <div key={`ic-${i}`} className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-3 shadow-inner ring-1 ring-white/30 animate-in zoom-in-50 spin-in-6 duration-500">
            <Icon size={30} className="text-white" />
          </div>
          <div key={`ti-${i}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-xl font-bold text-white leading-tight drop-shadow-sm">{step.title}</h2>
            <p className="text-white/75 text-xs mt-1 font-medium">Paso {i + 1} de {STEPS.length}</p>
          </div>
        </div>

        <div className="p-6">
          <div key={`bd-${i}`} className="animate-in fade-in slide-in-from-right-3 duration-300">
            <p className="text-gray-600 text-sm leading-relaxed text-center">{step.text}</p>
            {step.href && (
              <Link href={step.href} onClick={dismiss}
                className="mt-4 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all">
                {step.cta} <ChevronRight size={16} />
              </Link>
            )}
          </div>

          {/* Puntos de progreso (clicables) */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {STEPS.map((_, idx) => (
              <button key={idx} type="button" onClick={() => setI(idx)} aria-label={`Paso ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-7 bg-slate-900' : 'w-2 bg-gray-200 hover:bg-gray-300'}`} />
            ))}
          </div>

          {/* Navegación */}
          <div className="flex items-center justify-between mt-5 gap-2">
            <button type="button" onClick={() => setI(v => Math.max(0, v - 1))} disabled={i === 0}
              className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 disabled:opacity-30 hover:text-gray-800 transition-colors">
              <ChevronLeft size={16} /> Anterior
            </button>
            {last ? (
              <button type="button" onClick={dismiss}
                className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold hover:brightness-110 hover:scale-[1.03] active:scale-95 transition-all shadow-lg shadow-emerald-500/25">
                ¡Empezar! <Rocket size={16} />
              </button>
            ) : (
              <button type="button" onClick={() => setI(v => Math.min(STEPS.length - 1, v + 1))}
                className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 hover:scale-[1.03] active:scale-95 transition-all">
                Siguiente <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* No volver a mostrar — claro y explícito */}
          <button type="button" onClick={dismiss}
            className="mt-4 w-full text-center text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
            No volver a mostrar
          </button>
        </div>
      </div>
    </div>
  )
}
