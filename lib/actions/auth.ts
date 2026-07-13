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

/** Ventana para considerar "cuenta nueva" (email confirm / OAuth puede tardar). */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000
const TRIAL_DAYS = 5

/**
 * Otorga la prueba gratis (5 días de plan Emprendedor) a un perfil RECIÉN creado.
 * La usan el registro por correo Y el callback de OAuth (Google), para que
 * TODO usuario nuevo reciba el trial sin importar cómo se registre.
 *
 * Preferible: el trigger handle_new_user (migración 043) ya inserta el trial.
 * Esta función es respaldo si el trigger viejo solo creó plan free, o si el
 * perfil aún no existía. Guardas: plan free, sin vencimiento, cuenta < 24 h.
 * Si ya es emprendedor en trial/active con fecha, no toca nada.
 * Usa service-role (el correo puede no estar confirmado). Best-effort: jamás
 * bloquea el registro. Al vencer, ensurePlanCurrentAction() baja a Gratis.
 *
 * plan_status: el CHECK de profiles admite active|expired|cancelled|trial
 * (NO 'trialing'). Si 'trial' fallara en un entorno viejo, reintenta 'active'.
 */
export async function grantTrialIfNewProfile(userId: string): Promise<void> {
  try {
    // Clientes: service-role (si hay key real) + sesión del usuario (RLS own).
    // signUp/OAuth suelen devolver sesión; el update de trial no depende del admin.
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
      created_at?: string
    }
    let recentOk = true
    let p: Prof | null = null
    let db = clients[0]

    // Reintento breve: el trigger handle_new_user puede retrasar el INSERT del perfil.
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const c of clients) {
        const sel = await c.from('profiles')
          .select('plan, plan_status, plan_expires_at, created_at').eq('id', userId).maybeSingle()
        if (!sel.error && sel.data) {
          p = sel.data
          db = c
          break
        }
        if (sel.error) {
          const r2 = await c.from('profiles').select('plan, plan_expires_at').eq('id', userId).maybeSingle()
          if (r2.data) {
            p = r2.data
            db = c
            break
          }
        }
      }
      if (p) break
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
    }

    const ends = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()

    // Ya tiene trial/plan de pago con vencimiento: no re-otorgar.
    if (p && p.plan && p.plan !== 'free' && p.plan_expires_at) return
    // Trial activo sin depender del string de status (compat).
    if (p && p.plan === 'emprendedor' && p.plan_expires_at) return

    if (p?.created_at) {
      recentOk = Date.now() - new Date(p.created_at).getTime() < NEW_ACCOUNT_MS
    }

    // Perfil inexistente: crear con trial (solo service-role).
    if (!p) {
      if (!hasServiceRole) {
        console.error('[trial] perfil ausente y sin service-role')
        return
      }
      const admin = createAdminClient()
      const ins = await admin.from('profiles').insert({
        id: userId,
        plan: 'emprendedor',
        plan_status: 'trial',
        plan_expires_at: ends,
      })
      if (ins.error) {
        const ins2 = await admin.from('profiles').insert({
          id: userId,
          plan: 'emprendedor',
          plan_status: 'active',
          plan_expires_at: ends,
        })
        if (ins2.error) console.error('[trial] no se pudo crear perfil con trial:', ins2.error.message)
      }
      return
    }

    if (p.plan !== 'free' || p.plan_expires_at || !recentOk) return

    // CHECK real de la BD: 'trial' (no 'trialing').
    let r = await db.from('profiles')
      .update({ plan: 'emprendedor', plan_status: 'trial', plan_expires_at: ends })
      .eq('id', userId).eq('plan', 'free')
    if (r.error) {
      r = await db.from('profiles')
        .update({ plan: 'emprendedor', plan_status: 'active', plan_expires_at: ends })
        .eq('id', userId).eq('plan', 'free')
    }
    // Si el primer cliente falló, reintenta con el otro (sesión).
    if (r.error && clients.length > 1) {
      for (const c of clients) {
        if (c === db) continue
        r = await c.from('profiles')
          .update({ plan: 'emprendedor', plan_status: 'trial', plan_expires_at: ends })
          .eq('id', userId).eq('plan', 'free')
        if (!r.error) break
        r = await c.from('profiles')
          .update({ plan: 'emprendedor', plan_status: 'active', plan_expires_at: ends })
          .eq('id', userId).eq('plan', 'free')
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
