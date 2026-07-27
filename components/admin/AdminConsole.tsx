'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Store as StoreIcon, Users, Gift, CreditCard, Search, RefreshCw, Ban, CheckCircle2, Loader2, LayoutDashboard, Eye, X, Package, ShoppingBag, Inbox } from 'lucide-react'
import {
  listStoresAdminAction, listUsersAdminAction, setUserPlanAdminAction, setTrialAdminAction,
  endTrialAdminAction, setStoreActiveAdminAction, getStoreDetailAction,
  type AdminOverview, type AdminStore, type AdminUser, type AdminPlan, type AdminStoreDetail,
} from '@/lib/actions/admin'
import { formatCurrency } from '@/lib/utils/format'

const PLAN_LABEL: Record<string, string> = {
  free: 'Gratis', emprendedor: 'Emprendedor', negocio: 'Negocio', vip_plus: 'VIP Plus', lifetime: 'Vitalicio',
}
const PLAN_STYLE: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-200',
  emprendedor: 'bg-blue-50 text-blue-700 border-blue-200',
  negocio: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  vip_plus: 'bg-amber-50 text-amber-700 border-amber-200',
}
const PLANS: AdminPlan[] = ['free', 'emprendedor', 'negocio', 'vip_plus']
const TABS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'negocios', label: 'Negocios', icon: StoreIcon },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
] as const
type TabId = typeof TABS[number]['id']

const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function AdminConsole({ overview, initialStores, initialUsers }: {
  overview: AdminOverview | null
  initialStores: AdminStore[]
  initialUsers: AdminUser[]
}) {
  const [tab, setTab] = useState<TabId>('resumen')
  const [stores, setStores] = useState(initialStores)
  const [users, setUsers] = useState(initialUsers)
  const [qStore, setQStore] = useState('')
  const [fPlan, setFPlan] = useState<'todos' | AdminPlan>('todos')
  const [fEstado, setFEstado] = useState<'todos' | 'activo' | 'suspendido' | 'prueba'>('todos')
  const [detailStore, setDetailStore] = useState<AdminStore | null>(null)
  const [detail, setDetail] = useState<AdminStoreDetail | null>(null)
  const [qUser, setQUser] = useState('')
  const [pending, start] = useTransition()

  function reloadStores() { start(async () => setStores(await listStoresAdminAction(qStore))) }
  function reloadUsers() { start(async () => setUsers(await listUsersAdminAction(qUser))) }

  function changePlan(userId: string, plan: AdminPlan) {
    start(async () => {
      const r = await setUserPlanAdminAction(userId, plan)
      if (r.success) { toast.success(`Plan cambiado a ${PLAN_LABEL[plan]}`); reloadStores(); reloadUsers() }
      else toast.error(r.error ?? 'Error')
    })
  }
  function giveTrial(userId: string, days: number) {
    start(async () => {
      const r = await setTrialAdminAction(userId, days)
      if (r.success) { toast.success(`Prueba de ${days} días activada`); reloadStores(); reloadUsers() }
      else toast.error(r.error ?? 'Error')
    })
  }
  function endTrial(userId: string) {
    start(async () => {
      const r = await endTrialAdminAction(userId)
      if (r.success) { toast.success('Prueba terminada · plan Gratis'); reloadStores(); reloadUsers() }
      else toast.error(r.error ?? 'Error')
    })
  }
  function openDetail(s: AdminStore) {
    setDetailStore(s); setDetail(null)
    start(async () => setDetail(await getStoreDetailAction(s.id, s.ownerId)))
  }
  function toggleStore(storeId: string, active: boolean) {
    if (!active && !confirm('¿Suspender esta tienda? Su catálogo dejará de verse.')) return
    start(async () => {
      const r = await setStoreActiveAdminAction(storeId, active)
      if (r.success) { toast.success(active ? 'Tienda activada' : 'Tienda suspendida'); reloadStores() }
      else toast.error(r.error ?? 'Error')
    })
  }

  // Filtros en cliente sobre la lista ya cargada (la busqueda tambien va al servidor).
  const shownStores = stores.filter(s => {
    if (fPlan !== 'todos' && s.plan !== fPlan) return false
    if (fEstado === 'activo' && !s.isActive) return false
    if (fEstado === 'suspendido' && s.isActive) return false
    if (fEstado === 'prueba' && s.trialDaysLeft === null) return false
    return true
  })

  const cards = overview ? [
    { label: 'Negocios', value: String(overview.stores), icon: StoreIcon, c: 'from-indigo-500 to-violet-600' },
    { label: 'Usuarios', value: String(overview.users), icon: Users, c: 'from-cyan-500 to-sky-600' },
    { label: 'Pruebas activas', value: String(overview.trials), icon: Gift, c: 'from-emerald-500 to-green-600' },
    { label: 'Comisión estimada (mes)', value: formatCurrency(overview.estimatedCommission), icon: CreditCard, c: 'from-amber-500 to-orange-600' },
  ] : []

  return (
    <div className="space-y-5">
      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-colors ${tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
        {pending && <span className="inline-flex items-center text-xs text-gray-400 gap-1.5 ml-auto"><Loader2 size={13} className="animate-spin" /> Actualizando…</span>}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div className="space-y-5">
          {!overview ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No se pudo cargar el resumen. Revisa que la migración 059 esté aplicada y que exista SUPABASE_SERVICE_ROLE_KEY.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {cards.map(k => (
                  <div key={k.label} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                    <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.c} flex items-center justify-center mb-2`}><k.icon size={17} className="text-white" /></span>
                    <p className="text-[11px] text-gray-400 font-medium">{k.label}</p>
                    <p className="text-xl font-bold text-gray-900 leading-tight">{k.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                <p className="text-sm font-bold text-gray-800 mb-3">Suscripciones por plan</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PLANS.map(p => (
                    <div key={p} className={`rounded-xl border px-3 py-2.5 ${PLAN_STYLE[p]}`}>
                      <p className="text-[11px] font-semibold opacity-80">{PLAN_LABEL[p]}</p>
                      <p className="text-2xl font-black leading-tight">{overview.plans[p]}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  Ventas con tarjeta este mes: <strong className="text-gray-600">{formatCurrency(overview.cardSalesMonth)}</strong>.
                  La comisión es una estimación (Gratis y VIP 2.5% · Emprendedor y Negocio 0%); el cobro real lo liquida Stripe.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── NEGOCIOS ── */}
      {tab === 'negocios' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={qStore} onChange={e => setQStore(e.target.value)} onKeyDown={e => e.key === 'Enter' && reloadStores()}
                placeholder="Buscar por tienda o correo del dueño…"
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <button type="button" onClick={reloadStores} className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 inline-flex items-center gap-1.5">
              <RefreshCw size={14} /> Buscar
            </button>
            <select value={fPlan} onChange={e => setFPlan(e.target.value as typeof fPlan)}
              className="h-10 px-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-900">
              <option value="todos">Todos los planes</option>
              {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
            </select>
            <select value={fEstado} onChange={e => setFEstado(e.target.value as typeof fEstado)}
              className="h-10 px-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-900">
              <option value="todos">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="suspendido">Suspendidos</option>
              <option value="prueba">En prueba</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">{shownStores.length} de {stores.length} negocios</p>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 bg-gray-50/70">
                  <th className="px-4 py-2.5 font-semibold">Tienda</th>
                  <th className="px-4 py-2.5 font-semibold">Dueño</th>
                  <th className="px-4 py-2.5 font-semibold">Plan</th>
                  <th className="px-4 py-2.5 font-semibold">Prueba</th>
                  <th className="px-4 py-2.5 font-semibold">Stripe</th>
                  <th className="px-4 py-2.5 font-semibold">Última venta</th>
                  <th className="px-4 py-2.5 font-semibold">Alta</th>
                  <th className="px-4 py-2.5 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {shownStores.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Sin negocios</td></tr>
                ) : shownStores.map(s => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      <p className="text-[11px] text-gray-400">/{s.slug ?? '—'}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-gray-700">{s.ownerName ?? '—'}</p>
                      <p className="text-[11px] text-gray-400 break-all">{s.ownerEmail ?? '—'}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${PLAN_STYLE[s.plan] ?? PLAN_STYLE.free}`}>
                        {PLAN_LABEL[s.plan] ?? s.plan}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {s.trialDaysLeft !== null
                        ? <span className="text-emerald-700 font-semibold">{s.trialDaysLeft} día{s.trialDaysLeft === 1 ? '' : 's'}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${s.stripeConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {s.stripeConnected ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.lastSaleAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => openDetail(s)}
                          className="h-8 px-2.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 inline-flex items-center gap-1">
                          <Eye size={12} /> Ver
                        </button>
                        <select value={s.plan} disabled={pending}
                          onChange={e => changePlan(s.ownerId, e.target.value as AdminPlan)}
                          className="h-8 text-xs border border-gray-200 rounded-lg px-1.5 bg-white text-gray-900">
                          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                        </select>
                        <button type="button" disabled={pending} onClick={() => giveTrial(s.ownerId, 5)}
                          className="h-8 px-2.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50">+5 días</button>
                        <button type="button" disabled={pending} onClick={() => endTrial(s.ownerId)}
                          className="h-8 px-2.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">Terminar</button>
                        <button type="button" disabled={pending} onClick={() => toggleStore(s.id, !s.isActive)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${s.isActive ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                          {s.isActive ? <><Ban size={12} /> Suspender</> : <><CheckCircle2 size={12} /> Activar</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DETALLE DE NEGOCIO (panel lateral) ── */}
      {detailStore && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailStore(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {detailStore.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={detailStore.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover bg-white/10 shrink-0" />
                  : <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">{detailStore.name.charAt(0).toUpperCase()}</span>}
                <div className="min-w-0">
                  <p className="font-bold leading-tight truncate">{detailStore.name}</p>
                  <p className="text-[11px] text-white/60 truncate">/{detailStore.slug ?? '—'}</p>
                </div>
              </div>
              <button onClick={() => setDetailStore(null)} className="text-white/80 hover:text-white shrink-0" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Dueño</p>
                <p className="font-semibold text-gray-900">{detailStore.ownerName ?? '—'}</p>
                <p className="text-sm text-gray-500 break-all">{detailStore.ownerEmail ?? '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <p className="text-[11px] text-gray-400">Plan</p>
                  <p className="font-bold text-gray-900">{PLAN_LABEL[detailStore.plan] ?? detailStore.plan}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <p className="text-[11px] text-gray-400">Prueba</p>
                  <p className="font-bold text-gray-900">
                    {detailStore.trialDaysLeft !== null ? `${detailStore.trialDaysLeft} días` : 'Terminada / sin prueba'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <p className="text-[11px] text-gray-400">Registro</p>
                  <p className="font-bold text-gray-900">{fmtDate(detailStore.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <p className="text-[11px] text-gray-400">Stripe conectado</p>
                  <p className={`font-bold ${detailStore.stripeConnected ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {detailStore.stripeConnected ? 'Sí' : 'No'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Actividad</p>
                {!detail ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-3"><Loader2 size={15} className="animate-spin" /> Cargando…</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: 'Empleados', v: String(detail.employees), i: Users },
                      { l: 'Productos', v: String(detail.products), i: Package },
                      { l: 'Ventas del mes', v: `${detail.salesMonthCount} · ${formatCurrency(detail.salesMonthTotal)}`, i: ShoppingBag },
                      { l: 'Pedidos online (mes)', v: String(detail.ordersMonth), i: Inbox },
                    ].map(k => (
                      <div key={k.l} className="rounded-xl border border-gray-100 bg-white shadow-sm p-3">
                        <k.i size={15} className="text-gray-400 mb-1" />
                        <p className="text-[11px] text-gray-400">{k.l}</p>
                        <p className="font-bold text-gray-900 text-sm leading-tight">{k.v}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-2">Última venta registrada: {fmtDate(detailStore.lastSaleAt)}</p>
              </div>
            </div>

            {/* Mismas acciones que la lista */}
            <div className="border-t border-gray-100 p-4 shrink-0 space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block">Cambiar plan</label>
              <select value={detailStore.plan} disabled={pending}
                onChange={e => { changePlan(detailStore.ownerId, e.target.value as AdminPlan); setDetailStore({ ...detailStore, plan: e.target.value }) }}
                className="w-full h-10 text-sm border border-gray-200 rounded-lg px-2 bg-white text-gray-900">
                {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => giveTrial(detailStore.ownerId, 5)}
                  className="flex-1 h-9 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50">+5 días de prueba</button>
                <button type="button" disabled={pending} onClick={() => endTrial(detailStore.ownerId)}
                  className="flex-1 h-9 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50">Terminar prueba</button>
              </div>
              <button type="button" disabled={pending} onClick={() => { toggleStore(detailStore.id, !detailStore.isActive); setDetailStore({ ...detailStore, isActive: !detailStore.isActive }) }}
                className={`w-full h-9 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 ${detailStore.isActive ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                {detailStore.isActive ? <><Ban size={13} /> Suspender tienda</> : <><CheckCircle2 size={13} /> Activar tienda</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USUARIOS ── */}
      {tab === 'usuarios' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={qUser} onChange={e => setQUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && reloadUsers()}
                placeholder="Buscar por correo o nombre…"
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <button type="button" onClick={reloadUsers} className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 inline-flex items-center gap-1.5">
              <RefreshCw size={14} /> Buscar
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 bg-gray-50/70">
                  <th className="px-4 py-2.5 font-semibold">Usuario</th>
                  <th className="px-4 py-2.5 font-semibold">Correo</th>
                  <th className="px-4 py-2.5 font-semibold">Rol</th>
                  <th className="px-4 py-2.5 font-semibold">Plan</th>
                  <th className="px-4 py-2.5 font-semibold">Alta</th>
                  <th className="px-4 py-2.5 font-semibold">Cambiar plan</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin usuarios</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{u.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs break-all">{u.email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{u.role}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${PLAN_STYLE[u.plan] ?? PLAN_STYLE.free}`}>
                        {PLAN_LABEL[u.plan] ?? u.plan}
                      </span>
                      {u.planStatus === 'trial' && <span className="ml-1 text-[10px] text-emerald-600 font-semibold">prueba</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <select value={u.plan} disabled={pending || u.role === 'employee' || u.role === 'supervisor'}
                        onChange={e => changePlan(u.id, e.target.value as AdminPlan)}
                        className="h-8 text-xs border border-gray-200 rounded-lg px-1.5 bg-white text-gray-900 disabled:opacity-40">
                        {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
