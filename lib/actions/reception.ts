'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'
import { listEmployeesAction } from './employees'
import { listStaffAction } from './staff'

export interface ReceptionOption { id: string; name: string }
export interface ReceptionData {
  type: 'employee' | 'branch' | 'multi' | null
  id: string | null
  value: string | null
  employees: ReceptionOption[]
  branches: ReceptionOption[]
}

async function ownerStore() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, store: null as { id: string; online_reception_type?: string | null; online_reception_id?: string | null; online_reception_value?: string | null } | null }
  // select('*') es tolerante si aún no se corrió la migración 039
  const { data: store } = await supabase.from('stores').select('*').eq('owner_id', user.id).maybeSingle()
  return { supabase, store }
}

/** Devuelve la preferencia actual + listas de empleados y sucursales para los selectores. */
export async function getReceptionDataAction(): Promise<ReceptionData> {
  const empty: ReceptionData = { type: null, id: null, value: null, employees: [], branches: [] }
  try {
    const { supabase, store } = await ownerStore()
    if (!store) return empty
    const [emps, staff, branchesRes] = await Promise.all([
      listEmployeesAction(),
      listStaffAction(),
      supabase.from('branches').select('id, name').eq('store_id', store.id).order('created_at'),
    ])
    const employees: ReceptionOption[] = [
      ...emps.map(e => ({ id: e.id, name: `${e.name ?? 'Empleado'} (con acceso)` })),
      ...staff.map(s => ({ id: s.id, name: `${s.name} (registro)` })),
    ]
    const branches: ReceptionOption[] = (branchesRes.data ?? []).map(b => ({ id: b.id as string, name: b.name as string }))
    return {
      type: (store.online_reception_type as 'employee' | 'branch' | 'multi') ?? null,
      id: store.online_reception_id ?? null,
      value: store.online_reception_value ?? null,
      employees, branches,
    }
  } catch { return empty }
}

/** Guarda a quién llegan los pedidos online (empleado, sucursal o multi). */
export async function setReceptionAction(type: 'employee' | 'branch' | 'multi', id: string, value: string): Promise<ActionResult> {
  try {
    const { supabase, store } = await ownerStore()
    if (!store) return { success: false, error: 'Sin tienda' }
    const { error } = await supabase.from('stores')
      .update({ online_reception_type: type, online_reception_id: id, online_reception_value: value })
      .eq('id', store.id)
    if (error) return { success: false, error: 'No se pudo guardar (¿corriste la migración 039?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Quita la preferencia (los pedidos quedan sin asignar). */
export async function clearReceptionAction(): Promise<ActionResult> {
  try {
    const { supabase, store } = await ownerStore()
    if (!store) return { success: false, error: 'Sin tienda' }
    await supabase.from('stores')
      .update({ online_reception_type: null, online_reception_id: null, online_reception_value: null })
      .eq('id', store.id)
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function addBranchAction(name: string): Promise<ActionResult> {
  try {
    const { supabase, store } = await ownerStore()
    if (!store) return { success: false, error: 'Sin tienda' }
    if (!name.trim()) return { success: false, error: 'Escribe el nombre de la sucursal' }
    const { error } = await supabase.from('branches').insert({ store_id: store.id, name: name.trim() })
    if (error) return { success: false, error: 'No se pudo crear la sucursal (¿corriste la migración 039?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, store } = await ownerStore()
    if (!store) return { success: false, error: 'Sin tienda' }
    const { error } = await supabase.from('branches').delete().eq('id', id).eq('store_id', store.id)
    if (error) return { success: false, error: 'No se pudo eliminar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
