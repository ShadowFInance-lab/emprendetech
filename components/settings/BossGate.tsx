'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Lock, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { verifyBossPasswordAction } from '@/lib/actions/employees'

const KEY = 'mb_boss_unlocked'
export function isBossUnlocked() { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
function setUnlocked() { try { sessionStorage.setItem(KEY, '1') } catch { /* noop */ } }

function BossUnlockModal({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const [pwd, setPwd] = useState('')
  const [isPending, startTransition] = useTransition()
  function check() {
    if (!pwd) return
    startTransition(async () => {
      const r = await verifyBossPasswordAction(pwd)
      if (r.success) { setUnlocked(); toast.success('Acción desbloqueada'); onUnlocked() }
      else toast.error(r.error ?? 'Contraseña incorrecta')
    })
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-700 to-slate-900">
          <div className="flex items-center gap-2"><Lock size={17} className="text-white" /><p className="text-sm font-bold text-white">Acción protegida</p></div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">Escribe tu contraseña de jefe para continuar.</p>
          <Input type="password" value={pwd} autoFocus onChange={e => setPwd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check() }} placeholder="Contraseña" className="h-10 text-sm" />
          <button onClick={check} disabled={isPending} className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={15} /> Desbloquear</>}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Solo se pide una vez por sesión.</p>
        </div>
      </div>
    </div>
  )
}

/** Hook: requireUnlock(fn) ejecuta fn si ya está desbloqueado, o pide contraseña. */
export function useBossGate(): { requireUnlock: (fn: () => void) => void; gate: ReactNode } {
  const [pending, setPending] = useState<(() => void) | null>(null)
  const requireUnlock = (fn: () => void) => { if (isBossUnlocked()) fn(); else setPending(() => fn) }
  const gate = pending
    ? <BossUnlockModal onClose={() => setPending(null)} onUnlocked={() => { const f = pending; setPending(null); f?.() }} />
    : null
  return { requireUnlock, gate }
}
