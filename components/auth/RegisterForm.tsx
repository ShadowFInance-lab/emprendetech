'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { registerAction } from '@/lib/actions/auth'
import { trackSignupLeadAction, markSignupCompletedAction } from '@/lib/actions/tracking'
import { getSessionId } from '@/components/VisitTracker'
import SocialAuthButtons from './SocialAuthButtons'

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const emailValue = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm_password') as string

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    startTransition(async () => {
      const result = await registerAction(formData)
      if (result.success) {
        // El registro se completó: el lead deja de contar como incompleto.
        markSignupCompletedAction(getSessionId(), emailValue).catch(() => {})
        setEmail(emailValue)
        setSuccess(true)
      } else {
        setError(result.error ?? 'Error al registrarse')
      }
    })
  }

  // ─── Estado: email enviado ───────────────────────────────
  if (success) {
    return (
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">¡Revisa tu correo!</h2>
          <p className="text-gray-600">
            Enviamos un enlace de verificación a{' '}
            <strong className="text-gray-900">{email}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Haz clic en el enlace para activar tu cuenta y comenzar.
          </p>
          <Link href="/login">
            <Button variant="outline" className="mt-4 w-full">
              Volver al inicio de sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Crear cuenta gratis
        </CardTitle>
        <CardDescription className="text-center">
          Comienza a vender en línea hoy mismo
        </CardDescription>
        {/* Gancho de la prueba gratis (se activa sola al registrarse) */}
        <div className="mx-auto mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
          🎁 Incluye 7 días gratis del plan Emprendedor
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="Juan García"
              required
              disabled={isPending}
              autoComplete="name"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@correo.com"
              required
              disabled={isPending}
              autoComplete="email"
              onBlur={e => {
                const v = e.target.value.trim()
                if (v.includes('@')) trackSignupLeadAction(getSessionId(), v, 'email').catch(() => {})
              }}
            />
          </div>

          {/* Contraseña */}
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                disabled={isPending}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar contraseña</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repite tu contraseña"
              required
              disabled={isPending}
              className="pr-10"
              autoComplete="new-password"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Términos — checkbox obligatorio (el navegador bloquea el envío sin él) */}
          <label className="flex items-start gap-2.5 text-xs text-gray-600">
            <input
              type="checkbox"
              name="accept_terms"
              required
              disabled={isPending}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <span>
              Acepto los{' '}
              <Link href="/terminos" target="_blank" className="text-blue-600 hover:underline">Términos y Condiciones</Link>
              {' '}y el{' '}
              <Link href="/privacidad" target="_blank" className="text-blue-600 hover:underline">Aviso de Privacidad</Link>.
            </span>
          </label>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta gratis'
            )}
          </Button>
        </form>

        {/* OAuth */}
        <div className="mt-5">
          <SocialAuthButtons />
        </div>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
