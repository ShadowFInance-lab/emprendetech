'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, Link2, Unlink, X, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InstagramIcon, FacebookIcon, TikTokIcon } from '@/components/catalog/SocialIcons'

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
  native: boolean // ¿tiene provider nativo en Supabase Auth?
  color: string
}[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon />, native: true, color: 'hover:border-[#4285F4]' },
  { id: 'facebook', label: 'Facebook', icon: <FacebookIcon className="text-[#1877F2]" />, native: true, color: 'hover:border-[#1877F2]' },
  { id: 'instagram', label: 'Instagram Business', icon: <InstagramIcon className="text-[#E1306C]" />, native: false, color: 'hover:border-[#E1306C]' },
  { id: 'tiktok', label: 'TikTok Business', icon: <TikTokIcon />, native: false, color: 'hover:border-gray-900' },
]

export default function SocialConnections() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState<Provider | null>(null)
  const [ready, setReady] = useState(false)
  const [info, setInfo] = useState<Provider | null>(null)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getUserIdentities()
    setIdentities((data?.identities ?? []) as Identity[])
    setReady(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function findIdentity(provider: Provider) {
    return identities.find(i => i.provider === provider)
  }

  function accountLabel(idn: Identity) {
    const d = idn.identity_data ?? {}
    return (d.email as string) || (d.name as string) || (d.full_name as string) || (d.user_name as string) || 'Cuenta conectada'
  }

  async function connect(provider: Provider) {
    setLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.linkIdentity({
      provider: provider as 'google' | 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings` },
    })
    if (error) {
      const msg = /manual linking/i.test(error.message)
        ? 'Activa "Manual Linking" en Supabase → Authentication → Settings, y habilita el proveedor.'
        : /not enabled|unsupported|provider/i.test(error.message)
          ? `Primero habilita ${provider} en Supabase → Authentication → Providers (ver guía).`
          : `No se pudo conectar: ${error.message}`
      toast.error(msg, { duration: 7000 })
      setLoading(null)
    }
    // Si no hay error: el navegador redirige al OAuth oficial y vuelve a /settings.
  }

  async function disconnect(provider: Provider) {
    const idn = findIdentity(provider)
    if (!idn) return
    if (identities.length <= 1) {
      toast.error('No puedes desconectar tu único método de acceso. Agrega otro antes de desconectar este.')
      return
    }
    if (!confirm(`¿Desconectar ${provider}?`)) return
    setLoading(provider)
    const supabase = createClient()
    // unlinkIdentity espera el objeto UserIdentity completo
    const { error } = await supabase.auth.unlinkIdentity(idn as never)
    setLoading(null)
    if (error) { toast.error(`No se pudo desconectar: ${error.message}`); return }
    toast.success(`${provider} desconectado`)
    refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Conectar redes sociales</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Vincula tus cuentas con un clic — sin pegar enlaces. Google y Facebook se conectan al instante una vez habilitados.
        </p>
      </div>

      <div className="space-y-2.5">
        {NETWORKS.map(net => {
          const idn = findIdentity(net.id)
          const isConnected = !!idn
          const isLoading = loading === net.id
          return (
            <div key={net.id}
              className={`flex items-center gap-3 border border-gray-200 rounded-xl p-3 transition-colors ${net.color}`}>
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                {net.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                  {net.label}
                  {isConnected && <Check size={14} className="text-green-600" />}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {isConnected ? accountLabel(idn!)
                    : net.native ? 'No conectado'
                    : 'Requiere app verificada de Meta / TikTok'}
                </p>
              </div>

              {net.native ? (
                isConnected ? (
                  <button onClick={() => disconnect(net.id)} disabled={isLoading || !ready}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50">
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />} Desconectar
                  </button>
                ) : (
                  <button onClick={() => connect(net.id)} disabled={isLoading || !ready}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Conectar
                  </button>
                )
              ) : (
                <button onClick={() => setInfo(net.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                  <ExternalLink size={13} /> Cómo conectar
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        Google/Facebook: actívalos en <span className="font-medium">Supabase → Authentication → Providers</span> y habilita
        <span className="font-medium"> Manual Linking</span>. Pasos exactos en <code className="bg-gray-100 px-1 rounded">INTEGRACIONES.md</code>.
      </p>

      {info && <SetupModal provider={info} onClose={() => setInfo(null)} />}
    </div>
  )
}

function SetupModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  const isIG = provider === 'instagram'
  const title = isIG ? 'Conectar Instagram Business' : 'Conectar TikTok Business'
  const steps = isIG
    ? [
        'Entra a developers.facebook.com → "Mis apps" → "Crear app" → tipo "Empresa".',
        'Agrega los productos "Inicio de sesión con Facebook" e "Instagram Graph API".',
        'Conecta tu cuenta de Instagram Business a una Página de Facebook (Instagram debe ser cuenta de Empresa/Creador).',
        'Permisos: instagram_basic, pages_show_list, business_management (requieren Revisión de la app por Meta).',
        'En "Inicio de sesión con Facebook → Configuración" registra el callback de Supabase.',
        'Copia App ID y App Secret y pégalos en Supabase → Authentication → Providers → Facebook.',
      ]
    : [
        'Entra a developers.tiktok.com → "Manage apps" → "Connect an app".',
        'Agrega el producto "Login Kit" (y "Content Posting API" si publicarás).',
        'Tipo de cuenta: TikTok for Business / Developer verificado.',
        'Permisos (scopes): user.info.basic, video.list (según lo que necesites).',
        'Registra el Redirect URI de callback y copia Client Key + Client Secret.',
        'TikTok no es un proveedor nativo de Supabase: requiere un flujo OAuth personalizado (ruta /api propia). Las credenciales quedan listas con estos pasos.',
      ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500">
          Estas redes exigen una app verificada por {isIG ? 'Meta' : 'TikTok'} (revisión de negocio). Estos son los pasos exactos:
        </p>
        <ol className="space-y-2 text-sm text-gray-700">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Callback de Supabase a registrar:<br />
          <code className="break-all">https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback</code>
        </div>
        <button onClick={onClose} className="w-full h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
          Entendido
        </button>
      </div>
    </div>
  )
}
