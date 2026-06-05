'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Upload, ExternalLink, Palette, Store as StoreIcon, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { updateStoreAction, uploadStoreImage } from '@/lib/actions/store'
import { getPlanLimits } from '@/lib/constants/plans'
import { SUPPORTED_CURRENCIES } from '@/lib/utils/format'
import type { Store, Plan } from '@/lib/types'
import { Lock, Share2, MessageCircle } from 'lucide-react'
import { InstagramIcon, FacebookIcon, TikTokIcon } from '@/components/catalog/SocialIcons'
import ShareCatalog from './ShareCatalog'

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

interface Props { store: Store; plan?: Plan }

export default function StoreSettingsForm({ store, plan = 'free' }: Props) {
  const allowedSkins = getPlanLimits(plan).skins
  const isPaidPlan = plan !== 'free'
  const [isPending, startTransition] = useTransition()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const [logoUrl, setLogoUrl] = useState(store.logo_url ?? '')
  const [bannerUrl, setBannerUrl] = useState(store.banner_url ?? '')
  const [skin, setSkin] = useState(store.skin)
  const [fontFamily, setFontFamily] = useState(store.font_family)
  const [productOrder, setProductOrder] = useState(store.product_order)
  const [primaryColor, setPrimaryColor] = useState(store.primary_color)
  const [secondaryColor, setSecondaryColor] = useState(store.secondary_color)
  const [buttonColor, setButtonColor] = useState(store.button_color)
  const [currency, setCurrency] = useState(store.currency ?? 'MXN')

  // Redes: qué tarjetas están abiertas (las ya conectadas inician abiertas)
  const s = store as unknown as Record<string, string | null>
  const [openSocial, setOpenSocial] = useState<Record<string, boolean>>({
    whatsapp: !!s.whatsapp,
    instagram: !!s.instagram,
    facebook: !!s.facebook,
    tiktok: !!s.tiktok,
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('skin', skin)
    formData.set('font_family', fontFamily)
    formData.set('product_order', productOrder)
    formData.set('primary_color', primaryColor)
    formData.set('secondary_color', secondaryColor)
    formData.set('button_color', buttonColor)
    formData.set('currency', currency)

    startTransition(async () => {
      const result = await updateStoreAction(store.id, formData)
      if (result.success) {
        toast.success('Configuración guardada')
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  async function handleImageUpload(file: File, type: 'logo' | 'banner') {
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
    else setUploadingBanner(true)

    const fd = new FormData()
    fd.set('file', file)
    fd.set('type', type)
    const result = await uploadStoreImage(store.id, fd)
    if (result.success && result.url) {
      if (type === 'logo') setLogoUrl(result.url)
      else setBannerUrl(result.url)
      toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} actualizado`)
    } else {
      toast.error(result.error ?? 'Error al subir imagen')
    }

    if (type === 'logo') setUploadingLogo(false)
    else setUploadingBanner(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24 max-w-3xl">
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

      <Tabs defaultValue="general">
        <TabsList className="grid grid-cols-3 w-full h-auto gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
          <TabsTrigger value="general"
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 gap-1.5">
            <StoreIcon size={16} /> General
          </TabsTrigger>
          <TabsTrigger value="design"
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 gap-1.5">
            <Palette size={16} /> Diseño
          </TabsTrigger>
          <TabsTrigger value="social"
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 gap-1.5">
            <Share2 size={16} /> Redes
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB GENERAL ────────────────────────────────── */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Información de la tienda</CardTitle>
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

              <p className="text-xs text-gray-400">
                📱 El WhatsApp y tus redes se configuran en la pestaña <strong>Redes Sociales</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Imágenes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Logo y Banner</CardTitle>
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
        </TabsContent>

        {/* ─── TAB DISEÑO ─────────────────────────────────── */}
        <TabsContent value="design" className="space-y-4 mt-4">
          {/* Skin */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette size={16} /> Estilo del catálogo
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
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Paleta de colores</CardTitle>
              <p className="text-xs text-gray-400">
                {isPaidPlan
                  ? 'Elige una paleta o personaliza tus 3 tonos (principal, secundario y botones).'
                  : 'El plan Gratis incluye 5 paletas básicas. Personalizar tus propios 3 tonos es para planes de pago.'}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Grid de paletas (tarjetas grandes, sin números) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {COLOR_PALETTES.map((palette, idx) => {
                  const isActive = primaryColor === palette.p && buttonColor === palette.b
                  const isLocked = !isPaidPlan && idx >= 5
                  return (
                    <button
                      key={palette.name}
                      type="button"
                      disabled={isLocked}
                      onClick={() => { if (!isLocked) { setPrimaryColor(palette.p); setSecondaryColor(palette.s); setButtonColor(palette.b) } }}
                      className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                        isLocked ? 'opacity-50 cursor-not-allowed border-gray-100'
                          : isActive ? 'border-gray-900 shadow-lg scale-[1.02]'
                          : 'border-transparent hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      <div className="h-14 flex" style={{ background: `linear-gradient(135deg, ${palette.p}, ${palette.s})` }}>
                        <span className="self-end m-1.5 w-5 h-5 rounded-full ring-2 ring-white" style={{ backgroundColor: palette.b }} />
                      </div>
                      <div className="py-1.5 px-2 bg-white flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">{palette.name}</span>
                        {isActive && <Check size={13} className="text-green-600" />}
                        {isLocked && <Lock size={11} className="text-amber-500" />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {!isPaidPlan && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
                  <Lock size={13} /> Desbloquea las 10 paletas y elige tus propios 3 tonos con un plan de pago (Emprendedor, Negocio o VIP Plus).
                </div>
              )}

              {/* Colores personalizables (3 tonos) — solo planes de pago */}
              {isPaidPlan && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1.5">
                    <Palette size={14} /> Personaliza tus 3 tonos (principal, secundario y botones)
                  </summary>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {[
                      { label: 'Principal', value: primaryColor, onChange: setPrimaryColor },
                      { label: 'Secundario', value: secondaryColor, onChange: setSecondaryColor },
                      { label: 'Botones', value: buttonColor, onChange: setButtonColor },
                    ].map(({ label, value, onChange }) => (
                      <div key={label} className="text-center">
                        <label className="relative cursor-pointer inline-block">
                          <span className="block w-full h-12 rounded-xl shadow-sm ring-1 ring-black/5" style={{ backgroundColor: value }} />
                          <input type="color" value={value} onChange={e => onChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </label>
                        <p className="text-[11px] text-gray-500 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Preview GRANDE del catálogo */}
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Vista previa</Label>
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                  <div className="px-5 py-4 flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                    <span className="text-white font-bold text-lg">{store.name}</span>
                    <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full">WhatsApp</span>
                  </div>
                  <div className="p-5 bg-gray-50 grid grid-cols-2 gap-3">
                    {[1, 2].map(i => (
                      <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div className="h-20 bg-gradient-to-br from-gray-100 to-gray-200" />
                        <div className="p-2.5">
                          <p className="text-xs font-medium text-gray-800">Producto {i}</p>
                          <p className="text-base font-extrabold" style={{ color: primaryColor }}>$450.00</p>
                          <span className="block text-center text-white text-[11px] font-bold py-1.5 rounded-lg mt-1.5"
                            style={{ backgroundColor: buttonColor }}>
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
        </TabsContent>

        {/* ─── TAB REDES SOCIALES ──────────────────────────── */}
        <TabsContent value="social" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 size={16} /> Conecta tus redes
              </CardTitle>
              <p className="text-xs text-gray-400">Toca un botón para conectar. Aparecerán como accesos directos grandes en tu catálogo público.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'whatsapp', label: 'WhatsApp', cta: 'Conectar con WhatsApp', placeholder: '+52 55 1234 5678', type: 'tel',
                  help: 'Tu número con lada (los clientes te escribirán aquí).',
                  icon: <MessageCircle size={26} className="text-white" />, bg: 'bg-gradient-to-br from-green-400 to-green-600' },
                { name: 'instagram', label: 'Instagram', cta: 'Conectar con Instagram', placeholder: 'https://instagram.com/tu_tienda', type: 'url',
                  help: 'Pega el enlace de tu perfil de Instagram.',
                  icon: <InstagramIcon size={26} className="text-white" />, bg: 'bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600' },
                { name: 'facebook', label: 'Facebook', cta: 'Conectar con Facebook', placeholder: 'https://facebook.com/tu_tienda', type: 'url',
                  help: 'Pega el enlace de tu página de Facebook.',
                  icon: <FacebookIcon size={26} className="text-white" />, bg: 'bg-gradient-to-br from-blue-500 to-blue-700' },
                { name: 'tiktok', label: 'TikTok', cta: 'Conectar con TikTok', placeholder: 'https://tiktok.com/@tu_tienda', type: 'url',
                  help: 'Pega el enlace de tu perfil de TikTok.',
                  icon: <TikTokIcon size={24} className="text-white" />, bg: 'bg-gradient-to-br from-gray-800 to-black' },
              ].map(({ name, label, cta, placeholder, type, help, icon, bg }) => {
                const connected = !!s[name]
                const isOpen = openSocial[name]
                return (
                  <div key={name} className="rounded-2xl border border-gray-100 overflow-hidden">
                    {/* Botón grande de conectar */}
                    <button
                      type="button"
                      onClick={() => setOpenSocial(prev => ({ ...prev, [name]: !prev[name] }))}
                      className={`w-full flex items-center gap-3.5 ${bg} px-4 py-3.5 text-left transition-all hover:brightness-105`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-[15px] leading-tight">
                          {connected ? label : cta}
                        </p>
                        {connected ? (
                          <span className="inline-flex items-center gap-1 text-xs text-white/90 font-medium">
                            <Check size={12} /> Conectado · toca para editar
                          </span>
                        ) : (
                          <span className="text-xs text-white/80">Toca para agregar tu enlace</span>
                        )}
                      </div>
                    </button>

                    {/* Campo (montado siempre para que el form lo envíe; se oculta al colapsar) */}
                    <div className={isOpen ? 'p-3.5 bg-white space-y-1.5' : 'hidden'}>
                      <Input
                        id={name}
                        name={name}
                        type={type}
                        defaultValue={s[name] ?? ''}
                        placeholder={placeholder}
                        className="h-11"
                      />
                      <p className="text-[11px] text-gray-400">{help}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Barra de guardado fija */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 lg:px-6 py-3 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <a href={`/catalog/${store.slug}`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5">
            <ExternalLink size={14} /> <span className="hidden sm:inline">Ver mi catálogo</span>
          </a>
          <Button type="submit" disabled={isPending} className="min-w-40 h-11">
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Guardar cambios</>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
