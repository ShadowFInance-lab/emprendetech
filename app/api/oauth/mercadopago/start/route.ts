import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

/**
 * Inicia el OAuth de Mercado Pago (Marketplace) para conectar la cuenta de la
 * tienda y cobrar las VENTAS ahí. Requiere MERCADOPAGO_CLIENT_ID (app de
 * marketplace). Si no está, vuelve a Configuración con aviso (sin fingir).
 */
export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  if (!clientId) return NextResponse.redirect(`${origin}/settings?mp=cfg`)

  const redirectUri = `${origin}/api/oauth/mercadopago/callback`
  const state = randomBytes(16).toString('hex')

  const url = new URL('https://auth.mercadopago.com.mx/authorization')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('mp_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
