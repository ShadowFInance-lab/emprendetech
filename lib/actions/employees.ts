'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createPublicClient } from '@/lib/supabase/server'
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
  try {
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
  } catch {
    return { role: 'owner', plan: 'free', bossId: null }
  }
}

/**
 * Crea un empleado SIN requerir service-role key:
 * 1) signUp con cliente anónimo (no toca la sesión del dueño)
 * 2) RPC assign_employee (SECURITY DEFINER): marca role='employee'+boss_id y
 *    confirma el correo del empleado.
 */
export async function createEmployeeAction(input: { name: string; email: string; password: string }): Promise<ActionResult> {
  try {
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

    // 1) Crear el usuario con cliente anónimo (sin persistir sesión → no afecta al dueño)
    const anon = createPublicClient()
    const { data: signUpData, error: signErr } = await anon.auth.signUp({
      email,
      password: input.password,
      options: { data: { full_name: input.name?.trim() || email } },
    })
    if (signErr || !signUpData?.user) {
      const already = /registered|already|exists/i.test(signErr?.message ?? '')
      console.error('[EMPLEADO DEBUG] signUp error:', signErr?.message)
      return { success: false, error: already ? 'Ese correo ya tiene una cuenta.' : `No se pudo crear el empleado: ${signErr?.message ?? 'error'}` }
    }

    // 2) Asignar rol de empleado + confirmar correo (RPC SECURITY DEFINER)
    const { error: rpcErr } = await supabase.rpc('assign_employee', { emp_id: signUpData.user.id })
    if (rpcErr) {
      console.error('[EMPLEADO DEBUG] assign_employee error:', rpcErr.message)
      if (/plan_required/.test(rpcErr.message)) return { success: false, error: 'Tu plan no permite empleados.' }
      return { success: false, error: 'Falta aplicar la migración 021_employee_rpcs.sql en Supabase.' }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('[EMPLEADO DEBUG] createEmployeeAction throw:', err)
    return { success: false, error: 'No se pudo crear el empleado. Aplica la migración 021 en Supabase.' }
  }
}

export async function listEmployeesAction(): Promise<Employee[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.rpc('list_my_employees')
    if (error || !data) return []
    return (data as { id: string; full_name: string | null; email: string | null; created_at: string }[])
      .map(e => ({ id: e.id, name: e.full_name, email: e.email, created_at: e.created_at }))
  } catch {
    return []
  }
}

export async function deleteEmployeeAction(employeeId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.rpc('remove_employee', { emp_id: employeeId })
    if (error) return { success: false, error: 'No se pudo quitar el acceso' }
    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo quitar el acceso' }
  }
}

export async function notifyEmployeeAction(employeeId: string, message: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!message.trim()) return { success: false, error: 'Escribe un mensaje' }
    const { error } = await supabase.from('employee_notifications')
      .insert({ employee_id: employeeId, sender_id: user.id, message: message.trim() })
    if (error) return { success: false, error: 'No se pudo enviar (¿migración 018 aplicada?)' }
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo enviar la notificación' }
  }
}

export interface EmployeeNotice { id: string; message: string; created_at: string }

export async function getEmployeeNotificationsAction(): Promise<EmployeeNotice[]> {
  try {
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
  } catch {
    return []
  }
}

export async function markEmployeeNotificationRead(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('employee_notifications').update({ read: true }).eq('id', id)
    return { success: !error }
  } catch {
    return { success: false }
  }
}
