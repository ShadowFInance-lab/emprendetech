'use server'

import { createPublicClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

/**
 * Reporte público de una tienda o pedido (moderación). Inserta en la tabla
 * `reports` (RLS: inserción pública, sin lectura pública). La plataforma revisa
 * los reportes desde el panel de Supabase. Migración 054.
 */
export async function submitReportAction(input: {
  storeSlug?: string
  orderNo?: string
  reason: string
  detail?: string
  reporterEmail?: string
}): Promise<ActionResult> {
  try {
    if (!input.reason?.trim()) return { success: false, error: 'Elige un motivo' }
    const supabase = createPublicClient()
    const { error } = await supabase.from('reports').insert({
      store_slug: input.storeSlug?.trim() || null,
      order_no: input.orderNo?.trim() || null,
      reason: input.reason.trim(),
      detail: input.detail?.trim() || null,
      reporter_email: input.reporterEmail?.trim() || null,
    })
    if (error) return { success: false, error: 'No se pudo enviar el reporte. Intenta más tarde.' }
    return { success: true }
  } catch { return { success: false, error: 'Error' } }
}
