import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Callback del OAuth de Mercado Pago: intercambia el code por el access_token
 * de la cuenta del vendedor y lo guarda en store_payment_config (ventas de la tienda).
 */
export async function GET(req: NextRequest) {
  const { origin, searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.cookies.get('mp_oauth_state')?.value
  const fail = () => NextResponse.redirect(`${origin}/settings?mp=err`)

  if (!code || !state || !cookieState || state !== cookieState) return fail()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  if (!clientId || !clientSecret) return NextResponse.redirect(`${origin}/settings?mp=cfg`)

  try {
    const redirectUri = `${origin}/api/oauth/mercadopago/callback`
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    if (!tokenRes.ok) {
      console.error('[MP OAUTH] token exchange failed', await tokenRes.text())
      return fail()
    }
    const token = await tokenRes.json()
    if (!token?.access_token) {
      console.error('[MP OAUTH] sin access_token', token)
      return fail()
    }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return fail()

    const { error: upsertErr } = await supabase.from('store_payment_config').upsert({
      store_id: store.id,
      mercadopago_access_token: token.access_token,
      updated_at: new Date().toISOString(),
    })
    if (upsertErr) {
      console.error('[MP OAUTH] error guardando token:', upsertErr)
      return fail()
    }

    const res = NextResponse.redirect(`${origin}/settings?mp=ok`)
    res.cookies.delete('mp_oauth_state')
    return res
  } catch (err) {
    console.error('[MP OAUTH] callback error:', err)
    return fail()
  }
}
