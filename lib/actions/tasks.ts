'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export interface Task {
  id: string
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string | null
  done: boolean
  created_at: string
}

/** Jefe: crea una tarea (opcionalmente asignada a un empleado). */
export async function createTaskAction(input: { assignedTo?: string; title: string; description?: string; dueDate?: string }): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!input.title.trim()) return { success: false, error: 'Escribe la tarea' }
    const { error } = await supabase.from('tasks').insert({
      boss_id: user.id, assigned_to: input.assignedTo || null, title: input.title.trim(),
      description: input.description?.trim() || null, due_date: input.dueDate || null,
    })
    if (error) return { success: false, error: 'No se pudo crear (¿migración 033?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Jefe: todas las tareas del equipo. */
export async function listTasksBossAction(): Promise<Task[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.from('tasks')
      .select('id, assigned_to, title, description, due_date, done, created_at')
      .eq('boss_id', user.id).order('done', { ascending: true }).order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as Task[]
  } catch { return [] }
}

/** Empleado: sus tareas asignadas (RLS limita a assigned_to = uid). */
export async function listMyTasksAction(): Promise<Task[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.from('tasks')
      .select('id, assigned_to, title, description, due_date, done, created_at')
      .eq('assigned_to', user.id).order('done', { ascending: true }).order('due_date', { ascending: true, nullsFirst: false })
    if (error) return []
    return (data ?? []) as Task[]
  } catch { return [] }
}

export async function toggleTaskAction(id: string, done: boolean): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('tasks').update({ done }).eq('id', id)
    if (error) return { success: false, error: 'No se pudo actualizar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo eliminar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
