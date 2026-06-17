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
    const keys = ['name', 'phone', 'emergency_phone', 'insurance_no', 'branch', 'salary', 'days_worked', 'absences', 'discount', 'bonus', 'paid', 'note'] as const
    const payload: Record<string, unknown> = {}
    for (const k of keys) if (fields[k] !== undefined) payload[k] = fields[k]
    if (Object.keys(payload).length === 0) return { success: true }
    const { error } = await supabase.from('staff').update(payload).eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo guardar' }
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
