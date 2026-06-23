'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createPublicClient, createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export interface Employee {
  id: string
  name: string | null
  email: string | null
  created_at: string
  role?: 'owner' | 'employee' | 'supervisor'
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
 * Crea un empleado pidiendo SOLO nombre + contraseña (sin correo).
 * Generamos un "usuario" (correo interno) a partir del nombre. No requiere
 * service-role key: usa signUp anónimo + RPC assign_employee (SECURITY DEFINER).
 */
export async function createEmployeeAction(input: { name: string; password: string }): Promise<ActionResult & { loginEmail?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { data: me } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle()
    if (me?.role === 'employee') return { success: false, error: 'Solo el dueño puede crear empleados' }
    if (!me || !PAID_PLANS.includes(me.plan)) {
      return { success: false, error: 'Las cuentas de empleado están disponibles en planes de pago.' }
    }

    const name = (input.name || '').trim()
    if (!name) return { success: false, error: 'Escribe el nombre del empleado' }
    if (!input.password || input.password.length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }

    // "usuario" interno desde el nombre (NFD + quitar todo lo no alfanumérico quita acentos)
    const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 16) || 'empleado'
    const email = `${slug}@empleados.mercanta.app`

    // 1) Crear el usuario con cliente anónimo (no afecta la sesión del dueño)
    const anon = createPublicClient()
    const { data: signUpData, error: signErr } = await anon.auth.signUp({
      email,
      password: input.password,
      options: { data: { full_name: name } },
    })
    if (signErr || !signUpData?.user) {
      const already = /registered|already|exists/i.test(signErr?.message ?? '')
      console.error('[EMPLEADO DEBUG] signUp error:', signErr?.message)
      return { success: false, error: already ? `Ya existe un empleado llamado "${name}". Usa otro nombre.` : `No se pudo crear el empleado: ${signErr?.message ?? 'error'}` }
    }

    // 2) Asignar rol de empleado + confirmar correo (RPC SECURITY DEFINER)
    const { error: rpcErr } = await supabase.rpc('assign_employee', { emp_id: signUpData.user.id })
    if (rpcErr) {
      console.error('[EMPLEADO DEBUG] assign_employee error:', rpcErr.message)
      if (/plan_required/.test(rpcErr.message)) return { success: false, error: 'Tu plan no permite empleados.' }
      return { success: false, error: 'Falta aplicar la migración 021_employee_rpcs.sql en Supabase.' }
    }

    revalidatePath('/settings')
    return { success: true, loginEmail: email }
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
    const [{ data, error }, { data: roles }] = await Promise.all([
      supabase.rpc('list_my_employees'),
      supabase.rpc('my_employee_roles'),
    ])
    if (error || !data) return []
    const roleMap = new Map((roles ?? []).map((r: { id: string; role: string }) => [r.id, r.role]))
    return (data as { id: string; full_name: string | null; email: string | null; created_at: string }[])
      .map(e => ({ id: e.id, name: e.full_name, email: e.email, created_at: e.created_at, role: (roleMap.get(e.id) as 'employee' | 'supervisor') ?? 'employee' }))
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

/** Correo/usuario de acceso de un empleado del jefe actual. */
export async function getEmployeeLoginAction(employeeId: string): Promise<{ email: string | null }> {
  try {
    const emps = await listEmployeesAction()
    return { email: emps.find(e => e.id === employeeId)?.email ?? null }
  } catch { return { email: null } }
}

/**
 * El jefe restablece la contraseña de un empleado (la anterior NO se puede leer:
 * está cifrada). Verifica que el empleado le pertenezca y usa el cliente admin.
 */
export async function setEmployeePasswordAction(employeeId: string, password: string): Promise<ActionResult> {
  try {
    if (!password || password.length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: emps } = await supabase.rpc('list_my_employees')
    const owns = (emps as { id: string }[] | null)?.some(e => e.id === employeeId)
    if (!owns) return { success: false, error: 'Empleado no encontrado' }
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(employeeId, { password })
    if (error) return { success: false, error: 'No se pudo cambiar la contraseña (falta SUPABASE_SERVICE_ROLE_KEY en el servidor).' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
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

/**
 * Sube la foto de un empleado/staff al storage, GUARDA el enlace en la BD y
 * devuelve la URL pública. Recibe FormData (un File posicional puede llegar
 * vacío al Server Action — por eso fallaba/colgaba la subida).
 */
export async function uploadEmployeePhotoAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const id = formData.get('id') as string
    const isStaff = formData.get('isStaff') === 'true'
    const file = formData.get('file') as File
    if (!id || !file || !file.size) return { success: false, error: 'No se recibió la imagen' }

    const valid = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!valid.includes(file.type)) return { success: false, error: 'Formato no válido. Usa JPG, PNG o WebP.' }
    if (file.size > 3 * 1024 * 1024) return { success: false, error: 'La imagen supera 3MB.' }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const folder = isStaff ? 'staff' : 'employees'
    const path = `${folder}/${id}/photo-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) return { success: false, error: `No se pudo subir. Verifica el bucket public-assets. ${upErr.message}` }

    const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(path)

    // Guardar el enlace en la BD de inmediato (persistente, sin pulsar "Guardar").
    if (isStaff) {
      await supabase.from('staff').update({ photo_url: publicUrl }).eq('id', id).eq('boss_id', user.id)
    } else {
      await supabase.from('employee_meta').upsert({ employee_id: id, photo_url: publicUrl, updated_at: new Date().toISOString() })
    }
    return { success: true, url: publicUrl }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error subiendo foto'
    return { success: false, error: message }
  }
}

// ─── Datos extra del empleado (tel, seguro, emergencia, sucursal, sueldo) ────
export interface EmployeeMeta {
  phone: string | null
  insurance_no: string | null
  emergency_phone: string | null
  branch: string | null
  salary: number | null
  rfc: string | null
  position: string | null
  hire_date: string | null
  photo_url: string | null
}

export async function getEmployeeMeta(employeeId: string): Promise<EmployeeMeta | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('employee_meta')
      .select('phone, insurance_no, emergency_phone, branch, salary, rfc, position, hire_date, photo_url')
      .eq('employee_id', employeeId).maybeSingle()
    return (data as EmployeeMeta) ?? null
  } catch { return null }
}

export async function saveEmployeeMetaAction(employeeId: string, meta: EmployeeMeta): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('employee_meta').upsert({
      employee_id: employeeId,
      phone: meta.phone || null,
      insurance_no: meta.insurance_no || null,
      emergency_phone: meta.emergency_phone || null,
      branch: meta.branch || null,
      salary: meta.salary ?? null,
      rfc: meta.rfc || null,
      position: meta.position || null,
      hire_date: meta.hire_date || null,
      photo_url: meta.photo_url || null,
      updated_at: new Date().toISOString(),
    })
    if (error) return { success: false, error: 'No se pudo guardar (¿migración 024?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Jefe: cambia el rol de un empleado (empleado / supervisor / gerente). */
export async function setEmployeeRoleAction(employeeId: string, role: 'employee' | 'supervisor' | 'gerente'): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.rpc('set_employee_role', { emp_id: employeeId, new_role: role })
    if (error) return { success: false, error: 'No se pudo cambiar el rol (¿migración 033?)' }
    revalidatePath('/employees')
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Jefe: renombra a un empleado con login. */
export async function setEmployeeNameAction(employeeId: string, name: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!name.trim()) return { success: false, error: 'Escribe el nombre' }
    const { error } = await supabase.rpc('set_employee_name', { emp_id: employeeId, new_name: name.trim() })
    if (error) return { success: false, error: 'No se pudo renombrar (¿migración 034?)' }
    revalidatePath('/employees')
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Verifica la contraseña del jefe sin tocar su sesión (cliente anónimo). */
export async function verifyBossPasswordAction(password: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return { success: false, error: 'No autenticado' }
    if (!password) return { success: false, error: 'Escribe tu contraseña' }
    const anon = createPublicClient()
    const { error } = await anon.auth.signInWithPassword({ email: user.email, password })
    if (error) return { success: false, error: 'Contraseña incorrecta' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Ventas del día y la semana hechas por un empleado (atribución created_by). */
export async function getEmployeeStats(employeeId: string): Promise<{ todayCount: number; todayTotal: number; weekTotal: number }> {
  try {
    const supabase = await createClient()
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(Date.now() - 7 * 86400000)
    const { data, error } = await supabase
      .from('sales')
      .select('total, created_at, status')
      .eq('created_by', employeeId).eq('status', 'completed')
      .gte('created_at', weekStart.toISOString())
    if (error || !data) return { todayCount: 0, todayTotal: 0, weekTotal: 0 }
    let todayCount = 0, todayTotal = 0, weekTotal = 0
    for (const s of data) {
      weekTotal += Number(s.total)
      if (new Date(s.created_at) >= dayStart) { todayCount++; todayTotal += Number(s.total) }
    }
    return { todayCount, todayTotal, weekTotal }
  } catch { return { todayCount: 0, todayTotal: 0, weekTotal: 0 } }
}
