'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Star, Loader2, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  uploadProductImageAction,
  deleteProductImageAction,
  setPrimaryImageAction,
} from '@/lib/actions/products'
import type { ProductImage } from '@/lib/types'

interface ImageUploaderProps {
  productId: string
  initialImages?: ProductImage[]
  maxImages?: number
}

export default function ImageUploader({
  productId,
  initialImages = [],
  maxImages = 10,
}: ImageUploaderProps) {
  const [images, setImages] = useState<ProductImage[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const remaining = maxImages - images.length
      const toUpload = acceptedFiles.slice(0, remaining)

      if (acceptedFiles.length > remaining) {
        toast.warning(`Máximo ${maxImages} imágenes. Solo se subirán las primeras ${remaining}.`)
      }

      setUploading(true)
      let successCount = 0

      for (const file of toUpload) {
        const formData = new FormData()
        formData.set('file', file)
        const result = await uploadProductImageAction(productId, formData)

        if (result.success && result.url && result.imageId) {
          setImages(prev => [
            ...prev,
            {
              id: result.imageId!,
              product_id: productId,
              url: result.url!,
              is_primary: prev.length === 0,
              sort_order: prev.length,
              created_at: new Date().toISOString(),
            },
          ])
          successCount++
        } else {
          toast.error(result.error ?? 'Error al subir imagen')
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} imagen${successCount > 1 ? 'es' : ''} subida${successCount > 1 ? 's' : ''}`)
      }

      setUploading(false)
    },
    [productId, images.length, maxImages]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    disabled: uploading || images.length >= maxImages,
  })

  async function handleDelete(imageId: string) {
    setDeletingId(imageId)
    const result = await deleteProductImageAction(imageId, productId)
    if (result.success) {
      setImages(prev => {
        const filtered = prev.filter(i => i.id !== imageId)
        // Si se eliminó la principal, hacer principal la primera restante
        const wasPrimary = prev.find(i => i.id === imageId)?.is_primary
        if (wasPrimary && filtered.length > 0) {
          filtered[0].is_primary = true
        }
        return filtered
      })
      toast.success('Imagen eliminada')
    } else {
      toast.error(result.error ?? 'Error al eliminar')
    }
    setDeletingId(null)
  }

  async function handleSetPrimary(imageId: string) {
    const result = await setPrimaryImageAction(imageId, productId)
    if (result.success) {
      setImages(prev =>
        prev.map(img => ({ ...img, is_primary: img.id === imageId }))
      )
      toast.success('Imagen principal actualizada')
    }
  }

  return (
    <div className="space-y-4">
      {/* Grid de imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map(image => (
            <div
              key={image.id}
              className={`relative group rounded-xl overflow-hidden border-2 aspect-square bg-gray-50 ${
                image.is_primary ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt="Producto"
                className="w-full h-full object-cover"
              />

              {/* Badge principal */}
              {image.is_primary && (
                <div className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star size={8} fill="white" /> Principal
                </div>
              )}

              {/* Overlay de acciones */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                {!image.is_primary && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-[10px] h-7 px-2"
                    onClick={() => handleSetPrimary(image.id)}
                  >
                    <Star size={10} className="mr-1" /> Principal
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-[10px] h-7 px-2"
                  onClick={() => handleDelete(image.id)}
                  disabled={deletingId === image.id}
                >
                  {deletingId === image.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <><X size={10} className="mr-1" /> Eliminar</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dropzone + Cámara */}
      {images.length < maxImages && (
        <div className="space-y-2">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}
              ${uploading ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2 text-gray-500">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              ) : (
                <Upload className="h-8 w-8 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-sm text-gray-700">
                  {isDragActive
                    ? '¡Suelta las imágenes aquí!'
                    : uploading
                      ? 'Subiendo imágenes...'
                      : 'Arrastra imágenes o haz clic para seleccionar'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, WebP • Máx 5MB por imagen •{' '}
                  {images.length}/{maxImages} imágenes
                </p>
              </div>
            </div>
          </div>

          {/* Botón de cámara (abre la cámara en móvil) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onDrop([file])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-60"
          >
            <Camera size={20} />
            Tomar foto con la cámara
          </button>
        </div>
      )}
    </div>
  )
}
