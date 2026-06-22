'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

/** Empleado "solo registro" (sin login): solo vive en nómina/asistencia. */
export interface Staff {
  id: string
  name: string
  phone: string | null
  emergency_phone: string | null
  insurance_no: string | null
  branch: string | null
  salary: number
  days_worked: number
  absences: number
  discount: number
  bonus: number
  paid: boolean
  note: string | null
  rfc: string | null
  position: string | null
  hire_date: string | null
  photo_url: string | null
  week_attendance: Record<string, string>
}

export async function listStaffAction(): Promise<Staff[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.from('staff').select('*')
      .eq('boss_id', user.id).eq('active', true).order('created_at', { ascending: true })
    if (error) return []
    return (data ?? []).map(s => ({
      id: s.id as string, name: s.name as string,
      phone: s.phone ?? null, emergency_phone: s.emergency_phone ?? null, insurance_no: s.insurance_no ?? null, branch: s.branch ?? null,
      salary: Number(s.salary) || 0, days_worked: Number(s.days_worked) || 0, absences: Number(s.absences) || 0,
      discount: Number(s.discount) || 0, bonus: Number(s.bonus) || 0, paid: !!s.paid, note: s.note ?? null,
      rfc: s.rfc ?? null, position: s.position ?? null, hire_date: s.hire_date ?? null, photo_url: s.photo_url ?? null,
      week_attendance: (s.week_attendance as Record<string, string>) ?? {},
    }))
  } catch { return [] }
}

export async function createStaffAction(name: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!name.trim()) return { success: false, error: 'Escribe el nombre' }
    const { error } = await supabase.from('staff').insert({ boss_id: user.id, name: name.trim() })
    if (error) return { success: false, error: 'No se pudo crear (¿migración 030?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function saveStaffAction(id: string, fields: Partial<Omit<Staff, 'id'>>): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const keys = ['name', 'phone', 'emergency_phone', 'insurance_no', 'branch', 'salary', 'days_worked', 'absences', 'discount', 'bonus', 'paid', 'note', 'rfc', 'position', 'hire_date', 'photo_url', 'week_attendance'] as const
    const payload: Record<string, unknown> = {}
    for (const k of keys) if (fields[k] !== undefined) payload[k] = fields[k]
    if (Object.keys(payload).length === 0) return { success: true }
    let { error } = await supabase.from('staff').update(payload).eq('id', id).eq('boss_id', user.id)
    // Si falta la columna week_attendance (migración 036 sin correr), reintenta sin ella
    // para no perder el resto de los datos.
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /column|schema cache/i.test(error.message ?? ''))) {
      delete payload.week_attendance
      error = (await supabase.from('staff').update(payload).eq('id', id).eq('boss_id', user.id)).error
    }
    if (error) return { success: false, error: 'No se pudo guardar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Auto-guarda un día de asistencia del empleado de registro (sin pulsar "Guardar"). */
export async function setStaffDayAction(id: string, date: string, state: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: row } = await supabase.from('staff').select('week_attendance').eq('id', id).eq('boss_id', user.id).single()
    const wa = { ...((row?.week_attendance as Record<string, string>) ?? {}) }
    if (state === 'none') delete wa[date]; else wa[date] = state
    const { error } = await supabase.from('staff').update({ week_attendance: wa }).eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo guardar la asistencia. Corre la migración 036 en Supabase.' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function deleteStaffAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('staff').delete().eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo eliminar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
