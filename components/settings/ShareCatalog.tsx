'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Share2, ExternalLink, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  slug: string
  storeName: string
}

/**
 * Tarjeta para compartir el catálogo público: copiar link, compartir
 * (Web Share API en móvil) y abrir. Construye la URL con el dominio real
 * (window.location.origin) para que funcione en producción (Vercel).
 */
export default function ShareCatalog({ slug, storeName }: Props) {
  const path = `/catalog/${slug}`
  const [url, setUrl] = useState(path)
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`)
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share)
  }, [path])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('¡Link copiado! Ya puedes pegarlo donde quieras.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Copia el link manualmente.')
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storeName,
          text: `Mira el catálogo de ${storeName} 🛍️`,
          url,
        })
      } catch {
        /* el usuario canceló: ignorar */
      }
    } else {
      copyLink()
    }
  }

  const prettyUrl = url.replace(/^https?:\/\//, '')

  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 size={16} className="text-blue-600" />
        <p className="font-semibold text-sm text-gray-900">Comparte tu catálogo</p>
      </div>

      {/* URL */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
        <span className="flex-1 text-xs sm:text-sm text-gray-600 truncate">{prettyUrl}</span>
        <button
          type="button"
          onClick={copyLink}
          className="flex-shrink-0 text-blue-600 hover:text-blue-700 p-1"
          aria-label="Copiar link"
        >
          {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        </button>
      </div>

      {/* Botones */}
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
          {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={share} className="gap-1.5">
          <Share2 size={15} /> Compartir
        </Button>
        <a href={path} target="_blank" rel="noopener noreferrer">
          <Button type="button" size="sm" className="w-full gap-1.5">
            <ExternalLink size={15} /> Ver
          </Button>
        </a>
      </div>

      <p className="text-[11px] text-gray-400 flex items-center gap-1">
        <QrCode size={12} /> {canNativeShare ? 'Compártelo por WhatsApp, Instagram, donde quieras.' : 'Pega el link en tus redes y stories.'}
      </p>
    </div>
  )
}
