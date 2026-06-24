'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'

/** Paleta de colores con nombre (se muestra al elegir). */
export const NAMED_COLORS: { name: string; hex: string }[] = [
  { name: 'Negro', hex: '#111827' }, { name: 'Gris carbón', hex: '#1F2937' }, { name: 'Pizarra', hex: '#334155' },
  { name: 'Gris', hex: '#6B7280' }, { name: 'Plata', hex: '#9CA3AF' }, { name: 'Blanco hueso', hex: '#F9FAFB' },
  { name: 'Rojo', hex: '#EF4444' }, { name: 'Carmesí', hex: '#DC2626' }, { name: 'Rubí', hex: '#BE123C' },
  { name: 'Vino', hex: '#7F1D1D' }, { name: 'Coral', hex: '#FB7185' }, { name: 'Rosa', hex: '#EC4899' },
  { name: 'Fucsia', hex: '#D946EF' }, { name: 'Naranja', hex: '#F97316' }, { name: 'Ámbar', hex: '#F59E0B' },
  { name: 'Dorado', hex: '#EAB308' }, { name: 'Amarillo', hex: '#FACC15' }, { name: 'Lima', hex: '#84CC16' },
  { name: 'Verde', hex: '#22C55E' }, { name: 'Esmeralda', hex: '#059669' }, { name: 'Bosque', hex: '#15803D' },
  { name: 'Turquesa', hex: '#14B8A6' }, { name: 'Verde azulado', hex: '#0D9488' }, { name: 'Cian', hex: '#06B6D4' },
  { name: 'Celeste', hex: '#38BDF8' }, { name: 'Azul', hex: '#3B82F6' }, { name: 'Azul rey', hex: '#2563EB' },
  { name: 'Marino', hex: '#1E40AF' }, { name: 'Índigo', hex: '#4F46E5' }, { name: 'Violeta', hex: '#7C3AED' },
  { name: 'Morado', hex: '#9333EA' }, { name: 'Púrpura', hex: '#6D28D9' }, { name: 'Lavanda', hex: '#A78BFA' },
  { name: 'Café', hex: '#92400E' }, { name: 'Chocolate', hex: '#7C2D12' }, { name: 'Arena', hex: '#D6B98C' },
]

export function colorName(hex: string): string {
  const h = (hex || '').toUpperCase()
  return NAMED_COLORS.find(c => c.hex.toUpperCase() === h)?.name ?? 'Personalizado'
}

/** Campo de color: muestra nombre + HEX; al hacer clic abre un grid grande de colores con nombre. */
export default function ColorPickerField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setOpen(true)} className="w-14 h-14 rounded-2xl border-2 border-gray-200 shadow-inner shrink-0" style={{ background: value }} aria-label={`Elegir ${label}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-gray-500 hover:text-gray-900 text-left truncate w-full">
          <span className="font-medium text-gray-700">{colorName(value)}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">Elegir color · {label}</p>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-4 max-h-[55vh] overflow-y-auto">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {NAMED_COLORS.map(c => {
                  const active = c.hex.toUpperCase() === (value || '').toUpperCase()
                  return (
                    <button key={c.hex} type="button" onClick={() => { onChange(c.hex); setOpen(false) }} className="flex flex-col items-center gap-1 group">
                      <span className={`w-12 h-12 rounded-xl ring-2 flex items-center justify-center transition-all ${active ? 'ring-gray-900 scale-105' : 'ring-black/5 group-hover:ring-gray-400'}`} style={{ background: c.hex }}>
                        {active && <Check size={16} className="text-white drop-shadow" />}
                      </span>
                      <span className="text-[10px] text-gray-600 text-center leading-tight">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="border-t border-gray-100 p-4 flex items-center gap-3">
              <label className="relative w-10 h-10 rounded-lg ring-1 ring-black/10 cursor-pointer shrink-0" style={{ background: value }}>
                <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <span className="flex-1 text-sm text-gray-500">Color personalizado · toca el cuadro</span>
              <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
