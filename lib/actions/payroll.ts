'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export type PayrollPeriod = 'week' | 'fortnight' | 'month' | 'custom'

export interface PayrollDay { date: string; checkIn: string | null; checkOut: string | null; note: string | null }
export interface PayrollRow {
  employeeId: string
  name: string | null
  phone: string | null
  emergency: string | null
  insurance: string | null
  branch: string | null
  notes: string
  daysPresent: number
  base: number
  discount: number
  bonus: number
  paid: boolean
  net: number
  days: PayrollDay[]
}
export interface PayrollResult { periodStart: string; rows: PayrollRow[] }

function periodStartDate(period: PayrollPeriod, cycleDays = 7, anchorISO?: string | null): string {
  const now = new Date()
  if (period === 'custom') {
    // Periodo personalizado: bloques de N días que se reinician automáticamente
    // desde una fecha ancla (cada N días). Sin ancla, empieza hoy.
    const n = Math.max(1, cycleDays || 7)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const anchor = anchorISO ? new Date(anchorISO + 'T00:00:00') : today
    const diff = Math.floor((today.getTime() - anchor.getTime()) / 86400000)
    const blocks = diff > 0 ? Math.floor(diff / n) : 0
    const start = new Date(anchor); start.setDate(anchor.getDate() + blocks * n)
    return start.toISOString().slice(0, 10)
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  if (period === 'fortnight') {
    const d = now.getDate() <= 15 ? 1 : 16
    return new Date(now.getFullYear(), now.getMonth(), d).toISOString().slice(0, 10)
  }
  // week (default) — Catorcenal (biweekly) removed in v7.31
  const dow = (now.getDay() + 6) % 7 // 0 = lunes
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  return mon.toISOString().slice(0, 10)
}

/** Lee el ciclo de nómina personalizado del dueño (cada N días + fecha ancla). */
export async function getPayrollCycleAction(): Promise<{ days: number; anchor: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { days: 7, anchor: null }
    const { data } = await supabase.from('stores').select('payroll_cycle_days, payroll_cycle_anchor').eq('owner_id', user.id).maybeSingle()
    return { days: Number(data?.payroll_cycle_days) || 7, anchor: (data?.payroll_cycle_anchor as string) ?? null }
  } catch { return { days: 7, anchor: null } }
}

/** Guarda el ciclo de nómina personalizado (días de corte + fecha de inicio). */
export async function savePayrollCycleAction(days: number, anchor: string | null): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('stores')
      .update({ payroll_cycle_days: Math.max(1, days || 7), payroll_cycle_anchor: anchor || null })
      .eq('owner_id', user.id)
    if (error) return { success: false, error: 'No se pudo guardar el ciclo (¿corriste la migración 041?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Jefe: nómina del periodo (días, base, descuento, neto + detalle por día). */
export async function getPayrollAction(period: PayrollPeriod, cycleDays?: number, anchorISO?: string | null): Promise<PayrollResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { periodStart: '', rows: [] }
    const pStart = periodStartDate(period, cycleDays, anchorISO)

    const { data: emps } = await supabase.rpc('list_my_employees')
    const employees = (emps ?? []) as { id: string; full_name: string | null; email: string | null }[]
    if (employees.length === 0) return { periodStart: pStart, rows: [] }

    const ids = employees.map(e => e.id)
    const [{ data: att }, { data: metas }, { data: pays }] = await Promise.all([
      supabase.from('employee_attendance').select('employee_id, work_date, check_in, check_out, note')
        .eq('boss_id', user.id).gte('work_date', pStart),
      supabase.from('employee_meta').select('employee_id, phone, emergency_phone, insurance_no, branch, salary').in('employee_id', ids),
      supabase.from('payroll').select('employee_id, discount, bonus, paid').eq('boss_id', user.id).eq('period_start', pStart),
    ])

    const metaMap = new Map((metas ?? []).map(m => [m.employee_id, m]))
    const payMap = new Map((pays ?? []).map(p => [p.employee_id, p]))
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
      const pay = payMap.get(e.id)
      const discount = Number(pay?.discount) || 0
      return {
        employeeId: e.id,
        name: e.full_name,
        phone: meta?.phone ?? null,
        emergency: meta?.emergency_phone ?? null,
        insurance: meta?.insurance_no ?? null,
        branch: meta?.branch ?? null,
        notes: days.filter(d => d.note).map(d => `${d.date.slice(5)}: ${d.note}`).join(' · '),
        daysPresent: days.filter(d => d.checkIn).length,
        base, discount, bonus: Number(pay?.bonus) || 0, paid: !!pay?.paid, net: Math.max(0, base - discount),
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

/** Guarda descuento/bono/estado de un empleado con login para el periodo. */
export async function savePayrollRowAction(employeeId: string, periodStart: string, fields: { discount?: number; bonus?: number; paid?: boolean }): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const row: Record<string, unknown> = { employee_id: employeeId, boss_id: user.id, period_start: periodStart, updated_at: new Date().toISOString() }
    if (fields.discount !== undefined) row.discount = Math.max(0, fields.discount || 0)
    if (fields.bonus !== undefined) row.bonus = Math.max(0, fields.bonus || 0)
    if (fields.paid !== undefined) row.paid = fields.paid
    const { error } = await supabase.from('payroll').upsert(row, { onConflict: 'employee_id,period_start' })
    if (error) return { success: false, error: 'No se pudo guardar (¿migración 032?)' }
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
      supabase.from('employee_meta').select('phone, emergency_phone, insurance_no, branch, salary').eq('employee_id', user.id).maybeSingle(),
      supabase.from('payroll').select('discount, bonus, paid').eq('employee_id', user.id).eq('period_start', pStart).maybeSingle(),
    ])
    const days: PayrollDay[] = (att ?? []).map(a => ({ date: a.work_date, checkIn: a.check_in, checkOut: a.check_out, note: a.note }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const base = Number(meta?.salary ?? 0)
    const discount = Number(pay?.discount ?? 0)
    return {
      employeeId: user.id, name: null, phone: meta?.phone ?? null, emergency: meta?.emergency_phone ?? null,
      insurance: meta?.insurance_no ?? null, branch: meta?.branch ?? null,
      notes: days.filter(d => d.note).map(d => `${d.date.slice(5)}: ${d.note}`).join(' · '),
      daysPresent: days.filter(d => d.checkIn).length, base, discount, bonus: Number(pay?.bonus) || 0, paid: !!pay?.paid, net: Math.max(0, base - discount), days,
    }
  } catch { return null }
}

// ─── Descuentos generales (ISR, Seguro Social, otros) ───────────────────────
export interface PayrollDeduction {
  id: string
  concept: string
  kind: 'percent' | 'amount'
  value: number
  description: string | null
}

/** Lista los descuentos generales del equipo (jefe o empleado vía RLS). */
export async function getDeductionsAction(): Promise<PayrollDeduction[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('payroll_deductions')
      .select('id, concept, kind, value, description')
      .order('created_at', { ascending: true })
    if (error) return []
    return (data ?? []).map(d => ({
      id: d.id as string,
      concept: d.concept as string,
      kind: (d.kind as 'percent' | 'amount') ?? 'percent',
      value: Number(d.value) || 0,
      description: (d.description as string) ?? null,
    }))
  } catch { return [] }
}

export async function saveDeductionAction(input: {
  id?: string; concept: string; kind: 'percent' | 'amount'; value: number; description?: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!input.concept.trim()) return { success: false, error: 'Escribe el concepto' }
    const payload = {
      concept: input.concept.trim(),
      kind: input.kind,
      value: Math.max(0, input.value || 0),
      description: input.description?.trim() || null,
    }
    if (input.id) {
      const { error } = await supabase.from('payroll_deductions').update(payload).eq('id', input.id).eq('boss_id', user.id)
      if (error) return { success: false, error: 'No se pudo guardar' }
    } else {
      const { error } = await supabase.from('payroll_deductions').insert({ ...payload, boss_id: user.id })
      if (error) return { success: false, error: 'No se pudo guardar (¿migración 028?)' }
    }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function deleteDeductionAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('payroll_deductions').delete().eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo eliminar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

// ─── Cartocena (fondo del equipo, semanal con aportes por empleado) ─────────
export interface TeamFund { goal: number; accumulated: number; contributors: number }
export interface FundContribution { id: string; contributor: string; amount: number; created_at: string }

function mondayISO(): string {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  return mon.toISOString().slice(0, 10)
}

/** Cartocena del periodo: meta + acumulado y aportantes derivados de los aportes. */
export async function getTeamFundAction(period: PayrollPeriod = 'week'): Promise<TeamFund & { items: FundContribution[] }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { goal: 0, accumulated: 0, contributors: 0, items: [] }
    const start = periodStartDate(period)
    const [{ data: tf }, { data: contrib }] = await Promise.all([
      supabase.from('team_fund').select('goal').eq('boss_id', user.id).maybeSingle(),
      supabase.from('team_fund_contributions').select('id, contributor, amount, created_at')
        .eq('boss_id', user.id).gte('created_at', `${start}T00:00:00`).order('created_at', { ascending: false }),
    ])
    const items: FundContribution[] = (contrib ?? []).map(c => ({
      id: c.id as string, contributor: c.contributor as string, amount: Number(c.amount) || 0, created_at: c.created_at as string,
    }))
    const accumulated = items.reduce((s, i) => s + i.amount, 0)
    const contributors = new Set(items.map(i => i.contributor)).size
    return { goal: Number(tf?.goal) || 0, accumulated, contributors, items }
  } catch { return { goal: 0, accumulated: 0, contributors: 0, items: [] } }
}

/** Guarda solo la meta semanal de la cartocena. */
export async function saveTeamFundGoalAction(goal: number): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('team_fund').upsert({
      boss_id: user.id, goal: Math.max(0, goal || 0), week_start: mondayISO(), updated_at: new Date().toISOString(),
    }, { onConflict: 'boss_id' })
    if (error) return { success: false, error: 'No se pudo guardar (¿migración 029?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

/** Registra un aporte de un empleado a la cartocena de esta semana. */
export async function addFundContributionAction(contributor: string, amount: number): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    if (!contributor.trim()) return { success: false, error: 'Elige quién aporta' }
    if (!(amount > 0)) return { success: false, error: 'Monto inválido' }
    const { error } = await supabase.from('team_fund_contributions').insert({
      boss_id: user.id, contributor: contributor.trim(), amount, week_start: mondayISO(),
    })
    if (error) return { success: false, error: 'No se pudo registrar (¿migración 031?)' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}

export async function deleteFundContributionAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    const { error } = await supabase.from('team_fund_contributions').delete().eq('id', id).eq('boss_id', user.id)
    if (error) return { success: false, error: 'No se pudo eliminar' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
