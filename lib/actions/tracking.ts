'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Registro MÍNIMO de interés (landing/registro) para el panel /admin.
 * - Escribe SIEMPRE con service-role: las tablas no tienen políticas públicas,
 *   así nadie puede leer ni falsear datos desde el navegador.
 * - NO guarda IP ni datos sensibles: solo un session_id aleatorio del navegador.
 * - NO cuenta al dueño de la plataforma (ni a usuarios ya logueados).
 * - Nunca lanza: si algo falla, la página sigue funcionando igual.
 */

/** ¿Quien navega es el dueño de la plataforma o alguien ya logueado? */
async function shouldSkip(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // Sin sesión = visitante real → se cuenta.
    if (!user) return false
    // Con sesión: nunca se cuentan (ni el dueño ni clientes ya registrados).
    return true
  } catch { return false }
}

/** Visita a la landing o al registro (una por sesión y página cada 12 h). */
export async function trackVisitAction(page: 'landing' | 'register', sessionId: string, userAgent?: string): Promise<void> {
  try {
    if (!page || !sessionId) return
    if (await shouldSkip()) return
    const admin = createAdminClient()

    // Anti-duplicado: si esa sesión ya registró esta página hace menos de 12 h,
    // no se vuelve a contar (evita inflar el número al recargar).
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    const { data: dup } = await admin.from('page_visits')
      .select('id').eq('session_id', sessionId).eq('page', page).gte('created_at', since).limit(1)
    if (dup && dup.length > 0) return

    await admin.from('page_visits').insert({
      page,
      session_id: sessionId,
      user_agent: (userAgent ?? '').slice(0, 300) || null,
    })
  } catch (e) {
    console.error('[tracking] visita:', e instanceof Error ? e.message : e)
  }
}

/**
 * El visitante empezó el formulario de registro (escribió su correo) pero aún
 * no termina. Se guarda como lead incompleto y se actualiza por session_id.
 */
export async function trackSignupLeadAction(sessionId: string, email: string, step: string): Promise<void> {
  try {
    if (!sessionId) return
    if (await shouldSkip()) return
    const clean = (email ?? '').trim().toLowerCase()
    const admin = createAdminClient()
    await admin.from('signup_leads').upsert({
      session_id: sessionId,
      email: clean || null,
      step: step || 'email',
    }, { onConflict: 'session_id' })
  } catch (e) {
    console.error('[tracking] lead:', e instanceof Error ? e.message : e)
  }
}

/** El registro SÍ se completó: el lead deja de contar como incompleto. */
export async function markSignupCompletedAction(sessionId: string, email: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const clean = (email ?? '').trim().toLowerCase()
    const now = new Date().toISOString()
    if (sessionId) {
      await admin.from('signup_leads').update({ completed: true, completed_at: now, step: 'completado' })
        .eq('session_id', sessionId)
    }
    // Respaldo por correo (si el visitante cambió de pestaña o de sesión).
    if (clean) {
      await admin.from('signup_leads').update({ completed: true, completed_at: now, step: 'completado' })
        .eq('email', clean).eq('completed', false)
    }
  } catch (e) {
    console.error('[tracking] completado:', e instanceof Error ? e.message : e)
  }
}
