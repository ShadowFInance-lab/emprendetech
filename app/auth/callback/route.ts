import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { grantTrialIfNewProfile } from '@/lib/actions/auth'

/**
 * Callback de OAuth (Google / Facebook).
 * Supabase redirige aquí con un ?code que intercambiamos por una sesión.
 * Luego mandamos al usuario al dashboard (o al onboarding si es nuevo).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // ¿Completó onboarding? Si no, mandarlo a crear su tienda.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Registro con Google: otorga la prueba gratis de 5 días si el perfil
        // es nuevo (mismas guardas que el registro por correo; los logins
        // repetidos no re-otorgan).
        await grantTrialIfNewProfile(user.id)
        const { data: profile } = await supabase
          .from('profiles').select('onboarding_done').eq('id', user.id).single()
        const dest = profile?.onboarding_done ? next : '/onboarding'
        return NextResponse.redirect(`${origin}${dest}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Error: volver al login con mensaje
  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
