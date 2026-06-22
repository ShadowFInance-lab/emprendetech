'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Upload, ExternalLink, Palette, Store as StoreIcon, Check, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { updateStoreAction, uploadStoreImage } from '@/lib/actions/store'
import { getPlanLimits } from '@/lib/constants/plans'
import { SUPPORTED_CURRENCIES } from '@/lib/utils/format'
import type { Store, Plan } from '@/lib/types'
import { Lock, Share2, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ShareCatalog from './ShareCatalog'
import NotificationSoundPicker from './NotificationSoundPicker'

// 10 paletas bonitas (las primeras 3 son "básicas" para el plan Gratis)
const COLOR_PALETTES = [
  { name: 'Océano', p: '#2563EB', s: '#1E40AF', b: '#16A34A' },
  { name: 'Bosque', p: '#059669', s: '#047857', b: '#2563EB' },
  { name: 'Carbón', p: '#1F2937', s: '#111827', b: '#F59E0B' },
  { name: 'Violeta', p: '#7C3AED', s: '#5B21B6', b: '#059669' },
  { name: 'Rosa', p: '#DB2777', s: '#9D174D', b: '#7C3AED' },
  { name: 'Coral', p: '#EA580C', s: '#C2410C', b: '#16A34A' },
  { name: 'Turquesa', p: '#0891B2', s: '#0E7490', b: '#F59E0B' },
  { name: 'Rubí', p: '#E11D48', s: '#9F1239', b: '#1F2937' },
  { name: 'Esmeralda', p: '#10B981', s: '#059669', b: '#1F2937' },
  { name: 'Real', p: '#4F46E5', s: '#3730A3', b: '#DB2777' },
]

const SKINS = [
  { id: 'moderna', label: 'Moderna', description: 'Gradientes, cards con sombra, bold' },
  { id: 'minimalista', label: 'Minimalista', description: 'Línea fina, limpio, tipografía elegante' },
]

const FONTS = [
  { id: 'inter', label: 'Inter (Moderna)' },
  { id: 'playfair', label: 'Playfair (Elegante)' },
  { id: 'poppins', label: 'Poppins (Amigable)' },
  { id: 'roboto', label: 'Roboto (Neutral)' },
  { id: 'montserrat', label: 'Montserrat (Bold)' },
]

const PRODUCT_ORDERS = [
  { id: 'featured', label: 'Destacados primero' },
  { id: 'new', label: 'Más recientes' },
  { id: 'best_sellers', label: 'Más vendidos' },
  { id: 'manual', label: 'Orden manual' },
]

function GoogleGlyph() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

interface Props { store: Store; plan?: Plan }

export default function StoreSettingsForm({ store, plan = 'free' }: Props) {
  const allowedSkins = getPlanLimits(plan).skins
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const [logoUrl, setLogoUrl] = useState(store.logo_url ?? '')
  const [bannerUrl, setBannerUrl] = useState(store.banner_url ?? '')
  const [backgroundUrl, setBackgroundUrl] = useState(store.background_url ?? '')
  const [skin, setSkin] = useState(store.skin)
  const [fontFamily, setFontFamily] = useState(store.font_family)
  const [productOrder, setProductOrder] = useState(store.product_order)
  const [primaryColor, setPrimaryColor] = useState(store.primary_color || '#2563eb')
  const [secondaryColor, setSecondaryColor] = useState(store.secondary_color || '#7c3aed')
  const [buttonColor, setButtonColor] = useState(store.button_color || '#2563eb')
  const sx = store as { panel_primary?: string | null; panel_secondary?: string | null; panel_button?: string | null; bg_fit?: string | null; online_sales?: boolean | null; online_reception_type?: string | null; online_reception_value?: string | null }
  const [panelPrimary, setPanelPrimary] = useState(sx.panel_primary || store.primary_color || '#1F2937')
  const [panelSecondary, setPanelSecondary] = useState(sx.panel_secondary || store.secondary_color || '#111827')
  const [panelButton, setPanelButton] = useState(sx.panel_button || store.button_color || '#4F46E5')
  const [bgFit, setBgFit] = useState(sx.bg_fit || 'cover')
  const [onlineSales, setOnlineSales] = useState(!!sx.online_sales)
  const [currency, setCurrency] = useState(store.currency ?? 'MXN')
  const [bgColor, setBgColor] = useState(store.bg_color ?? '#F9FAFB')
  const [buttonStyle, setButtonStyle] = useState(store.button_style ?? 'redondeado')
  const btnRadius = buttonStyle === 'cuadrado' ? '4px' : buttonStyle === 'pildora' ? '9999px' : '12px'

  // Redes: valores actuales + modal de conexión (sin campo de URL inline)
  const s = store as unknown as Record<string, string | null>
  const [socialVals, setSocialVals] = useState<Record<string, string>>({
    whatsapp: s.whatsapp ?? '',
    instagram: s.instagram ?? '',
    facebook: s.facebook ?? '',
    tiktok: s.tiktok ?? '',
  })
  const [socialModal, setSocialModal] = useState<string | null>(null)
  const [modalValue, setModalValue] = useState('')

  // Login real (Google / Facebook) vía Supabase Identity Linking
  const [identities, setIdentities] = useState<{ provider: string; identity_data?: Record<string, unknown> | null }[]>([])
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const loadIdentities = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getUserIdentities()
    setIdentities((data?.identities ?? []) as { provider: string }[])
  }, [])
  useEffect(() => { loadIdentities() }, [loadIdentities])

  async function toggleLogin(provider: string) {
    const supabase = createClient()
    const connected = identities.some(i => i.provider === provider)
    if (connected) {
      if (identities.length <= 1) { toast.error('No puedes desconectar tu único acceso. Conecta otro antes.'); return }
      if (!confirm(`¿Desconectar ${provider}?`)) return
      setSocialLoading(provider)
      const idn = identities.find(i => i.provider === provider)
      const { error } = await supabase.auth.unlinkIdentity(idn as never)
      setSocialLoading(null)
      if (error) { toast.error('No se pudo desconectar'); return }
      toast.success('Desconectado'); loadIdentities()
    } else {
      setSocialLoading(provider)
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as 'google' | 'facebook',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings` },
      })
      if (error) {
        const msg = /manual linking|not enabled|unsupported|provider/i.test(error.message)
          ? 'Para activar Google, habilítalo una vez en Supabase (Authentication → Providers).'
          : `No se pudo conectar: ${error.message}`
        toast(msg, {
          duration: 6000,
          icon: 'ℹ️',
          style: { background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' },
        })
        setSocialLoading(null)
      }
    }
  }

  function socialPrefix(name: string) {
    return ({ instagram: 'instagram.com/', facebook: 'facebook.com/', tiktok: 'tiktok.com/@', whatsapp: '' } as Record<string, string>)[name] ?? ''
  }
  function openSocialModal(name: string) {
    const prefix = socialPrefix(name)
    let v = socialVals[name] ?? ''
    if (prefix && v) v = v.replace(/^https?:\/\//, '').replace(prefix, '').replace(/^@/, '')
    setModalValue(v)
    setSocialModal(name)
  }
  function saveSocialModal() {
    if (socialModal) {
      const prefix = socialPrefix(socialModal)
      const raw = modalValue.trim().replace(/^@/, '')
      const value = !raw ? '' : (!prefix || /^https?:\/\//.test(raw)) ? raw : `https://${prefix}${raw}`
      setSocialVals(prev => ({ ...prev, [socialModal]: value }))
    }
    setSocialModal(null)
  }

  const SOCIALS: { name: string; type: 'handle' | 'login'; label: string; prefix: string; placeholder: string; field: string; icon: React.ReactNode; bg: string }[] = [
    { name: 'whatsapp', type: 'handle', label: 'WhatsApp', prefix: '', placeholder: '55 1234 5678', field: 'Tu número de WhatsApp (con lada)',
      icon: <MessageCircle size={24} className="text-white" />, bg: 'bg-gradient-to-br from-green-400 to-green-600' },
    { name: 'google', type: 'login', label: 'Google', prefix: '', placeholder: '', field: '',
      icon: <GoogleGlyph />, bg: 'bg-white border border-gray-200' },
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('skin', skin)
    formData.set('font_family', fontFamily)
    formData.set('product_order', productOrder)
    formData.set('primary_color', primaryColor)
    formData.set('secondary_color', secondaryColor)
    formData.set('button_color', buttonColor)
    formData.set('panel_primary', panelPrimary)
    formData.set('panel_secondary', panelSecondary)
    formData.set('panel_button', panelButton)
    formData.set('bg_fit', bgFit)
    formData.set('online_sales', String(onlineSales))
    formData.set('currency', currency)
    formData.set('bg_color', bgColor)
    formData.set('button_style', buttonStyle)

    startTransition(async () => {
      const result = await updateStoreAction(store.id, formData)
      if (result.success) {
        toast.success('Configuración guardada')
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  async function handleImageUpload(file: File, type: 'logo' | 'banner' | 'background') {
    // Validación clara ANTES de subir
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      toast.error('Formato no válido. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen pesa más de 5MB. Usa una más liviana.')
      return
    }

    if (type === 'logo') setUploadingLogo(true)
    else if (type === 'banner') setUploadingBanner(true)
    else setUploadingBg(true)

    const fd = new FormData()
    fd.set('file', file)
    fd.set('type', type)
    const result = await uploadStoreImage(store.id, fd)
    if (result.success && result.url) {
      if (type === 'logo') setLogoUrl(result.url)
      else if (type === 'banner') setBannerUrl(result.url)
      else setBackgroundUrl(result.url)
      toast.success('Imagen actualizada')
    } else {
      toast.error(result.error ?? 'Error al subir imagen')
    }

    if (type === 'logo') setUploadingLogo(false)
    else if (type === 'banner') setUploadingBanner(false)
    else setUploadingBg(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24 max-w-5xl">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-500/20">
          <StoreIcon size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Configuración</h1>
          <p className="text-gray-500 text-sm">Personaliza tu tienda, diseño y redes sociales</p>
        </div>
      </div>

      {/* Redes sociales — fila de tarjetas ARRIBA (como la referencia) */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Share2 size={15} className="text-white" />
          </span>
          <div>
            <p className="font-semibold text-gray-900 text-[15px] leading-tight">Redes sociales</p>
            <p className="text-xs text-gray-400">Tu número de WhatsApp y tu acceso con Google.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 max-w-xs">
          {SOCIALS.map(soc => {
            const isLogin = soc.type === 'login'
            const connected = isLogin ? identities.some(i => i.provider === soc.name) : !!socialVals[soc.name]
            const busy = socialLoading === soc.name
            return (
              <button
                key={soc.name}
                type="button"
                disabled={busy}
                onClick={() => (isLogin ? toggleLogin(soc.name) : openSocialModal(soc.name))}
                className="rounded-xl border border-gray-100 bg-white p-3 flex flex-col items-center gap-1.5 hover:shadow-sm hover:border-gray-200 transition-all disabled:opacity-60"
              >
                <div className={`w-11 h-11 rounded-2xl ${soc.bg} flex items-center justify-center`}>{soc.icon}</div>
                <p className="text-xs font-semibold text-gray-900">{soc.label}</p>
                <span className={`text-[11px] font-medium ${connected ? 'text-green-600' : 'text-blue-600'}`}>
                  {busy ? '…' : connected ? (isLogin ? '✓ Conectado' : '✓ Agregado') : (isLogin ? 'Conectar' : 'Agregar')}
                </span>
              </button>
            )
          })}
        </div>
        {/* Inputs ocultos: el formulario envía los @usuario al guardar */}
        {SOCIALS.filter(soc => soc.type === 'handle').map(soc => (
          <input key={soc.name} type="hidden" name={soc.name} value={socialVals[soc.name]} readOnly />
        ))}
        <p className="text-[11px] text-gray-400 mt-3">Google abre el inicio de sesión real de tu cuenta.</p>
      </div>

      {/* ─── VENDER ONLINE ──── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <ShoppingBag size={17} className="text-white" />
            </span>
            <div>
              <p className="font-semibold text-gray-900 text-[15px] leading-tight">Vender Online</p>
              <p className="text-xs text-gray-400">Agrega un botón <strong>&ldquo;Compra Online&rdquo;</strong> en tu catálogo con formulario de dirección, teléfono y método de pago.</p>
            </div>
          </div>
          <button type="button" onClick={() => setOnlineSales(v => !v)} aria-pressed={onlineSales}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${onlineSales ? 'bg-indigo-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${onlineSales ? 'translate-x-5' : ''}`} />
          </button>
        </div>

      </div>

      {/* ─── GENERAL: Información + Logo/Banner ──── */}
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 pt-1">
          <StoreIcon size={14} /> General
        </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <StoreIcon size={16} className="text-white" />
                </span>
                Información de la tienda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la tienda *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={store.name}
                  required
                  placeholder="Mi Tienda"
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Compartir catálogo: copiar link, compartir, ver */}
              <ShareCatalog slug={store.slug} storeName={store.name} />

              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline (frase)</Label>
                <Input
                  id="tagline"
                  name="tagline"
                  defaultValue={store.tagline ?? ''}
                  placeholder="Ej: Joyería artesanal en plata"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={store.description ?? ''}
                  placeholder="Describe tu negocio..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400">Se usa para mostrar los precios en tu catálogo y ventas.</p>
              </div>

              <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3.5 py-2.5">
                <span className="text-base">🔒</span>
                <p className="text-[11px] text-blue-700">
                  Para cancelar una venta se pedirá <strong>tu contraseña de dueño</strong> (anti-robo de empleados). No necesitas configurar nada.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Imágenes */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                  <Upload size={15} className="text-white" />
                </span>
                Logo y Banner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-dashed border-gray-200">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🏪</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">Logo de la tienda</p>
                  <p className="text-xs text-gray-400 mb-2">Cuadrado, mín 200×200px</p>
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file, 'logo')
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo
                      ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      : <Upload size={13} className="mr-1.5" />}
                    {uploadingLogo ? 'Subiendo...' : 'Cambiar logo'}
                  </Button>
                </div>
              </div>

              {/* Banner */}
              <div>
                <p className="font-medium text-sm text-gray-900 mb-1">Banner principal</p>
                <p className="text-xs text-gray-400 mb-2">Recomendado: 1200×400px</p>
                <div className="w-full h-32 rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 overflow-hidden mb-2">
                  {bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      Sin banner
                    </div>
                  )}
                </div>
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(file, 'banner')
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bannerRef.current?.click()}
                  disabled={uploadingBanner}
                >
                  {uploadingBanner
                    ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    : <Upload size={13} className="mr-1.5" />}
                  {uploadingBanner ? 'Subiendo...' : 'Cambiar banner'}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
      {/* ─── NOTIFICACIONES ─────────────────────────── */}
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 pt-3">
          🔔 Notificaciones
        </h2>
        <NotificationSoundPicker />

      {/* ─── DISEÑO ─────────────────────────────────── */}
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 pt-3">
          <Palette size={14} /> Diseño
        </h2>
        <div className="space-y-4">
          {/* Skin */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <Palette size={15} className="text-white" />
                </span>
                Estilo del catálogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {SKINS.map(s => {
                  const isLocked = !allowedSkins.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setSkin(s.id as 'moderna' | 'minimalista')}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        isLocked
                          ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                          : skin === s.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-900">{s.label}</span>
                        {isLocked ? (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-1">
                            <Lock size={9} /> Premium
                          </Badge>
                        ) : skin === s.id && (
                          <Badge className="bg-blue-600 text-[10px]">Activo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{s.description}</p>
                      {isLocked && (
                        <p className="text-[10px] text-amber-600 mt-1 font-medium">
                          Disponible en plan Emprendedor+
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Tipografía — selector tipo pill (sin dropdown) */}
              <div className="space-y-2">
                <Label>Tipografía</Label>
                <div className="flex flex-wrap gap-2">
                  {FONTS.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontFamily(f.id)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm transition-all ${
                        fontFamily === f.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-blue-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orden de productos — selector tipo pill */}
              <div className="space-y-2">
                <Label>Orden de productos en catálogo</Label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_ORDERS.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setProductOrder(o.id)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm transition-all ${
                        productOrder === o.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-blue-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colores — paletas bonitas (10), gating por plan */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Palette size={15} className="text-white" />
                </span>
                Personalización de colores y estilo
              </CardTitle>
              <p className="text-xs text-gray-400">
                Elige una paleta o personaliza tus 3 tonos, el fondo del catálogo, el estilo de los botones y la tipografía. Todo libre.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Colores principales (presets con nombre — siempre visible) */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Colores principales (presets)</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: 'Azul Mercanta', p: '#2563EB', s: '#1E40AF', b: '#16A34A' },
                    { name: 'Morado Mercanta', p: '#7C3AED', s: '#5B21B6', b: '#059669' },
                    { name: 'Verde Mercanta', p: '#059669', s: '#047857', b: '#2563EB' },
                  ].map(c => {
                    const active = primaryColor === c.p
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => { setPrimaryColor(c.p); setSecondaryColor(c.s); setButtonColor(c.b) }}
                        className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                          active ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900/10' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-full flex-shrink-0 ring-1 ring-black/10 shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${c.p}, ${c.s})` }} />
                        <span className="text-sm font-medium text-gray-700 leading-tight">{c.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Paletas grandes estilo moderno (como diseño ChatGPT) */}
              <Label className="block text-sm font-semibold mb-2">Paletas recomendadas</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {COLOR_PALETTES.map((palette) => {
                  const isActive = primaryColor === palette.p && buttonColor === palette.b
                  return (
                    <button
                      key={palette.name}
                      type="button"
                      onClick={() => { setPrimaryColor(palette.p); setSecondaryColor(palette.s); setButtonColor(palette.b) }}
                      className={`group relative flex flex-col rounded-3xl overflow-hidden border-2 transition-all shadow-sm ${isActive ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2 scale-[1.01]' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      <div className="h-40 p-4 flex flex-col justify-between" style={{ background: `linear-gradient(135deg, ${palette.p}, ${palette.s})` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-full ring-2 ring-white/60" style={{ backgroundColor: palette.p }} />
                            <div className="w-8 h-8 rounded-full ring-2 ring-white/60" style={{ backgroundColor: palette.s }} />
                          </div>
                          <div className="w-8 h-8 rounded-full ring-2 ring-white/60" style={{ backgroundColor: palette.b }} />
                        </div>
                        <div className="text-white text-lg font-bold drop-shadow-sm">{palette.name}</div>
                      </div>
                      <div className={`py-2.5 text-center text-sm font-semibold flex items-center justify-center gap-1 ${isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 group-hover:bg-gray-50'}`}>
                        {isActive ? <><Check size={14} /> Seleccionado</> : 'Usar esta paleta'}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Colores personalizados - previews grandes en vivo (estilo moderno) */}
              <p className="text-sm font-bold text-gray-900 mb-2">Colores personalizados</p>

              {/* Custom color pickers grandes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold mb-3">Colores catálogo (público)</div>
                  <div className="space-y-3">
                    {[
                      {label: 'Principal', val: primaryColor, setter: setPrimaryColor},
                      {label: 'Secundario', val: secondaryColor, setter: setSecondaryColor},
                      {label: 'Botones', val: buttonColor, setter: setButtonColor}
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl border-2 shadow-inner" style={{background: c.val}} />
                          <input type="color" value={c.val} onChange={e=>c.setter(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{c.label}</div>
                          <input value={c.val} onChange={e=>c.setter(e.target.value)} className="font-mono text-xs border rounded px-2 py-0.5 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold mb-3">Colores panel admin</div>
                  <div className="space-y-3">
                    {[
                      {label: 'Principal', val: panelPrimary, setter: setPanelPrimary},
                      {label: 'Secundario', val: panelSecondary, setter: setPanelSecondary},
                      {label: 'Botones', val: panelButton, setter: setPanelButton}
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl border-2 shadow-inner" style={{background: c.val}} />
                          <input type="color" value={c.val} onChange={e=>c.setter(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{c.label}</div>
                          <input value={c.val} onChange={e=>c.setter(e.target.value)} className="font-mono text-xs border rounded px-2 py-0.5 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Previews en vivo grandes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">PREVIEW CATÁLOGO EN VIVO</div>
                  <div className="rounded-2xl border-2 border-gray-300 overflow-hidden shadow-sm">
                    <div className="px-4 py-4 text-white text-base font-bold flex items-center justify-between" style={{background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`}}>
                      <span>{store.name || 'Mi Tienda'}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-white/20 rounded-full">Catálogo</span>
                    </div>
                    <div className="p-5" style={{backgroundColor: bgColor}}>
                      <div className="grid grid-cols-2 gap-4">
                        {[1,2].map(n => (
                          <div key={n} className="bg-white rounded-2xl border overflow-hidden text-sm shadow-sm">
                            <div className="h-16 bg-gradient-to-br from-gray-100 to-gray-200" />
                            <div className="p-3">
                              <div className="font-semibold text-gray-800">Producto Ejemplo {n}</div>
                              <div className="text-lg font-extrabold" style={{color: primaryColor}}>$450.00</div>
                              <div className="mt-3 text-center text-white text-xs py-1.5 rounded-xl font-bold" style={{backgroundColor: buttonColor}}>Agregar al carrito</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">PREVIEW PANEL ADMIN EN VIVO</div>
                  <div className="rounded-2xl border-2 border-gray-300 overflow-hidden shadow-sm flex text-sm" style={{minHeight: '180px'}}>
                    <div className="w-28 p-3 text-white" style={{backgroundColor: panelPrimary}}>
                      <div className="text-xs font-bold mb-2 opacity-80">MENÚ</div>
                      <div className="text-xs py-1 px-2 bg-white/20 rounded mb-1">Dashboard</div>
                      <div className="text-xs py-1 px-2" style={{backgroundColor: panelButton}}>Ventas</div>
                      <div className="text-xs py-1 px-2 mt-1">Empleados</div>
                    </div>
                    <div className="flex-1 p-3 bg-gray-100">
                      <div className="h-6 rounded mb-2" style={{background: `linear-gradient(90deg, ${panelPrimary}, ${panelSecondary})`}} />
                      <div className="bg-white rounded-lg p-3 text-sm shadow">
                        <div className="font-semibold mb-1">Resumen del día</div>
                        <button className="mt-1 w-full py-1.5 text-white rounded-lg text-xs font-bold" style={{backgroundColor: panelButton}}>Ver detalles</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fondo del catálogo + estilo de botones — libres para todos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <Label className="text-xs text-gray-500">Fondo del catálogo</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <label className="relative cursor-pointer inline-block">
                        <span className="block w-14 h-10 rounded-xl ring-1 ring-black/10 shadow" style={{ backgroundColor: bgColor }} />
                        <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </label>
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{bgColor}</span>
                    </div>
                    {/* Imagen de fondo opcional (se ve detrás del catálogo) */}
                    <div className="mt-2 flex items-center gap-2">
                      {backgroundUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={backgroundUrl} alt="Fondo" className="w-12 h-9 rounded-lg object-cover ring-1 ring-black/10" />
                      ) : (
                        <span className="w-12 h-9 rounded-lg bg-gray-100 ring-1 ring-black/10" />
                      )}
                      <label className="text-xs text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-1">
                        {uploadingBg ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {backgroundUrl ? 'Cambiar imagen' : 'Subir imagen'}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'background') }} />
                      </label>
                      {backgroundUrl && (
                        <button type="button" onClick={() => setBackgroundUrl('')} className="text-[11px] text-gray-400 hover:text-red-500">Quitar</button>
                      )}
                    </div>
                    <input type="hidden" name="background_url" value={backgroundUrl} />
                    {backgroundUrl && (
                      <div className="mt-2">
                        <Label className="text-[11px] text-gray-400">Ajuste de la imagen</Label>
                        <div className="flex gap-1.5 mt-1">
                          {[{ v: 'cover', l: 'Cubrir' }, { v: 'contain', l: 'Contener' }, { v: 'center', l: 'Centrar' }].map(o => (
                            <button key={o.v} type="button" onClick={() => setBgFit(o.v)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${bgFit === o.v ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                              {o.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Estilo de botones</Label>
                    <div className="flex gap-2 mt-1.5">
                      {[{ id: 'cuadrado', label: 'Cuadrado' }, { id: 'redondeado', label: 'Redondeado' }, { id: 'pildora', label: 'Píldora' }].map(o => (
                        <button key={o.id} type="button" onClick={() => setButtonStyle(o.id)}
                          className={`px-3 py-1.5 text-xs border-2 transition-all ${
                            buttonStyle === o.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-blue-200'
                          }`}
                          style={{ borderRadius: o.id === 'cuadrado' ? '4px' : o.id === 'pildora' ? '9999px' : '12px' }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              {/* Preview GRANDE del catálogo — con etiquetas claras */}
              <div>
                <Label className="text-sm font-bold text-gray-700 mb-2 block">🛍️ Vista previa del Catálogo Público (con tus colores)</Label>
                <div className="rounded-2xl overflow-hidden border-2 border-gray-200 shadow-md">
                  <div className="px-5 py-4 flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                    <span className="text-white font-bold text-lg">{store.name}</span>
                    <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full">WhatsApp</span>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-3" style={{
                    backgroundColor: bgColor,
                    ...(backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
                  }}>
                    {[1, 2].map(i => (
                      <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div className="h-20 bg-gradient-to-br from-gray-100 to-gray-200" />
                        <div className="p-2.5">
                          <p className="text-xs font-medium text-gray-800">Producto {i}</p>
                          <p className="text-base font-extrabold" style={{ color: primaryColor }}>$450.00</p>
                          <span className="block text-center text-white text-[11px] font-bold py-1.5 mt-1.5"
                            style={{ backgroundColor: buttonColor, borderRadius: btnRadius }}>
                            Pedir
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                  Esta vista previa es solo visual — nunca cobra ni limita.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Modal de conexión de red social (sin campo de URL inline) */}
      {socialModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSocialModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {(() => {
              const soc = SOCIALS.find(x => x.name === socialModal)
              if (!soc) return null
              return (
                <>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${soc.bg} flex items-center justify-center`}>{soc.icon}</div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">Tu {soc.label}</h3>
                      <p className="text-xs text-gray-400">Solo nombre de usuario — sin URL completa.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="social-modal-input">{soc.field}</Label>
                    <div className="flex items-center rounded-xl border border-input overflow-hidden h-11">
                      {soc.prefix && (
                        <span className="px-2.5 h-full flex items-center text-xs text-gray-500 bg-gray-50 border-r border-input whitespace-nowrap">
                          {soc.prefix}
                        </span>
                      )}
                      <input
                        id="social-modal-input"
                        autoFocus
                        value={modalValue}
                        onChange={e => setModalValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveSocialModal() } }}
                        placeholder={soc.placeholder}
                        className="flex-1 h-full px-3 text-sm focus:outline-none bg-transparent"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400">Solo tu usuario, sin la URL completa.</p>
                  </div>
                  <div className="flex justify-between items-center">
                    {modalValue ? (
                      <button type="button" onClick={() => setModalValue('')}
                        className="text-xs text-gray-400 hover:text-gray-600">Quitar</button>
                    ) : <span />}
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => setSocialModal(null)}>Cancelar</Button>
                      <Button type="button" onClick={saveSocialModal}>Guardar</Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">Se guardará en tu tienda al pulsar &quot;Guardar cambios&quot; abajo.</p>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Barra de guardado fija */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 lg:px-6 py-3 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <a href={`/catalog/${store.slug}`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5">
            <ExternalLink size={14} /> <span className="hidden sm:inline">Ver mi catálogo</span>
          </a>
          <Button type="submit" disabled={isPending}
            className={`min-w-44 h-11 transition-all hover:scale-[1.02] active:scale-95 ${saved ? 'bg-green-600 hover:bg-green-600' : ''}`}>
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
            ) : saved ? (
              <><Check className="mr-2 h-4 w-4" /> ¡Cambios guardados!</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Guardar cambios</>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
