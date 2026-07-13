'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ─── Schemas de validación ───────────────────────────────────
const RegisterSchema = z.object({
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

// ─── Tipos de respuesta ──────────────────────────────────────
export type ActionResult = {
  success: boolean
  error?: string
  data?: unknown
}

// ─── REGISTRO ────────────────────────────────────────────────
export async function registerAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    full_name: formData.get('full_name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email`,
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { success: false, error: 'Este email ya está registrado' }
    }
    return { success: false, error: error.message }
  }

  // Prueba gratis: 5 días de plan Emprendedor para cada cuenta nueva.
  // Anti-abuso: si el correo YA existía, Supabase regresa un usuario SIN
  // identities (anti-enumeración) — en ese caso NO se regala trial.
  const newUserId = signUpData?.user?.id
  const isNewUser = (signUpData?.user?.identities?.length ?? 0) > 0
  if (newUserId && isNewUser) await grantTrialIfNewProfile(newUserId)

  return { success: true, data: { email: parsed.data.email } }
}

const TRIAL_DAYS = 5
/** Sin trial_used_at (mig 050 pendiente): solo cuentas < 48 h y plan free. */
const LEGACY_NEW_ACCOUNT_MS = 48 * 60 * 60 * 1000

/**
 * Otorga la prueba gratis (5 días Emprendedor) SOLO UNA VEZ por cuenta.
 *
 * Cuenta elegible = nunca usó trial ni tuvo plan de pago Emprendedor:
 *   - trial_used_at IS NULL (migración 050), y
 *   - plan free / perfil ausente, y
 *   - no es empleado.
 *
 * Si trial_used_at ya está set, o el plan no es free, o ya venció un trial
 * (plan_status expired/cancelled), NO se re-otorga.
 *
 * Preferible: trigger handle_new_user (mig 050) inserta trial + trial_used_at.
 * Esta función es respaldo (register / Google / login). Best-effort.
 * Al vencer: ensurePlanCurrentAction() baja a Gratis (conserva trial_used_at).
 *
 * plan_status CHECK: active|expired|cancelled|trial (NO 'trialing').
 */
export async function grantTrialIfNewProfile(userId: string): Promise<void> {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const hasServiceRole = !!key && !key.includes('YOUR_') && key.length >= 20
    const sessionDb = await createClient()
    const clients = hasServiceRole
      ? [createAdminClient(), sessionDb]
      : [sessionDb]

    type Prof = {
      plan?: string
      plan_status?: string | null
      plan_expires_at?: string | null
      trial_used_at?: string | null
      role?: string | null
      created_at?: string
    }
    let p: Prof | null = null
    let db = clients[0]
    let hasTrialUsedCol = true

    for (let attempt = 0; attempt < 5; attempt++) {
      for (const c of clients) {
        const sel = await c.from('profiles')
          .select('plan, plan_status, plan_expires_at, trial_used_at, role, created_at')
          .eq('id', userId).maybeSingle()
        if (!sel.error && sel.data) {
          p = sel.data
          db = c
          break
        }
        if (sel.error) {
          hasTrialUsedCol = false
          const r2 = await c.from('profiles')
            .select('plan, plan_status, plan_expires_at, role, created_at')
            .eq('id', userId).maybeSingle()
          if (!r2.error && r2.data) {
            p = r2.data
            db = c
            break
          }
          const r3 = await c.from('profiles')
            .select('plan, plan_status, plan_expires_at, created_at')
            .eq('id', userId).maybeSingle()
          if (r3.data) {
            p = r3.data
            db = c
            break
          }
        }
      }
      if (p) break
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
    }

    const ends = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()
    const usedAt = new Date().toISOString()

    // Ya usó trial / no elegible.
    if (p?.trial_used_at) return
    // Ya tiene (o tuvo) plan de pago / trial activo.
    if (p?.plan && p.plan !== 'free') return
    if (p?.plan_expires_at) return
    // Ya pasó por un trial o canceló (histórico sin columna).
    if (p?.plan_status && ['expired', 'cancelled', 'trial', 'trialing'].includes(String(p.plan_status))) return
    if (p?.role === 'employee') return

    // Legacy sin trial_used_at: solo cuentas muy recientes free/active.
    if (!hasTrialUsedCol || p?.trial_used_at === undefined) {
      if (p?.created_at) {
        const age = Date.now() - new Date(p.created_at).getTime()
        if (age > LEGACY_NEW_ACCOUNT_MS) return
      }
      if (p?.plan_status && p.plan_status !== 'active' && p.plan_status !== 'trial') return
    }

    const trialPayload = hasTrialUsedCol
      ? { plan: 'emprendedor', plan_status: 'trial', plan_expires_at: ends, trial_used_at: usedAt }
      : { plan: 'emprendedor', plan_status: 'trial', plan_expires_at: ends }
    const fallbackPayload = hasTrialUsedCol
      ? { plan: 'emprendedor', plan_status: 'active', plan_expires_at: ends, trial_used_at: usedAt }
      : { plan: 'emprendedor', plan_status: 'active', plan_expires_at: ends }

    if (!p) {
      if (!hasServiceRole) {
        console.error('[trial] perfil ausente y sin service-role')
        return
      }
      const admin = createAdminClient()
      let ins = await admin.from('profiles').insert({ id: userId, ...trialPayload })
      if (ins.error) {
        ins = await admin.from('profiles').insert({ id: userId, ...fallbackPayload })
        if (ins.error) console.error('[trial] no se pudo crear perfil con trial:', ins.error.message)
      }
      return
    }

    if (p.plan !== 'free') return

    // Solo free + sin marca de trial (evita re-grant).
    let q = db.from('profiles').update(trialPayload).eq('id', userId).eq('plan', 'free')
    if (hasTrialUsedCol) q = q.is('trial_used_at', null)
    let r = await q
    if (r.error) {
      let q2 = db.from('profiles').update(fallbackPayload).eq('id', userId).eq('plan', 'free')
      if (hasTrialUsedCol) q2 = q2.is('trial_used_at', null)
      r = await q2
    }
    if (r.error && clients.length > 1) {
      for (const c of clients) {
        if (c === db) continue
        let qx = c.from('profiles').update(trialPayload).eq('id', userId).eq('plan', 'free')
        if (hasTrialUsedCol) qx = qx.is('trial_used_at', null)
        r = await qx
        if (!r.error) break
        let qy = c.from('profiles').update(fallbackPayload).eq('id', userId).eq('plan', 'free')
        if (hasTrialUsedCol) qy = qy.is('trial_used_at', null)
        r = await qy
        if (!r.error) break
      }
    }
    if (r.error) console.error('[trial] no se pudo activar la prueba gratis:', r.error.message)
  } catch (e) { console.error('[trial] prueba gratis:', e) }
}

// ─── LOGIN ───────────────────────────────────────────────────
export async function loginAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { success: false, error: 'Email o contraseña incorrectos' }
  }

  // Respaldo: cuentas nuevas que quedaron en free (trigger viejo / sin service-role).
  const uid = signInData?.user?.id
  if (uid) await grantTrialIfNewProfile(uid)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ─── LOGOUT ──────────────────────────────────────────────────
export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ─── RECUPERAR CONTRASEÑA ────────────────────────────────────
export async function forgotPasswordAction(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string

  if (!email || !z.string().email().safeParse(email).success) {
    return { success: false, error: 'Ingresa un email válido' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  if (error) {
    return { success: false, error: 'Error al enviar el email. Intenta de nuevo.' }
  }

  return { success: true }
}

// ─── RESET CONTRASEÑA ────────────────────────────────────────
export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!password || password.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Las contraseñas no coinciden' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { success: false, error: 'Error al actualizar la contraseña' }
  }

  redirect('/login?reset=true')
}

// ─── OBTENER USUARIO ACTUAL ──────────────────────────────────
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── OBTENER PERFIL COMPLETO ─────────────────────────────────
export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
