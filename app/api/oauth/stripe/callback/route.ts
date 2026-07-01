import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Callback de Stripe Connect: intercambia el code por el stripe_user_id
 * (account_id, acct_...) de la cuenta del vendedor y lo guarda en
 * store_payment_config. Usa la clave de PLATAFORMA (STRIPE_SECRET_KEY).
 */
export async function GET(req: NextRequest) {
  const { origin, searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.cookies.get('stripe_oauth_state')?.value
  const fail = () => NextResponse.redirect(`${origin}/settings?stripe=err`)

  if (!code || !state || !cookieState || state !== cookieState) return fail()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return NextResponse.redirect(`${origin}/settings?stripe=cfg`)

  try {
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_secret: secret,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const data = await tokenRes.json()
    if (!tokenRes.ok || !data?.stripe_user_id) {
      console.error('[STRIPE OAUTH] token exchange failed', data?.error, data?.error_description)
      return fail()
    }
    const accountId = data.stripe_user_id as string
    if (!accountId.startsWith('acct_')) {
      console.error('[STRIPE OAUTH] account id con formato inválido', accountId)
      return fail()
    }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store) return fail()

    const { error } = await supabase.from('store_payment_config').upsert({
      store_id: store.id,
      stripe_account_id: accountId,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.error('[STRIPE OAUTH] error guardando account:', error)
      return fail()
    }

    const res = NextResponse.redirect(`${origin}/settings?stripe=ok`)
    res.cookies.delete('stripe_oauth_state')
    return res
  } catch (err) {
    console.error('[STRIPE OAUTH] callback error:', err)
    return fail()
  }
}
