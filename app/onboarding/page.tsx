'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Store, Globe, Phone, ArrowRight, Check, Upload, X,
  Sparkles, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createStoreAction, checkSlugAvailability, uploadStoreImage } from '@/lib/actions/store'
import { generateSlug } from '@/lib/utils/slug'

const STEPS = [
  { id: 1, title: 'Tu negocio', icon: Store },
  { id: 2, title: 'Tu dirección web', icon: Globe },
  { id: 3, title: 'Contacto', icon: Phone },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Slug availability
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  function handleName(value: string) {
    setName(value)
    if (!slugTouched) setSlug(generateSlug(value))
  }

  // Verificar disponibilidad del slug (debounce)
  useEffect(() => {
    if (slug.length < 3) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    const t = setTimeout(async () => {
      const { available } = await checkSlugAvailability(slug)
      setSlugStatus(available ? 'available' : 'taken')
    }, 450)
    return () => clearTimeout(t)
  }, [slug])

  function handleLogoSelect(file: File) {
    if (!file.type.startsWith('image/')) { setError('El logo debe ser una imagen'); return }
    if (file.size > 5 * 1024 * 1024) { setError('El logo no puede superar 5MB'); return }
    setError(null)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleSubmit() {
    setError(null)
    if (slugStatus === 'taken') { setError('Esa dirección ya está en uso'); setStep(2); return }

    const data = new FormData()
    data.set('name', name)
    data.set('slug', slug)
    data.set('whatsapp', whatsapp)

    startTransition(async () => {
      const result = await createStoreAction(data)
      if (!result.success) {
        setError(result.error ?? 'Error al crear la tienda')
        if (result.error?.includes('uso')) setStep(2)
        return
      }
      // Subir logo si se eligió
      const storeId = (result.data as { storeId?: string })?.storeId
      if (storeId && logoFile) {
        const fd = new FormData()
        fd.set('file', logoFile)
        fd.set('type', 'logo')
        await uploadStoreImage(storeId, fd)
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  const canContinueStep1 = name.trim().length >= 2
  const canContinueStep2 = slug.length >= 3 && slugStatus !== 'taken'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="text-white text-2xl font-bold tracking-tight">EmprendeTech</span>
          </div>
          <h1 className="text-white text-3xl font-bold">Configura tu tienda</h1>
          <p className="text-blue-200/80 mt-2">3 pasos rápidos y tu catálogo estará listo</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div className={`
                  w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${step > s.id ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : step === s.id ? 'bg-white text-blue-700 shadow-lg scale-110'
                    : 'bg-white/10 text-white/40'}
                `}>
                  {step > s.id ? <Check size={20} /> : <s.icon size={20} />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step >= s.id ? 'text-white' : 'text-white/40'}`}>
                  {s.title}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-16 sm:w-24 h-1 mx-2 rounded-full transition-all duration-500 mb-6 ${step > s.id ? 'bg-green-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
          {/* ───────── PASO 1 ───────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">¿Cómo se llama tu negocio?</h2>
                <p className="text-gray-500 text-sm mt-1">Aparecerá en tu catálogo y en cada producto</p>
              </div>

              {/* Logo uploader */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/50 flex items-center justify-center overflow-hidden transition-all group flex-shrink-0"
                >
                  {logoPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload size={20} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-blue-500">
                      <Upload size={22} />
                      <span className="text-[10px] font-medium">Logo</span>
                    </div>
                  )}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoSelect(f) }}
                />
                <div className="flex-1">
                  <Label htmlFor="name" className="text-gray-700">Nombre del negocio *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => handleName(e.target.value)}
                    placeholder="Ej: Boutique Luna, TecnoFix, Dulces Mary"
                    className="mt-1.5 h-11"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && canContinueStep1 && setStep(2)}
                  />
                  {logoFile ? (
                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Logo cargado: {logoFile.name.slice(0, 24)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1.5">Sube tu logo (opcional, lo puedes cambiar después)</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <Button className="w-full h-12 text-base" onClick={() => setStep(2)} disabled={!canContinueStep1}>
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ───────── PASO 2 ───────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Tu dirección web</h2>
                <p className="text-gray-500 text-sm mt-1">Es el enlace que compartirás con tus clientes</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-gray-700">Dirección de tu catálogo *</Label>
                <div className="flex items-stretch rounded-xl border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <span className="bg-gray-100 px-3 flex items-center text-sm text-gray-500 whitespace-nowrap border-r border-gray-200">
                    emprendetech.com/catalog/
                  </span>
                  <input
                    id="slug"
                    value={slug}
                    onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                    placeholder="mi-tienda"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none min-w-0"
                    autoFocus
                  />
                  <span className="px-3 flex items-center">
                    {slugStatus === 'checking' && <Loader2 size={16} className="animate-spin text-gray-400" />}
                    {slugStatus === 'available' && <CheckCircle2 size={16} className="text-green-500" />}
                    {slugStatus === 'taken' && <X size={16} className="text-red-500" />}
                  </span>
                </div>
                {slugStatus === 'available' && <p className="text-xs text-green-600">✓ ¡Disponible! Esta dirección es tuya.</p>}
                {slugStatus === 'taken' && <p className="text-xs text-red-500">Esa dirección ya está en uso. Prueba otra.</p>}
                {slugStatus === 'idle' && <p className="text-xs text-gray-400">Solo letras, números y guiones.</p>}
              </div>

              {/* Preview */}
              {slug && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1">
                    <Globe size={12} /> Tu catálogo estará en:
                  </p>
                  <p className="text-sm text-blue-900 font-mono break-all font-semibold">
                    emprendetech.com/catalog/{slug}
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12">Atrás</Button>
                <Button className="flex-1 h-12" onClick={() => { setError(null); setStep(3) }} disabled={!canContinueStep2}>
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ───────── PASO 3 ───────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">¿Cómo te contactan?</h2>
                <p className="text-gray-500 text-sm mt-1">Tus clientes pedirán directo por WhatsApp</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-gray-700">WhatsApp (opcional)</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  type="tel"
                  className="h-11"
                  autoFocus
                />
                <p className="text-xs text-gray-400">Incluye el código de país. Lo puedes agregar después.</p>
              </div>

              {/* Resumen */}
              <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                <p className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
                  <Sparkles size={14} className="text-blue-500" /> Resumen
                </p>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {name.charAt(0).toUpperCase() || '🏪'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{name}</p>
                    <p className="text-xs text-gray-500 truncate">emprendetech.com/catalog/{slug}</p>
                    {whatsapp && <p className="text-xs text-gray-500">📱 {whatsapp}</p>}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12">Atrás</Button>
                <Button
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-base"
                  onClick={handleSubmit}
                  disabled={isPending}
                >
                  {isPending
                    ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creando...</>
                    : <><Check className="mr-2 h-5 w-5" /> ¡Crear mi tienda!</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
