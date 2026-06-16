'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export type PayrollPeriod = 'week' | 'fortnight' | 'month'

export interface PayrollDay { date: string; checkIn: string | null; checkOut: string | null; note: string | null }
export interface PayrollRow {
  employeeId: string
  name: string | null
  phone: string | null
  emergency: string | null
  daysPresent: number
  base: number
  discount: number
  net: number
  days: PayrollDay[]
}
export interface PayrollResult { periodStart: string; rows: PayrollRow[] }

function periodStartDate(period: PayrollPeriod): string {
  const now = new Date()
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  if (period === 'fortnight') {
    const d = now.getDate() <= 15 ? 1 : 16
    return new Date(now.getFullYear(), now.getMonth(), d).toISOString().slice(0, 10)
  }
  const dow = (now.getDay() + 6) % 7 // 0 = lunes
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  return mon.toISOString().slice(0, 10)
}

/** Jefe: nómina del periodo (días, base, descuento, neto + detalle por día). */
export async function getPayrollAction(period: PayrollPeriod): Promise<PayrollResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { periodStart: '', rows: [] }
    const pStart = periodStartDate(period)

    const { data: emps } = await supabase.rpc('list_my_employees')
    const employees = (emps ?? []) as { id: string; full_name: string | null; email: string | null }[]
    if (employees.length === 0) return { periodStart: pStart, rows: [] }

    const ids = employees.map(e => e.id)
    const [{ data: att }, { data: metas }, { data: pays }] = await Promise.all([
      supabase.from('employee_attendance').select('employee_id, work_date, check_in, check_out, note')
        .eq('boss_id', user.id).gte('work_date', pStart),
      supabase.from('employee_meta').select('employee_id, phone, emergency_phone, salary').in('employee_id', ids),
      supabase.from('payroll').select('employee_id, discount').eq('boss_id', user.id).eq('period_start', pStart),
    ])

    const metaMap = new Map((metas ?? []).map(m => [m.employee_id, m]))
    const discMap = new Map((pays ?? []).map(p => [p.employee_id, Number(p.discount)]))
    const attByEmp = new Map<string, PayrollDay[]>()
    for (const a of att ?? []) {
      const arr = attByEmp.get(a.employee_id) ?? []
      arr.push({ date: a.work_date, checkIn: a.check_in, checkOut: a.check_out, note: a.note })
      attByEmp.set(a.employee_id, arr)
    }

    const rows: PayrollRow[] = employees.map(e => {
      const meta = metaMap.get(e.id)
      const days = (attByEmp.get(e.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))
      const base = Number(meta?.salary ?? 0)
      const discount = discMap.get(e.id) ?? 0
      return {
        employeeId: e.id,
        name: e.full_name,
        phone: meta?.phone ?? null,
        emergency: meta?.emergency_phone ?? null,
        daysPresent: days.filter(d => d.checkIn).length,
        base, discount, net: Math.max(0, base - discount),
        days,
      }
    })
    return { periodStart: pStart, rows }
  } catch {
    return { periodStart: '', rows: [] }
  }
}

export async function savePayrollDiscountAction(employeeId: string, periodStart: string, discount: number): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('payroll').upsert({
      employee_id: employeeId, boss_id: user.id, period_start: periodStart,
      discount: Math.max(0, discount || 0), updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,period_start' })
    if (error) return { success: false, error: 'No se pudo guardar (¿migración 025?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Empleado: su propia nómina del periodo (solo lectura). */
export async function getMyPayrollAction(period: PayrollPeriod): Promise<PayrollRow | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const pStart = periodStartDate(period)
    const [{ data: att }, { data: meta }, { data: pay }] = await Promise.all([
      supabase.from('employee_attendance').select('work_date, check_in, check_out, note')
        .eq('employee_id', user.id).gte('work_date', pStart),
      supabase.from('employee_meta').select('phone, emergency_phone, salary').eq('employee_id', user.id).maybeSingle(),
      supabase.from('payroll').select('discount').eq('employee_id', user.id).eq('period_start', pStart).maybeSingle(),
    ])
    const days: PayrollDay[] = (att ?? []).map(a => ({ date: a.work_date, checkIn: a.check_in, checkOut: a.check_out, note: a.note }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const base = Number(meta?.salary ?? 0)
    const discount = Number(pay?.discount ?? 0)
    return {
      employeeId: user.id, name: null, phone: meta?.phone ?? null, emergency: meta?.emergency_phone ?? null,
      daysPresent: days.filter(d => d.checkIn).length, base, discount, net: Math.max(0, base - discount), days,
    }
  } catch { return null }
}
