export interface NotifSound { id: string; label: string }

export const NOTIF_SOUNDS: NotifSound[] = [
  { id: 'campana', label: '🔔 Campanita' },
  { id: 'ding', label: '🛎️ Ding' },
  { id: 'doble', label: '🎵 Doble' },
  { id: 'suave', label: '☁️ Suave' },
  { id: 'alerta', label: '⚠️ Alerta' },
]

export const NOTIF_SOUND_KEY = 'et_notif_sound'

/** Reproduce uno de los 5 sonidos de notificación con Web Audio (sin archivos). */
export function playNotificationSound(id = 'campana') {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq: number, start: number, dur: number, vol = 0.18, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = type
      o.frequency.value = freq
      const t0 = ctx.currentTime + start
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      o.start(t0); o.stop(t0 + dur + 0.02)
    }
    switch (id) {
      case 'ding': beep(1318, 0, 0.5); break
      case 'doble': beep(660, 0, 0.25); beep(880, 0.18, 0.32); break
      case 'suave': beep(523, 0, 0.7, 0.12); break
      case 'alerta': beep(988, 0, 0.2, 0.2, 'triangle'); beep(740, 0.18, 0.38, 0.2, 'triangle'); break
      case 'campana':
      default: beep(880, 0, 0.45); break
    }
    setTimeout(() => { try { ctx.close() } catch { /* noop */ } }, 1600)
  } catch { /* el navegador puede bloquear audio sin interacción del usuario */ }
}

export function getSavedNotifSound(): string {
  if (typeof window === 'undefined') return 'campana'
  return localStorage.getItem(NOTIF_SOUND_KEY) || 'campana'
}
