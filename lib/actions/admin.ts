'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

/**
 * Consola de Admin de la PLATAFORMA (/admin) — solo para el dueño de Mercanta.
 * Todas las lecturas/escrituras usan service-role, así que CADA acción vuelve a
 * comprobar que quien llama es súper-admin.
 *
 * Un usuario es súper-admin si:
 *   1. profiles.is_platform_admin = true  (migración 059), o
 *   2. su correo coincide con PLATFORM_ADMIN_EMAIL del entorno (arranque rápido,
 *      sirve para entrar la primera vez sin tocar SQL).
 */

const PLANS = ['free', 'emprendedor', 'negocio', 'vip_plus'] as const
export type AdminPlan = typeof PLANS[number]

async function adminGuard(): Promise<{ ok: boolean; userId?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false }

    const envEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
    if (envEmail && user.email?.toLowerCase() === envEmail) return { ok: true, userId: user.id }

    const admin = createAdminClient()
    const { data, error } = await admin.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
    if (error) { console.error('[admin] no se pudo leer is_platform_admin (¿migración 059?):', error.message); return { ok: false } }
    return { ok: data?.is_platform_admin === true, userId: user.id }
  } catch (e) {
    console.error('[admin] guard:', e instanceof Error ? e.message : e)
    return { ok: false }
  }
}

/** ¿El usuario actual es súper-admin de la plataforma? (lo usa el layout) */
export async function isPlatformAdminAction(): Promise<boolean> {
  return (await adminGuard()).ok
}

// ─── Resumen ────────────────────────────────────────────────────────────────
export interface AdminOverview {
  stores: number
  users: number
  plans: Record<AdminPlan, number>
  trials: number
  cardSalesMonth: number
  estimatedCommission: number
}

export async function getAdminOverviewAction(): Promise<AdminOverview | null> {
  if (!(await adminGuard()).ok) return null
  try {
    const admin = createAdminClient()
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [{ count: stores }, profs, storesRows, sales] = await Promise.all([
      admin.from('stores').select('*', { count: 'exact', head: true }),
      admin.from('profiles').select('id, plan, plan_status, plan_expires_at, role'),
      admin.from('stores').select('id, owner_id'),
      admin.from('sales').select('store_id, total, payment_method')
        .eq('status', 'completed').gte('created_at', monthStart),
    ])

    const rows = (profs.data ?? []) as { id: string; plan: string; plan_status: string | null; plan_expires_at: string | null; role: string | null }[]
    const owners = rows.filter(r => r.role !== 'employee' && r.role !== 'supervisor')
    const plans: Record<AdminPlan, number> = { free: 0, emprendedor: 0, negocio: 0, vip_plus: 0 }
    let trials = 0
    for (const r of owners) {
      const p = (PLANS as readonly string[]).includes(r.plan) ? (r.plan as AdminPlan) : 'free'
      plans[p]++
      if (r.plan_status === 'trial' && r.plan_expires_at && new Date(r.plan_expires_at) > new Date()) trials++
    }

    // Comisión estimada del mes: ventas con tarjeta × tasa del plan del dueño
    // (Gratis 2.5% · Emprendedor/Negocio 0% · VIP 2.5% tras 1,000 ventas).
    const planByOwner = new Map(rows.map(r => [r.id, r.plan]))
    const ownerByStore = new Map(((storesRows.data ?? []) as { id: string; owner_id: string }[]).map(s => [s.id, s.owner_id]))
    let cardSalesMonth = 0
    let estimatedCommission = 0
    for (const s of (sales.data ?? []) as { store_id: string; total: number; payment_method: string }[]) {
      if (s.payment_method !== 'card') continue
      const total = Number(s.total) || 0
      cardSalesMonth += total
      const plan = planByOwner.get(ownerByStore.get(s.store_id) ?? '') ?? 'free'
      const rate = plan === 'emprendedor' || plan === 'negocio' || plan === 'lifetime' ? 0 : 0.025
      estimatedCommission += total * rate
    }

    return {
      stores: stores ?? 0,
      users: rows.length,
      plans,
      trials,
      cardSalesMonth,
      estimatedCommission,
    }
  } catch (e) {
    console.error('[admin] overview:', e instanceof Error ? e.message : e)
    return null
  }
}

// ─── Negocios ───────────────────────────────────────────────────────────────
export interface AdminStore {
  id: string
  name: string
  slug: string | null
  createdAt: string
  ownerId: string
  ownerName: string | null
  ownerEmail: string | null
  plan: string
  planStatus: string | null
  planExpiresAt: string | null
  trialDaysLeft: number | null
  isActive: boolean
}

/** Correos de auth.users (id → email). */
async function emailMap(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) if (u.email) map.set(u.id, u.email)
  } catch (e) { console.error('[admin] listUsers:', e instanceof Error ? e.message : e) }
  return map
}

export async function listStoresAdminAction(search = ''): Promise<AdminStore[]> {
  if (!(await adminGuard()).ok) return []
  try {
    const admin = createAdminClient()
    const { data: stores, error } = await admin.from('stores').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) { console.error('[admin] stores:', error.message); return [] }
    const ownerIds = Array.from(new Set((stores ?? []).map(s => s.owner_id as string)))
    const { data: profs } = await admin.from('profiles').select('id, full_name, plan, plan_status, plan_expires_at').in('id', ownerIds)
    const profMap = new Map((profs ?? []).map(p => [p.id as string, p]))
    const emails = await emailMap(admin)

    const q = search.trim().toLowerCase()
    return (stores ?? []).map(s => {
      const p = profMap.get(s.owner_id as string)
      const exp = (p?.plan_expires_at as string | null) ?? null
      const days = exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000) : null
      return {
        id: s.id as string,
        name: (s.name as string) ?? 'Sin nombre',
        slug: (s.slug as string) ?? null,
        createdAt: s.created_at as string,
        ownerId: s.owner_id as string,
        ownerName: (p?.full_name as string) ?? null,
        ownerEmail: emails.get(s.owner_id as string) ?? null,
        plan: (p?.plan as string) ?? 'free',
        planStatus: (p?.plan_status as string) ?? null,
        planExpiresAt: exp,
        trialDaysLeft: p?.plan_status === 'trial' && days !== null ? Math.max(0, days) : null,
        isActive: (s as { is_active?: boolean }).is_active !== false,
      }
    }).filter(s => !q || s.name.toLowerCase().includes(q) || (s.ownerEmail ?? '').toLowerCase().includes(q))
  } catch (e) {
    console.error('[admin] listStores:', e instanceof Error ? e.message : e)
    return []
  }
}

// ─── Usuarios ───────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string
  name: string | null
  email: string | null
  role: string
  plan: string
  planStatus: string | null
  createdAt: string | null
}

export async function listUsersAdminAction(search = ''): Promise<AdminUser[]> {
  if (!(await adminGuard()).ok) return []
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('profiles')
      .select('id, full_name, role, plan, plan_status, created_at')
      .order('created_at', { ascending: false }).limit(500)
    if (error) { console.error('[admin] users:', error.message); return [] }
    const emails = await emailMap(admin)
    const q = search.trim().toLowerCase()
    return (data ?? []).map(u => ({
      id: u.id as string,
      name: (u.full_name as string) ?? null,
      email: emails.get(u.id as string) ?? null,
      role: (u.role as string) ?? 'owner',
      plan: (u.plan as string) ?? 'free',
      planStatus: (u.plan_status as string) ?? null,
      createdAt: (u.created_at as string) ?? null,
    })).filter(u => !q || (u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
  } catch (e) {
    console.error('[admin] listUsers:', e instanceof Error ? e.message : e)
    return []
  }
}

// ─── Gestión de planes ──────────────────────────────────────────────────────
/** Asigna un plan manualmente. `days` = duración; sin días, no vence. */
export async function setUserPlanAdminAction(userId: string, plan: AdminPlan, days?: number): Promise<ActionResult> {
  if (!(await adminGuard()).ok) return { success: false, error: 'No autorizado' }
  if (!(PLANS as readonly string[]).includes(plan)) return { success: false, error: 'Plan inválido' }
  try {
    const admin = createAdminClient()
    const expires = days && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    const { error } = await admin.from('profiles').update({
      plan,
      plan_status: 'active',
      plan_expires_at: plan === 'free' ? null : expires,
    }).eq('id', userId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Da o extiende la prueba (Emprendedor en modo trial) por N días. */
export async function setTrialAdminAction(userId: string, days: number): Promise<ActionResult> {
  if (!(await adminGuard()).ok) return { success: false, error: 'No autorizado' }
  try {
    const admin = createAdminClient()
    const expires = new Date(Date.now() + Math.max(1, days) * 86400000).toISOString()
    const { error } = await admin.from('profiles').update({
      plan: 'emprendedor', plan_status: 'trial', plan_expires_at: expires,
    }).eq('id', userId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Termina la prueba: pasa a Gratis. */
export async function endTrialAdminAction(userId: string): Promise<ActionResult> {
  if (!(await adminGuard()).ok) return { success: false, error: 'No autorizado' }
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({
      plan: 'free', plan_status: 'expired', plan_expires_at: null,
    }).eq('id', userId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Suspende o reactiva una tienda (oculta su catálogo público). */
export async function setStoreActiveAdminAction(storeId: string, active: boolean): Promise<ActionResult> {
  if (!(await adminGuard()).ok) return { success: false, error: 'No autorizado' }
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('stores').update({ is_active: active }).eq('id', storeId)
    if (error) {
      if (/column|does not exist|schema cache/i.test(error.message)) {
        return { success: false, error: 'La tabla stores no tiene la columna is_active en esta base.' }
      }
      return { success: false, error: error.message }
    }
    revalidatePath('/admin')
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
