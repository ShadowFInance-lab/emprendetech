'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { loginAction } from '@/lib/actions/auth'
import SocialAuthButtons from './SocialAuthButtons'

interface LoginFormProps {
  redirectTo?: string
  showResetSuccess?: boolean // muestra toast si true
  oauthError?: boolean // viene de /login?error=oauth
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function LoginForm({ redirectTo, showResetSuccess, oauthError }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(
    oauthError
      ? 'No se pudo iniciar sesión con Google/Facebook (puede que aún no estén activados). Entra con tu correo y contraseña.'
      : null
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    if (redirectTo) formData.set('redirect', redirectTo)

    startTransition(async () => {
      const result = await loginAction(formData)
      if (result && !result.success) {
        setError(result.error ?? 'Error al iniciar sesión')
      }
      // Si success, loginAction hace redirect()
    })
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Iniciar Sesión
        </CardTitle>
        <CardDescription className="text-center">
          Ingresa a tu panel de administración
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@correo.com"
              required
              autoComplete="email"
              disabled={isPending}
            />
          </div>

          {/* Contraseña */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isPending}
                className="pr-10"
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

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
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
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-blue-600 font-medium hover:underline">
            Regístrate gratis
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
