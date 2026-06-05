'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save, Trash2, ScanLine, ImagePlus, Tag, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import ImageUploader from './ImageUploader'
import BarcodeScanner from './BarcodeScanner'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  uploadProductImageAction,
} from '@/lib/actions/products'
import type { Product, Category } from '@/lib/types'

interface ProductFormProps {
  product?: Product
  categories: Category[]
  storeId?: string
}

export default function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)

  // Campos del formulario
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [costPrice, setCostPrice] = useState(product?.cost_price?.toString() ?? '0')
  const [salePrice, setSalePrice] = useState(product?.sale_price?.toString() ?? '')
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0')
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? '')
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false)
  const [isNew, setIsNew] = useState(product?.is_new ?? true)
  const [isActive, setIsActive] = useState(product?.is_active ?? true)

  // Fotos pendientes (solo en creación) + escáner
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

    startTransition(async () => {
      // ─── Edición ───────────────────────────────────────────
      if (isEditing) {
        const result = await updateProductAction(product.id, formData)
        if (result.success) toast.success('Producto actualizado')
        else toast.error(result.error ?? 'Error al guardar')
        return
      }

      // ─── Creación ──────────────────────────────────────────
      const result = await createProductAction(formData)
      if (!result.success || !('id' in result) || !result.id) {
        toast.error(result.error ?? 'Error al crear el producto')
        return
      }
      const newId = result.id

      // Subir las fotos elegidas durante la creación
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28 max-w-5xl">
      {/* Header con breadcrumb */}
      <div>
        <button type="button" onClick={() => router.push('/inventory')}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
          ← Inventario
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {isEditing ? product.name : 'Nuevo producto'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isEditing ? 'Edita los datos y guarda los cambios' : 'Agrega fotos, precio y stock para publicarlo en tu catálogo'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Columna izquierda ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* FOTOS — ahora también al crear (lo primero, lo más importante) */}
          <Card className="border-0 shadow-sm ring-1 ring-blue-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ImagePlus size={17} className="text-blue-600" /> Fotos del producto
                <span className="text-xs font-normal text-gray-400 ml-1">La primera es la principal</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <ImageUploader productId={product.id} initialImages={product.product_images ?? []} maxImages={10} />
              ) : (
                <ImageUploader maxImages={10} onPendingFilesChange={setPendingFiles} />
              )}
            </CardContent>
          </Card>

          {/* Información básica */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Package size={17} className="text-gray-400" /> Información básica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del producto *</Label>
                <Input id="name" name="name" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Playera Básica, Collar Plata 925" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea id="description" name="description" value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe el producto: material, colores, medidas..."
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU (código interno)</Label>
                  <Input id="sku" name="sku" value={sku} onChange={e => setSku(e.target.value)}
                    placeholder="Ej: PB-ROJ-XL" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Código de barras</Label>
                  <div className="flex gap-2">
                    <Input id="barcode" name="barcode" value={barcode}
                      onChange={e => setBarcode(e.target.value)} placeholder="Ej: 7501234567890"
                      inputMode="numeric" />
                    <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}
                      className="flex-shrink-0 gap-1.5 px-3" title="Escanear con la cámara">
                      <ScanLine size={16} /> <span className="hidden sm:inline">Escanear</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Precios */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag size={17} className="text-gray-400" /> Precios e inventario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Costo (MXN)</Label>
                  <Input id="cost_price" name="cost_price" type="number" step="0.01" min="0"
                    value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale_price">Precio venta (MXN) *</Label>
                  <Input id="sale_price" name="sale_price" type="number" step="0.01" min="0.01"
                    value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock inicial</Label>
                  <Input id="stock" name="stock" type="number" step="1" min="0"
                    value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
                </div>
              </div>

              {margin > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-700">
                    <span className="font-semibold">Margen: {margin.toFixed(1)}%</span>
                    <span className="text-green-600 ml-2">
                      Ganancia por venta: ${(parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2)} MXN
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Columna derecha ───────────────────────────── */}
        <div className="space-y-4">
          {/* Estado */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Estado</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { checked: isActive, set: setIsActive, title: 'Activo', desc: 'Visible en el catálogo' },
                { checked: isFeatured, set: setIsFeatured, title: 'Destacado', desc: 'Aparece primero en el catálogo' },
                { checked: isNew, set: setIsNew, title: 'Nuevo', desc: 'Muestra badge "Nuevo"' },
              ].map(({ checked, set, title, desc }) => (
                <label key={title} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Categoría */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Categoría</CardTitle></CardHeader>
            <CardContent>
              <Select value={categoryId || 'none'}
                onValueChange={(v: string | null) => setCategoryId(!v || v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  <a href="/inventory/categories" className="text-blue-600 hover:underline">Crea categorías</a>{' '}
                  para organizar tus productos
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stats (solo edición) */}
          {isEditing && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Estadísticas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Stock actual</span>
                  <Badge className={stock === '0' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                    {product.stock} uds
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total vendido</span>
                  <span className="font-medium">{product.total_sold} uds</span>
                </div>
              </CardContent>
            </Card>
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
