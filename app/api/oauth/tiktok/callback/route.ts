import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Callback del OAuth de TikTok: intercambia el code por token, obtiene el
 * nombre de la cuenta y lo guarda en social_connections (vía service role).
 */
export async function GET(req: NextRequest) {
  const { origin, searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.cookies.get('tiktok_oauth_state')?.value

  const fail = () => NextResponse.redirect(`${origin}/settings?social=tiktok_err`)

  if (!code) return fail()
  if (!state || !cookieState || state !== cookieState) return fail()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(`${origin}/settings?social=tiktok_cfg`)
  }

  try {
    const redirectUri = `${origin}/api/oauth/tiktok/callback`
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    const token = await tokenRes.json()
    if (!token?.access_token) return fail()

    // Nombre de la cuenta (best-effort)
    let accountName: string | null = null
    try {
      const meRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      const me = await meRes.json()
      accountName = me?.data?.user?.display_name ?? null
    } catch { /* opcional */ }

    const admin = createAdminClient()
    await admin.from('social_connections').upsert({
      user_id: user.id,
      provider: 'tiktok',
      account_name: accountName,
      account_id: token.open_id ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    }, { onConflict: 'user_id,provider' })

    const res = NextResponse.redirect(`${origin}/settings?social=tiktok_ok`)
    res.cookies.delete('tiktok_oauth_state')
    return res
  } catch (err) {
    console.error('TikTok callback error:', err)
    return fail()
  }
}
