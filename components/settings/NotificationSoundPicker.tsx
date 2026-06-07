'use client'

import { useState, useEffect } from 'react'
import { Volume2, Check } from 'lucide-react'
import { NOTIF_SOUNDS, NOTIF_SOUND_KEY, playNotificationSound } from '@/lib/utils/notificationSounds'

export default function NotificationSoundPicker() {
  const [selected, setSelected] = useState('campana')

  useEffect(() => {
    setSelected(localStorage.getItem(NOTIF_SOUND_KEY) || 'campana')
  }, [])

  function choose(id: string) {
    setSelected(id)
    localStorage.setItem(NOTIF_SOUND_KEY, id)
    playNotificationSound(id) // vista previa al elegir
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-[15px] mb-1 flex items-center gap-2">
        <Volume2 size={17} className="text-blue-600" /> Sonido de notificación
      </h3>
      <p className="text-xs text-gray-400 mb-3">Elige el sonido de la campana de recordatorios. Toca uno para escucharlo.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {NOTIF_SOUNDS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => choose(s.id)}
            className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-sm transition-all ${
              selected === s.id
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                : 'border-gray-200 text-gray-600 hover:border-blue-200'
            }`}
          >
            {s.label}
            {selected === s.id && <Check size={14} className="text-blue-600" />}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Se guarda en este dispositivo.</p>
    </div>
  )
}
