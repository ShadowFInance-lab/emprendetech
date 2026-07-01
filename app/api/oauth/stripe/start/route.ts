import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

/**
 * Inicia Stripe Connect (OAuth) para conectar la cuenta de Stripe del comercio
 * y cobrar sus ventas con destination charges. Requiere STRIPE_CONNECT_CLIENT_ID
 * (app de Connect de la plataforma). Si no está, vuelve a Configuración con aviso.
 */
export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId) return NextResponse.redirect(`${origin}/settings?stripe=cfg`)

  const redirectUri = `${origin}/api/oauth/stripe/callback`
  const state = randomBytes(16).toString('hex')

  const url = new URL('https://connect.stripe.com/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'read_write')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('stripe_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
