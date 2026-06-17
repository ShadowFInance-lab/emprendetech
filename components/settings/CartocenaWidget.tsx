'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { PiggyBank, X, Plus, Trash2, Loader2, Target } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  getTeamFundAction, saveTeamFundGoalAction, addFundContributionAction, deleteFundContributionAction,
  type TeamFund, type FundContribution, type PayrollPeriod,
} from '@/lib/actions/payroll'
import { formatCurrency } from '@/lib/utils/format'

const FUND_PERIODS: { id: PayrollPeriod; label: string }[] = [
  { id: 'week', label: 'Semanal' }, { id: 'biweekly', label: 'Catorcenal' },
  { id: 'fortnight', label: 'Quincenal' }, { id: 'month', label: 'Mensual' },
]

/**
 * Cartocena: fondo del equipo (semanal). Tarjeta resumen + modal para fijar la
 * meta y registrar aportes por empleado. El acumulado/aportantes se derivan.
 */
export default function CartocenaWidget({ names, totalCount }: { names: string[]; totalCount: number }) {
  const [fund, setFund] = useState<TeamFund>({ goal: 0, accumulated: 0, contributors: 0 })
  const [items, setItems] = useState<FundContribution[]>([])
  const [period, setPeriod] = useState<PayrollPeriod>('week')
  const [open, setOpen] = useState(false)
  const [goalDraft, setGoalDraft] = useState('0')
  const [who, setWho] = useState('')
  const [amount, setAmount] = useState('')
  const [isPending, startTransition] = useTransition()
  const periodLabel = FUND_PERIODS.find(p => p.id === period)?.label.toLowerCase() ?? 'semana'

  const load = useCallback(async () => {
    const f = await getTeamFundAction(period)
    setFund({ goal: f.goal, accumulated: f.accumulated, contributors: f.contributors })
    setItems(f.items); setGoalDraft(String(f.goal))
  }, [period])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!who && names[0]) setWho(names[0]) }, [names, who])

  const pct = fund.goal > 0 ? Math.min(100, Math.round((fund.accumulated / fund.goal) * 100)) : 0

  function saveGoal() {
    startTransition(async () => {
      const r = await saveTeamFundGoalAction(parseFloat(goalDraft) || 0)
      if (r.success) { toast.success('Meta guardada'); load() } else toast.error(r.error ?? 'Error')
    })
  }
  function addAporte() {
    const amt = parseFloat(amount) || 0
    if (!who) { toast.error('Elige quién aporta'); return }
    if (!(amt > 0)) { toast.error('Monto inválido'); return }
    startTransition(async () => {
      const r = await addFundContributionAction(who, amt)
      if (r.success) { setAmount(''); toast.success('Aporte registrado'); load() } else toast.error(r.error ?? 'Error')
    })
  }
  function removeAporte(id: string) {
    startTransition(async () => {
      const r = await deleteFundContributionAction(id)
      if (r.success) { toast.success('Aporte eliminado'); load() } else toast.error(r.error ?? 'Error')
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Gestionar cartocena (fondo del equipo)"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors">
        <PiggyBank size={15} /> Periodo de Pago
        <span className="text-[10px] font-normal text-amber-600/70">· {periodLabel} · {formatCurrency(fund.accumulated)}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-400 to-orange-500">
              <div className="flex items-center gap-2"><PiggyBank size={18} className="text-white" /><p className="text-sm font-bold text-white">Periodo de Pago · Cartocena</p></div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Periodo */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {FUND_PERIODS.map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p.id ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>{p.label}</button>
                ))}
              </div>
              {/* Resumen */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-amber-700">{formatCurrency(fund.accumulated)}</span>
                  <span className="text-xs text-amber-700/70">de {formatCurrency(fund.goal)} · {pct}%</span>
                </div>
                <div className="h-2 bg-amber-100 rounded-full overflow-hidden mt-2"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                <p className="text-[11px] text-amber-700/70 mt-1.5">{fund.contributors}/{totalCount} empleados han aportado · {periodLabel}</p>
              </div>

              {/* Meta semanal */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 flex items-center gap-1 mb-1"><Target size={12} /> Meta semanal</label>
                <div className="flex gap-2">
                  <Input type="number" min="0" value={goalDraft} onChange={e => setGoalDraft(e.target.value)} className="h-9 text-sm" placeholder="1200" />
                  <button onClick={saveGoal} disabled={isPending} className="px-3 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">Guardar</button>
                </div>
              </div>

              {/* Registrar aporte */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 flex items-center gap-1 mb-1"><Plus size={12} /> Registrar aporte</label>
                <div className="flex gap-2">
                  <select value={who} onChange={e => setWho(e.target.value)} className="flex-1 h-9 text-sm border border-gray-200 rounded-lg px-2 bg-white">
                    {names.length === 0 ? <option value="">Sin empleados</option> : names.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-sm w-24" placeholder="Monto" onKeyDown={e => { if (e.key === 'Enter') addAporte() }} />
                  <button onClick={addAporte} disabled={isPending} className="px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                    {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </div>
              </div>

              {/* Lista de aportes */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Aportes de esta semana</p>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">Sin aportes todavía.</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map(it => (
                      <div key={it.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="text-sm text-gray-700 flex-1 truncate">{it.contributor}</span>
                        <span className="text-sm font-semibold text-amber-700">{formatCurrency(it.amount)}</span>
                        <button onClick={() => removeAporte(it.id)} disabled={isPending} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
