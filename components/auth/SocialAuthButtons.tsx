'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Botones de login con Google y Facebook (Supabase OAuth).
 * Requiere que los proveedores estén habilitados en:
 * Supabase → Authentication → Providers → Google / Facebook.
 */
export default function SocialAuthButtons() {
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null)

  async function signInWith(provider: 'google' | 'facebook') {
    const label = provider === 'google' ? 'Google' : 'Facebook'
    setLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      const notEnabled = /not enabled|unsupported|provider/i.test(error.message)
      toast.error(
        notEnabled
          ? `Activa ${label} en Supabase → Authentication → Providers para usar este botón.`
          : `No se pudo conectar con ${label}. Intenta de nuevo.`,
        { duration: 6000 }
      )
      setLoading(null)
    }
    // Si no hay error, el navegador redirige al proveedor (login real).
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">o continúa con</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Google */}
        <button
          type="button"
          onClick={() => signInWith('google')}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700 disabled:opacity-60"
        >
          {loading === 'google' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Google
        </button>

        {/* Facebook */}
        <button
          type="button"
          onClick={() => signInWith('facebook')}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700 disabled:opacity-60"
        >
          {loading === 'facebook' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z" />
            </svg>
          )}
          Facebook
        </button>
      </div>
    </div>
  )
}
