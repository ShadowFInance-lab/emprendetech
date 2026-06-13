'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './auth'

export interface SocialConn {
  provider: string
  account_name: string | null
}

/** Conexiones sociales guardadas (TikTok). NUNCA devuelve tokens. */
export async function getSocialConnections(): Promise<SocialConn[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('social_connections')
    .select('provider, account_name')
    .eq('user_id', user.id)
  if (error) return [] // la tabla puede no existir aún (migración 016 pendiente)
  return (data ?? []) as SocialConn[]
}

export async function disconnectSocialAction(provider: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)
  if (error) return { success: false, error: 'No se pudo desconectar' }
  return { success: true }
}
