import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

/**
 * Inicia el OAuth real de TikTok (Login Kit).
 * Abre la pantalla oficial de TikTok cuando TIKTOK_CLIENT_KEY está configurada;
 * si no, vuelve a Configuración con un aviso claro (sin fingir conexión).
 */
export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  if (!clientKey) {
    return NextResponse.redirect(`${origin}/settings?social=tiktok_cfg`)
  }

  const redirectUri = `${origin}/api/oauth/tiktok/callback`
  const state = randomBytes(16).toString('hex')

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authUrl.searchParams.set('client_key', clientKey)
  authUrl.searchParams.set('scope', 'user.info.basic')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authUrl.toString())
  // Guardar el state en cookie httpOnly para validarlo en el callback (anti-CSRF)
  res.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}
