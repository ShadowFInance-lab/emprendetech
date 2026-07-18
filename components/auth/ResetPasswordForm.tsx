'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Eye, EyeOff, ArrowLeft, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPasswordAction } from '@/lib/actions/auth'

/**
 * Nueva contraseña tras el enlace de recuperación. El usuario llega aquí ya con
 * sesión (el enlace pasó por /auth/callback). resetPasswordAction hace
 * updateUser({ password }) con esa sesión y redirige a /login?reset=true.
 */
export default function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const pw = formData.get('password') as string
    const confirm = formData.get('confirm_password') as string
    if (pw !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (pw.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    startTransition(async () => {
      const result = await resetPasswordAction(formData)
      // Si tiene éxito, resetPasswordAction hace redirect() a /login?reset=true.
      if (result && !result.success) setError(result.error ?? 'No se pudo cambiar la contraseña')
    })
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <KeyRound className="h-6 w-6 text-blue-600" /> Nueva contraseña
        </CardTitle>
        <CardDescription className="text-center">
          Escribe tu nueva contraseña para entrar a tu cuenta.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Input id="password" name="password" type={show ? 'text' : 'password'}
                placeholder="Mín. 6 caracteres" required minLength={6} disabled={isPending} className="pr-10" />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar contraseña</Label>
            <Input id="confirm_password" name="confirm_password" type={show ? 'text' : 'password'}
              placeholder="Repite la contraseña" required minLength={6} disabled={isPending} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
            ) : 'Cambiar contraseña'}
          </Button>

          <Link href="/login" className="block text-center">
            <Button variant="ghost" className="w-full text-sm" type="button">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al inicio de sesión
            </Button>
          </Link>
        </form>
      </CardContent>
    </Card>
  )
}
