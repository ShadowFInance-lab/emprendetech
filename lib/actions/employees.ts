'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export interface Employee {
  id: string
  name: string | null
  email: string | null
  created_at: string
}

const PAID_PLANS = ['emprendedor', 'negocio', 'vip_plus']

/** Rol + plan del usuario actual. Tolerante si la migración 018 no se aplicó. */
export async function getMyRole(): Promise<{ role: 'owner' | 'employee'; plan: string; bossId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { role: 'owner', plan: 'free', bossId: null }
  const { data, error } = await supabase
    .from('profiles').select('role, plan, boss_id').eq('id', user.id).maybeSingle()
  if (error || !data) {
    const { data: p } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
    return { role: 'owner', plan: p?.plan ?? 'free', bossId: null }
  }
  return { role: (data.role as 'owner' | 'employee') ?? 'owner', plan: data.plan ?? 'free', bossId: data.boss_id ?? null }
}

export async function createEmployeeAction(input: { name: string; email: string; password: string }): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: me } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle()
  if (me?.role === 'employee') return { success: false, error: 'Solo el dueño puede crear empleados' }
  if (!me || !PAID_PLANS.includes(me.plan)) {
    return { success: false, error: 'Las cuentas de empleado están disponibles en planes de pago.' }
  }

  const email = input.email?.trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { success: false, error: 'Correo inválido' }
  if (!input.password || input.password.length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }

  const admin = createAdminClient()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.name?.trim() || email },
  })
  if (createErr || !created.user) {
    const already = /already|registered|exists/i.test(createErr?.message ?? '')
    return { success: false, error: already ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear el empleado' }
  }

  const { error: upErr } = await admin.from('profiles').upsert({
    id: created.user.id,
    full_name: input.name?.trim() || email,
    role: 'employee',
    boss_id: user.id,
    onboarding_done: true,
  })
  if (upErr) {
    await admin.auth.admin.deleteUser(created.user.id) // evitar usuario huérfano
    return { success: false, error: 'Falta aplicar la migración 018_roles_employees.sql en Supabase.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function listEmployeesAction(): Promise<Employee[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const admin = createAdminClient()
  const { data: profs, error } = await admin
    .from('profiles').select('id, full_name, created_at').eq('boss_id', user.id)
  if (error || !profs || profs.length === 0) return []

  const emails: Record<string, string> = {}
  try {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of list?.users ?? []) emails[u.id] = u.email ?? ''
  } catch { /* opcional */ }

  return profs.map(p => ({ id: p.id, name: p.full_name, email: emails[p.id] ?? null, created_at: p.created_at }))
}

export async function deleteEmployeeAction(employeeId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const admin = createAdminClient()
  const { data: emp } = await admin.from('profiles').select('boss_id').eq('id', employeeId).maybeSingle()
  if (!emp || emp.boss_id !== user.id) return { success: false, error: 'No autorizado' }
  const { error } = await admin.auth.admin.deleteUser(employeeId)
  if (error) return { success: false, error: 'No se pudo eliminar' }
  revalidatePath('/settings')
  return { success: true }
}

export async function notifyEmployeeAction(employeeId: string, message: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!message.trim()) return { success: false, error: 'Escribe un mensaje' }
  const admin = createAdminClient()
  const { data: emp } = await admin.from('profiles').select('boss_id').eq('id', employeeId).maybeSingle()
  if (!emp || emp.boss_id !== user.id) return { success: false, error: 'No autorizado' }
  const { error } = await admin.from('employee_notifications')
    .insert({ employee_id: employeeId, sender_id: user.id, message: message.trim() })
  if (error) return { success: false, error: 'No se pudo enviar (¿migración 018 aplicada?)' }
  return { success: true }
}

export interface EmployeeNotice { id: string; message: string; created_at: string }

export async function getEmployeeNotificationsAction(): Promise<EmployeeNotice[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('employee_notifications')
    .select('id, message, created_at')
    .eq('employee_id', user.id).eq('read', false)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as EmployeeNotice[]
}

export async function markEmployeeNotificationRead(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('employee_notifications').update({ read: true }).eq('id', id)
  return { success: !error }
}
