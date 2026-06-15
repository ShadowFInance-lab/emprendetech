'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export interface AttendanceRow {
  id: string
  employee_id: string
  work_date: string
  check_in: string | null
  check_out: string | null
  note: string | null
}

function today() { return new Date().toISOString().slice(0, 10) }

/** Empleado: registrar entrada (crea la fila de hoy si no existe). */
export async function clockInAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { data: prof } = await supabase.from('profiles').select('boss_id').eq('id', user.id).maybeSingle()
    const { error } = await supabase.from('employee_attendance').upsert({
      employee_id: user.id,
      boss_id: prof?.boss_id ?? null,
      work_date: today(),
      check_in: new Date().toISOString(),
    }, { onConflict: 'employee_id,work_date', ignoreDuplicates: false })
    if (error) return { success: false, error: 'No se pudo registrar la entrada (¿migración 023?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Empleado: registrar salida. */
export async function clockOutAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('employee_attendance')
      .update({ check_out: new Date().toISOString() })
      .eq('employee_id', user.id).eq('work_date', today())
    if (error) return { success: false, error: 'No se pudo registrar la salida' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function getMyTodayAttendance(): Promise<AttendanceRow | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('employee_attendance')
      .select('id, employee_id, work_date, check_in, check_out, note')
      .eq('employee_id', user.id).eq('work_date', today()).maybeSingle()
    return (data as AttendanceRow) ?? null
  } catch { return null }
}

/** Jefe: asistencia de su equipo en los últimos N días. */
export async function getTeamAttendance(days = 7): Promise<AttendanceRow[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase.from('employee_attendance')
      .select('id, employee_id, work_date, check_in, check_out, note')
      .eq('boss_id', user.id).gte('work_date', since)
      .order('work_date', { ascending: false })
    if (error) return []
    return (data ?? []) as AttendanceRow[]
  } catch { return [] }
}

/** Jefe: guardar/editar una nota de asistencia. */
export async function saveAttendanceNoteAction(id: string, note: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('employee_attendance')
      .update({ note: note.trim() || null }).eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo guardar la nota' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
