'use client'

import { useEffect } from 'react'
import { trackVisitAction } from '@/lib/actions/tracking'

const KEY = 'mb_sid'

/** id aleatorio del navegador (no identifica a la persona). */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)) as string
      localStorage.setItem(KEY, id)
    }
    return id
  } catch { return '' }
}

/**
 * Marca una visita de alguien NO logueado a la landing o al registro.
 * No renderiza nada y nunca bloquea la página.
 */
export default function VisitTracker({ page }: { page: 'landing' | 'register' }) {
  useEffect(() => {
    const sid = getSessionId()
    if (!sid) return
    trackVisitAction(page, sid, navigator.userAgent).catch(() => {})
  }, [page])
  return null
}
