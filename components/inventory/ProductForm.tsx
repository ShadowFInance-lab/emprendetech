'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Save, Trash2, ScanLine, ImagePlus, Tag, Package, Sparkles, Box, Layers, Plus, X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import ImageUploader from './ImageUploader'
import BarcodeScanner from './BarcodeScanner'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  uploadProductImageAction,
} from '@/lib/actions/products'
import type { Product, Category, ProductVariantGroup } from '@/lib/types'
import { SUPPORTED_CURRENCIES } from '@/lib/utils/format'

interface ProductFormProps {
  product?: Product
  categories: Category[]
  storeId?: string
}

/* Encabezado de sección con chip de icono de color */
function SectionHeader({ icon, color, title, hint }: {
  icon: React.ReactNode; color: string; title: string; hint?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <h3 className="font-semibold text-gray-900 text-[15px] leading-tight">{title}</h3>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  )
}

export default function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [costPrice, setCostPrice] = useState(product?.cost_price?.toString() ?? '0')
  const [salePrice, setSalePrice] = useState(product?.sale_price?.toString() ?? '')
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0')
  const [currency, setCurrency] = useState(product?.currency ?? 'MXN')
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? '')
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false)
  const [isNew, setIsNew] = useState(product?.is_new ?? true)
  const [isActive, setIsActive] = useState(product?.is_active ?? true)

  const [variantGroups, setVariantGroups] = useState<ProductVariantGroup[]>(
    Array.isArray(product?.variants) ? product.variants : []
  )
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const isEditing = !!product
  const margin = salePrice && costPrice
    ? Math.max(0, ((parseFloat(salePrice) - parseFloat(costPrice)) / parseFloat(salePrice)) * 100)
    : 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('is_featured', isFeatured.toString())
    formData.set('is_new', isNew.toString())
    formData.set('is_active', isActive.toString())
    formData.set('category_id', categoryId)
    formData.set('currency', currency)
    formData.set('variants', JSON.stringify(variantGroups))

    startTransition(async () => {
      if (isEditing) {
        const result = await updateProductAction(product.id, formData)
        if (result.success) toast.success('Producto actualizado')
        else toast.error(result.error ?? 'Error al guardar')
        return
      }

      const result = await createProductAction(formData)
      if (!result.success || !('id' in result) || !result.id) {
        toast.error(result.error ?? 'Error al crear el producto')
        return
      }
      const newId = result.id

      if (pendingFiles.length > 0) {
        setPhotoProgress({ done: 0, total: pendingFiles.length })
        for (let i = 0; i < pendingFiles.length; i++) {
          const fd = new FormData()
          fd.set('file', pendingFiles[i])
          const up = await uploadProductImageAction(newId, fd)
          if (!up.success) toast.error(`No se pudo subir una foto${up.error ? ': ' + up.error : ''}`)
          setPhotoProgress({ done: i + 1, total: pendingFiles.length })
        }
        setPhotoProgress(null)
      }

      toast.success('Producto creado con éxito')
      router.push(`/inventory/${newId}`)
    })
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return
    setIsDeleting(true)
    const result = await deleteProductAction(product.id)
    if (!result.success) {
      toast.error(result.error ?? 'Error al eliminar')
      setIsDeleting(false)
    }
  }

  const saveLabel = photoProgress
    ? `Subiendo fotos (${photoProgress.done}/${photoProgress.total})…`
    : isEditing ? 'Guardar cambios' : 'Crear producto'

  const inputCls = 'h-11 rounded-xl'

  return (
    <form onSubmit={handleSubmit} className="pb-28">
      {/* ─── Encabezado ─────────────────────────────────── */}
      <div className="mb-6">
        <button type="button" onClick={() => router.push('/inventory')}
          className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-3 transition-colors">
          ← Volver a Inventario
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Box size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
              {isEditing ? product.name : 'Nuevo producto'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isEditing ? 'Edita los datos y guarda los cambios' : 'Agrega fotos, precio y stock para publicarlo'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Columna principal ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* FOTOS — hero */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <SectionHeader
              icon={<ImagePlus size={18} className="text-white" />}
              color="bg-gradient-to-br from-pink-500 to-rose-500"
              title="Fotos del producto"
              hint="Una buena foto vende más. La primera será la principal."
            />
            {isEditing ? (
              <ImageUploader productId={product.id} initialImages={product.product_images ?? []} maxImages={10} />
            ) : (
              <ImageUploader maxImages={10} onPendingFilesChange={setPendingFiles} />
            )}
          </div>

          {/* INFORMACIÓN */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <SectionHeader
              icon={<Package size={18} className="text-white" />}
              color="bg-gradient-to-br from-blue-500 to-indigo-500"
              title="Información del producto"
            />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre del producto *</Label>
                <Input id="name" name="name" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Playera Básica, Collar Plata 925" required className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Descripción</Label>
                <textarea id="description" name="description" value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Material, colores, medidas, detalles…"
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 resize-none" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU (código interno, opcional)</Label>
                <Input id="sku" name="sku" value={sku} onChange={e => setSku(e.target.value)}
                  placeholder="Ej: PB-ROJ-XL" className={inputCls} />
              </div>

              {/* Código de barras + ESCÁNER prominente */}
              <div className="space-y-1.5">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input id="barcode" name="barcode" value={barcode}
                  onChange={e => setBarcode(e.target.value)} placeholder="Escríbelo o escanéalo con la cámara"
                  inputMode="numeric" className={inputCls} />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="w-full mt-1 flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 text-indigo-700 font-semibold text-sm hover:bg-indigo-100 hover:border-indigo-300 transition-all active:scale-[0.99]"
                >
                  <ScanLine size={19} /> Escanear código de barras con la cámara
                </button>
              </div>
            </div>
          </div>

          {/* PRECIOS */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <SectionHeader
              icon={<Tag size={18} className="text-white" />}
              color="bg-gradient-to-br from-emerald-500 to-green-500"
              title="Precios e inventario"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cost_price">Costo</Label>
                  <Input id="cost_price" name="cost_price" type="number" step="0.01" min="0"
                    value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sale_price">Precio venta *</Label>
                  <Input id="sale_price" name="sale_price" type="number" step="0.01" min="0.01"
                    value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" required className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Stock</Label>
                  <Input id="stock" name="stock" type="number" step="1" min="0"
                    value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Moneda de venta</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400">Cada producto puede venderse en su propia moneda.</p>
              </div>

              {margin > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
                  <Sparkles size={16} className="text-green-600 flex-shrink-0" />
                  <div className="text-sm text-green-700">
                    <span className="font-semibold">Margen {margin.toFixed(1)}%</span>
                    <span className="text-green-600 ml-2">
                      · Ganas ${(parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2)} por venta
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* VARIANTES */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <SectionHeader
              icon={<Layers size={18} className="text-white" />}
              color="bg-gradient-to-br from-violet-500 to-purple-600"
              title="Variantes (opcional)"
              hint="Colores, tallas, materiales... El cliente elige antes de comprar."
            />
            <div className="space-y-3">
              {variantGroups.map((group, gi) => (
                <div key={gi} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={group.name}
                      onChange={e => setVariantGroups(gs => gs.map((g, i) => i === gi ? { ...g, name: e.target.value } : g))}
                      placeholder="Nombre del grupo (ej: Color, Talla)"
                      className="flex-1 h-8 rounded-lg border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-violet-400"
                    />
                    <button type="button" onClick={() => setVariantGroups(gs => gs.filter((_, i) => i !== gi))}
                      className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {group.values.map((val, vi) => (
                      <span key={vi} className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-xs rounded-full px-2.5 py-0.5 font-medium">
                        {val}
                        <button type="button" onClick={() => setVariantGroups(gs => gs.map((g, i) => i === gi ? { ...g, values: g.values.filter((_, j) => j !== vi) } : g))}
                          className="text-violet-400 hover:text-red-500 ml-0.5"><XIcon size={10} /></button>
                      </span>
                    ))}
                    <input
                      placeholder="+ valor y Enter"
                      className="h-7 rounded-full border border-dashed border-gray-300 px-3 text-xs text-gray-500 focus:outline-none focus:border-violet-400 min-w-[100px] bg-white"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const v = e.currentTarget.value.trim()
                          if (v) { setVariantGroups(gs => gs.map((g, i) => i === gi ? { ...g, values: [...g.values, v] } : g)); e.currentTarget.value = '' }
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
              <button type="button"
                onClick={() => setVariantGroups(gs => [...gs, { name: '', values: [] }])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800">
                <Plus size={15} /> Agregar grupo de variante
              </button>
            </div>
          </div>
        </div>

        {/* ─── Columna lateral ───────────────────────────── */}
        <div className="space-y-5">
          {/* Estado */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 text-[15px] mb-3">Visibilidad</h3>
            <div className="space-y-2.5">
              {[
                { checked: isActive, set: setIsActive, title: 'Activo', desc: 'Visible en el catálogo' },
                { checked: isFeatured, set: setIsFeatured, title: 'Destacado', desc: 'Aparece primero' },
                { checked: isNew, set: setIsNew, title: 'Nuevo', desc: 'Muestra badge "Nuevo"' },
              ].map(({ checked, set, title, desc }) => (
                <label key={title}
                  className={`flex items-center gap-3 cursor-pointer rounded-xl border p-2.5 transition-all ${
                    checked ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                  <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Categoría — select nativo (legible, sin el bug del UUID) */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 text-[15px] mb-3">Categoría</h3>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <option value="">Sin categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">
                <a href="/inventory/categories" className="text-blue-600 hover:underline">Crea categorías</a>{' '}
                para organizar tus productos
              </p>
            )}
          </div>

          {/* Stats (edición) */}
          {isEditing && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 text-[15px] mb-3">Estadísticas</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Stock actual</span>
                  <Badge className={stock === '0' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                    {product.stock} uds
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total vendido</span>
                  <span className="font-medium">{product.total_sold} uds</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de acciones fija */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 lg:px-6 py-3 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push('/inventory')}>Cancelar</Button>
          <div className="flex gap-2">
            {isEditing && (
              <Button type="button" variant="outline" onClick={handleDelete} disabled={isDeleting}
                className="text-red-600 hover:bg-red-50 border-red-200">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 size={15} className="mr-1.5" /> Eliminar</>}
              </Button>
            )}
            <Button type="submit" disabled={isPending} className="min-w-48 h-11">
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {photoProgress ? saveLabel : 'Guardando...'}</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> {saveLabel}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Escáner de código de barras (cámara) */}
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={setBarcode} />
    </form>
  )
}
