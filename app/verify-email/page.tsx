import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  if (searchParams.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white/95">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="text-6xl">❌</div>
            <h2 className="text-2xl font-bold">Enlace inválido</h2>
            <p className="text-gray-600">
              El enlace de verificación expiró o es inválido.
            </p>
            <Link href="/register">
              <Button className="w-full">Registrarse de nuevo</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-white/95">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">¡Email verificado!</h2>
          <p className="text-gray-600">
            Tu cuenta está activa. Ya puedes iniciar sesión y comenzar a usar EmprendeTech.
          </p>
          <Link href="/login">
            <Button className="w-full">Iniciar sesión</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
