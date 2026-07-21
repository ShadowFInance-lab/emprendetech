'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Package, Palette, ShoppingBag, Inbox, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'

// Se muestra la PRIMERA vez que el dueño entra al panel (bandera en localStorage)
// o cuando se pide de nuevo desde Configuración (SHOW_KEY / ?tutorial=1).
const SEEN_KEY = 'mb_tutorial_v1_seen'
const SHOW_KEY = 'mb_tutorial_show'

// Textos en español: se traducen con el sistema de idioma de la app (widget de
// Google Translate del header) igual que el resto de la interfaz.
const STEPS = [
  { icon: Sparkles, title: '¡Bienvenido a Mercanta Business!', text: 'Te mostramos lo básico en 1 minuto para que empieces a vender hoy mismo.', href: null as string | null, cta: null as string | null, accent: 'from-indigo-500 to-violet-600' },
  { icon: Package, title: 'Agrega tus productos', text: 'Ve a Inventario → Nuevo producto. Sube fotos, pon precio y stock. También puedes crear variantes (tallas, colores).', href: '/inventory/new', cta: 'Ir a agregar productos', accent: 'from-blue-500 to-cyan-600' },
  { icon: Palette, title: 'Pon tus colores y logo', text: 'En Configuración → Diseño y Colores elige tu paleta; en Información sube tu logo y banner. Tu tienda se verá única.', href: '/settings', cta: 'Ir a personalizar', accent: 'from-amber-500 to-orange-600' },
  { icon: ShoppingBag, title: 'Activa Vender Online', text: 'En Configuración → Vender Online actívalo para recibir pedidos con pago en línea directo en tu catálogo (planes de pago).', href: '/settings', cta: 'Ir a Vender Online', accent: 'from-emerald-500 to-green-600' },
  { icon: Inbox, title: 'Revisa tus pedidos', text: 'Tus ventas en línea llegan a Ventas Online, con seguimiento, guía de envío y aviso automático al cliente.', href: '/orders', cta: 'Ver Ventas Online', accent: 'from-fuchsia-500 to-pink-600' },
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

  function close() {
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Saltar tutorial — visible en todo momento */}
        <button type="button" onClick={close}
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 text-xs font-semibold text-white/90 bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-1.5 rounded-full">
          <X size={13} /> Saltar tutorial
        </button>

        {/* Encabezado con degradado por paso */}
        <div className={`bg-gradient-to-br ${step.accent} px-6 pt-11 pb-8 text-center`}>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-3 shadow-inner">
            <Icon size={30} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">{step.title}</h2>
          <p className="text-white/70 text-xs mt-1">Paso {i + 1} de {STEPS.length}</p>
        </div>

        <div className="p-6">
          <p className="text-gray-600 text-sm leading-relaxed text-center">{step.text}</p>

          {step.href && (
            <Link href={step.href} onClick={close}
              className="mt-4 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors">
              {step.cta} <ChevronRight size={16} />
            </Link>
          )}

          {/* Progreso */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {STEPS.map((_, idx) => (
              <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-slate-900' : 'w-1.5 bg-gray-200'}`} />
            ))}
          </div>

          {/* Navegación */}
          <div className="flex items-center justify-between mt-5 gap-2">
            <button type="button" onClick={() => setI(v => Math.max(0, v - 1))} disabled={i === 0}
              className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 disabled:opacity-30 hover:text-gray-800">
              <ChevronLeft size={16} /> Anterior
            </button>
            {last ? (
              <button type="button" onClick={close}
                className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                <Check size={16} /> ¡Empezar!
              </button>
            ) : (
              <button type="button" onClick={() => setI(v => Math.min(STEPS.length - 1, v + 1))}
                className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">
                Siguiente <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
