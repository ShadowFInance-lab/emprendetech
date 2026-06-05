import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Iniciar Sesión' }

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; reset?: string; error?: string }
}) {
  return (
    <LoginForm
      redirectTo={searchParams.redirect}
      showResetSuccess={searchParams.reset === 'true'}
      oauthError={searchParams.error === 'oauth'}
    />
  )
}
