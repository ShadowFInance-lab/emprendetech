'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export interface TeamMessage {
  id: string
  boss_id: string | null
  employee_id: string | null
  from_role: 'boss' | 'employee'
  message: string
  read: boolean
  created_at: string
}

/** Jefe envía un mensaje a un empleado. */
export async function bossSendMessageAction(employeeId: string, message: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!message.trim()) return { success: false, error: 'Escribe un mensaje' }
    const { error } = await supabase.from('team_messages').insert({
      boss_id: user.id, employee_id: employeeId, from_role: 'boss', message: message.trim(),
    })
    if (error) return { success: false, error: 'No se pudo enviar (¿migración 024?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Empleado responde a su jefe. */
export async function employeeReplyAction(message: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!message.trim()) return { success: false, error: 'Escribe un mensaje' }
    const { data: prof } = await supabase.from('profiles').select('boss_id').eq('id', user.id).maybeSingle()
    const { error } = await supabase.from('team_messages').insert({
      boss_id: prof?.boss_id ?? null, employee_id: user.id, from_role: 'employee', message: message.trim(),
    })
    if (error) return { success: false, error: 'No se pudo enviar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Jefe: hilo con un empleado. */
export async function getThreadAction(employeeId: string): Promise<TeamMessage[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase.from('team_messages')
      .select('*').eq('boss_id', user.id).eq('employee_id', employeeId)
      .order('created_at', { ascending: true }).limit(100)
    return (data ?? []) as TeamMessage[]
  } catch { return [] }
}

/** Empleado: su hilo con el jefe. */
export async function getMyThreadAction(): Promise<TeamMessage[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase.from('team_messages')
      .select('*').eq('employee_id', user.id)
      .order('created_at', { ascending: true }).limit(100)
    return (data ?? []) as TeamMessage[]
  } catch { return [] }
}

/** Empleado marca como leídos los mensajes del jefe. */
export async function markBossMessagesReadAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }
    await supabase.from('team_messages').update({ read: true })
      .eq('employee_id', user.id).eq('from_role', 'boss').eq('read', false)
    return { success: true }
  } catch { return { success: false } }
}
