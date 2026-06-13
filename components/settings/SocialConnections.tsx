'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, Link2, Unlink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InstagramIcon, FacebookIcon, TikTokIcon } from '@/components/catalog/SocialIcons'
import { getSocialConnections, disconnectSocialAction } from '@/lib/actions/social'

type Provider = 'google' | 'facebook' | 'instagram' | 'tiktok'

interface Identity {
  identity_id?: string
  id: string
  user_id: string
  provider: string
  identity_data?: Record<string, unknown> | null
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

const NETWORKS: {
  id: Provider
  label: string
  icon: React.ReactNode
  note: string
  color: string
}[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon />, note: 'Inicia sesión con tu cuenta de Google', color: 'hover:border-[#4285F4]' },
  { id: 'facebook', label: 'Facebook', icon: <FacebookIcon className="text-[#1877F2]" />, note: 'Inicia sesión con Facebook', color: 'hover:border-[#1877F2]' },
  { id: 'instagram', label: 'Instagram Business', icon: <InstagramIcon className="text-[#E1306C]" />, note: 'Se conecta vía Facebook (cuenta de empresa)', color: 'hover:border-[#E1306C]' },
  { id: 'tiktok', label: 'TikTok Business', icon: <TikTokIcon />, note: 'Inicia sesión con TikTok (Login Kit)', color: 'hover:border-gray-900' },
]

export default function SocialConnections() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [tiktok, setTiktok] = useState<string | null | undefined>(undefined) // undefined=cargando
  const [loading, setLoading] = useState<Provider | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const [{ data }, conns] = await Promise.all([
      supabase.auth.getUserIdentities(),
      getSocialConnections(),
    ])
    setIdentities((data?.identities ?? []) as Identity[])
    const tk = conns.find(c => c.provider === 'tiktok')
    setTiktok(tk ? (tk.account_name ?? 'Cuenta TikTok') : null)
    setReady(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Avisos al volver del OAuth de TikTok (?social=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('social')
    if (!s) return
    if (s === 'tiktok_ok') toast.success('TikTok conectado')
    else if (s === 'tiktok_cfg') toast.error('Falta configurar TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en Vercel.', { duration: 7000 })
    else if (s === 'tiktok_err') toast.error('No se pudo conectar TikTok. Intenta de nuevo.')
    // limpiar el parámetro de la URL
    params.delete('social')
    const qs = params.toString()
    window.history.replaceState({}, '', `/settings${qs ? `?${qs}` : ''}`)
  }, [])

  function fbIdentity() { return identities.find(i => i.provider === 'facebook') }
  function identityOf(provider: Provider) {
    if (provider === 'instagram') return fbIdentity()
    return identities.find(i => i.provider === provider)
  }
  function isConnected(provider: Provider) {
    if (provider === 'tiktok') return !!tiktok
    return !!identityOf(provider)
  }
  function accountLabel(provider: Provider) {
    if (provider === 'tiktok') return tiktok ?? ''
    const idn = identityOf(provider)
    const d = idn?.identity_data ?? {}
    const base = (d.email as string) || (d.name as string) || (d.full_name as string) || 'Cuenta conectada'
    return provider === 'instagram' ? `${base} (vía Facebook)` : base
  }

  async function connect(provider: Provider) {
    setLoading(provider)

    // TikTok: OAuth propio (ruta /api)
    if (provider === 'tiktok') {
      window.location.href = '/api/oauth/tiktok/start'
      return
    }

    const supabase = createClient()
    // Instagram Business se autentica a través de Facebook con permisos de Instagram
    const linkProvider = provider === 'instagram' ? 'facebook' : provider
    const scopes = provider === 'instagram' ? 'public_profile,instagram_basic,pages_show_list' : undefined

    const { error } = await supabase.auth.linkIdentity({
      provider: linkProvider as 'google' | 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings`, ...(scopes ? { scopes } : {}) },
    })
    if (error) {
      const msg = /manual linking/i.test(error.message)
        ? 'Activa "Manual Linking" en Supabase → Authentication → Settings, y habilita el proveedor.'
        : /not enabled|unsupported|provider/i.test(error.message)
          ? `Primero habilita ${linkProvider} en Supabase → Authentication → Providers (ver INTEGRACIONES.md).`
          : `No se pudo conectar: ${error.message}`
      toast.error(msg, { duration: 7000 })
      setLoading(null)
    }
    // Si no hay error: el navegador redirige al login oficial y vuelve a /settings.
  }

  async function disconnect(provider: Provider) {
    setLoading(provider)

    if (provider === 'tiktok') {
      if (!confirm('¿Desconectar TikTok?')) { setLoading(null); return }
      const res = await disconnectSocialAction('tiktok')
      setLoading(null)
      if (res.success) { toast.success('TikTok desconectado'); refresh() }
      else toast.error(res.error ?? 'Error')
      return
    }

    const idn = identityOf(provider)
    if (!idn) { setLoading(null); return }
    if (identities.length <= 1) {
      toast.error('No puedes desconectar tu único método de acceso. Conecta otro antes.')
      setLoading(null); return
    }
    const extra = provider === 'instagram' ? ' Esto también desconecta Facebook (comparten el acceso).' : ''
    if (!confirm(`¿Desconectar ${provider}?${extra}`)) { setLoading(null); return }

    const supabase = createClient()
    const { error } = await supabase.auth.unlinkIdentity(idn as never)
    setLoading(null)
    if (error) { toast.error(`No se pudo desconectar: ${error.message}`); return }
    toast.success('Desconectado')
    refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Conectar redes sociales</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Inicia sesión con cada red — sin pegar enlaces. Al pulsar <strong>Conectar</strong> se abre el login oficial.
        </p>
      </div>

      <div className="space-y-2.5">
        {NETWORKS.map(net => {
          const connected = isConnected(net.id)
          const isLoading = loading === net.id
          const disabled = isLoading || !ready
          return (
            <div key={net.id}
              className={`flex items-center gap-3 border border-gray-200 rounded-xl p-3 transition-colors ${net.color}`}>
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                {net.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                  {net.label}
                  {connected && <Check size={14} className="text-green-600" />}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {connected ? accountLabel(net.id) : net.note}
                </p>
              </div>

              {connected ? (
                <button onClick={() => disconnect(net.id)} disabled={disabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50">
                  {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />} Desconectar
                </button>
              ) : (
                <button onClick={() => connect(net.id)} disabled={disabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Conectar
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        Google y Facebook requieren pegar credenciales en <span className="font-medium">Supabase → Authentication → Providers</span> + activar
        <span className="font-medium"> Manual Linking</span>. Instagram se conecta vía Facebook (con permisos de Instagram). TikTok usa
        <span className="font-medium"> TIKTOK_CLIENT_KEY/SECRET</span> en Vercel. Pasos exactos en <code className="bg-gray-100 px-1 rounded">INTEGRACIONES.md</code>.
      </p>
    </div>
  )
}
