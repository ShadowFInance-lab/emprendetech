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
  // Al vencer, ensurePlanCurrentAction() la baja a Gratis (tarifa normal).
  // Se usa service-role porque el correo puede no estar confirmado aún.
  const newUserId = signUpData?.user?.id
  if (newUserId) {
    try {
      const admin = createAdminClient()
      const ends = new Date(Date.now() + 5 * 86400000).toISOString()
      let r = await admin.from('profiles')
        .update({ plan: 'emprendedor', plan_status: 'trialing', plan_expires_at: ends })
        .eq('id', newUserId)
      // Si plan_status tiene un CHECK que no admite 'trialing', reintenta con 'active'.
      if (r.error) {
        r = await admin.from('profiles')
          .update({ plan: 'emprendedor', plan_status: 'active', plan_expires_at: ends })
          .eq('id', newUserId)
      }
      if (r.error) console.error('[registro] no se pudo activar la prueba gratis:', r.error.message)
    } catch (e) { console.error('[registro] prueba gratis:', e) }
  }

  return { success: true, data: { email: parsed.data.email } }
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

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { success: false, error: 'Email o contraseña incorrectos' }
  }

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
