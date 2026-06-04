'use server'

import { createClient } from '@/lib/supabase/server'

export interface DailySalesPoint {
  date: string       // "2026-06-01"
  label: string      // "1 Jun"
  total: number
  count: number
}

/**
 * Obtiene las ventas agrupadas por día de los últimos N días.
 * Usado para la gráfica del dashboard.
 */
export async function getSalesChartData(days = 30): Promise<DailySalesPoint[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  const { data: sales } = await supabase
    .from('sales')
    .select('total, created_at')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  // Inicializar todos los días en 0
  const map = new Map<string, { total: number; count: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    map.set(key, { total: 0, count: 0 })
  }

  // Sumar ventas por día
  sales?.forEach(sale => {
    const key = new Date(sale.created_at).toISOString().slice(0, 10)
    const entry = map.get(key)
    if (entry) {
      entry.total += Number(sale.total)
      entry.count += 1
    }
  })

  // Convertir a array con labels legibles
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return Array.from(map.entries()).map(([date, { total, count }]) => {
    const d = new Date(date + 'T12:00:00')
    return {
      date,
      label: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      total,
      count,
    }
  })
}
