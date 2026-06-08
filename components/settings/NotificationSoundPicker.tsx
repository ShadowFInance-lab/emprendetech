'use client'

import { useState, useEffect } from 'react'
import { Volume2, Check } from 'lucide-react'
import {
  NOTIF_SOUNDS, NOTIF_SOUND_KEY, NOTIF_VOLUME_KEY, playNotificationSound, getSavedVolume,
} from '@/lib/utils/notificationSounds'

export default function NotificationSoundPicker() {
  const [selected, setSelected] = useState('campana')
  const [volume, setVolume] = useState(0.8)

  useEffect(() => {
    setSelected(localStorage.getItem(NOTIF_SOUND_KEY) || 'campana')
    setVolume(getSavedVolume())
  }, [])

  function choose(id: string) {
    setSelected(id)
    localStorage.setItem(NOTIF_SOUND_KEY, id)
    playNotificationSound(id, volume) // vista previa
  }

  function changeVolume(v: number) {
    setVolume(v)
    localStorage.setItem(NOTIF_VOLUME_KEY, String(v))
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

      {/* Control de volumen */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="notif-vol" className="text-xs font-medium text-gray-600">Volumen</label>
          <span className="text-xs text-gray-400">{Math.round(volume * 100)}%</span>
        </div>
        <input
          id="notif-vol"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => changeVolume(Number(e.target.value) / 100)}
          onMouseUp={() => playNotificationSound(selected, volume)}
          onTouchEnd={() => playNotificationSound(selected, volume)}
          className="w-full accent-blue-600"
        />
      </div>

      <p className="text-[11px] text-gray-400 mt-2">Se guarda en este dispositivo.</p>
    </div>
  )
}
