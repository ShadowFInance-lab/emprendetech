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

// ─── Asistencia manual (el jefe marca/edita días de un empleado con login) ───
export type DayState = 'present' | 'absent' | 'justified' | 'unpaid' | 'none'

/** Jefe: la semana (lun-dom) de asistencia de un empleado. */
export async function getEmployeeWeekAction(employeeId: string): Promise<AttendanceRow[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const now = new Date(); const dow = (now.getDay() + 6) % 7
    const mon = new Date(now); mon.setDate(now.getDate() - dow)
    const since = mon.toISOString().slice(0, 10)
    const { data } = await supabase.from('employee_attendance')
      .select('id, employee_id, work_date, check_in, check_out, note')
      .eq('boss_id', user.id).eq('employee_id', employeeId).gte('work_date', since)
    return (data ?? []) as AttendanceRow[]
  } catch { return [] }
}

/** Jefe: marca un día como presente / ausente / sin registro. */
export async function setEmployeeDayAction(employeeId: string, date: string, state: DayState): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (state === 'none') {
      await supabase.from('employee_attendance').delete().eq('boss_id', user.id).eq('employee_id', employeeId).eq('work_date', date)
      return { success: true }
    }
    const payload = state === 'present' ? { check_in: `${date}T09:00:00`, note: null }
      : state === 'justified' ? { check_in: null, check_out: null, note: 'Falta justificada' }
      : state === 'unpaid' ? { check_in: null, check_out: null, note: 'Permiso sin goce' }
      : { check_in: null, check_out: null, note: null } // absent
    const { data: ex } = await supabase.from('employee_attendance')
      .select('id').eq('employee_id', employeeId).eq('work_date', date).maybeSingle()
    if (!ex) {
      const { error } = await supabase.from('employee_attendance').insert({ employee_id: employeeId, boss_id: user.id, work_date: date, ...payload })
      if (error) return { success: false, error: 'No se pudo guardar (¿migración 023?)' }
    } else {
      await supabase.from('employee_attendance').update(payload).eq('id', ex.id).eq('boss_id', user.id)
    }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Jefe: edita la hora de entrada/salida de un día (formato HH:MM). */
export async function setEmployeeDayTimesAction(employeeId: string, date: string, checkIn: string, checkOut: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('employee_attendance').upsert({
      employee_id: employeeId, boss_id: user.id, work_date: date,
      check_in: checkIn ? `${date}T${checkIn}:00` : null,
      check_out: checkOut ? `${date}T${checkOut}:00` : null,
    }, { onConflict: 'employee_id,work_date' })
    if (error) return { success: false, error: 'No se pudo guardar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
