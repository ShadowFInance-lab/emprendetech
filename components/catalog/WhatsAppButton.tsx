import { MessageCircle } from 'lucide-react'
import { buildProductWhatsAppLink, buildStoreWhatsAppLink } from '@/lib/utils/whatsapp'

interface WhatsAppButtonProps {
  /** Número de WhatsApp de la tienda (con o sin formato) */
  phone: string
  /** Nombre de la tienda */
  storeName: string
  /** Si se pasa un producto, genera el mensaje de pedido de ese producto */
  product?: {
    name: string
    price: number
    url: string
  }
  /** Variante visual */
  variant?: 'solid' | 'outline' | 'floating' | 'text'
  /** Color de fondo (para variante solid) */
  color?: string
  /** Texto del botón (default según contexto) */
  label?: string
  /** Tamaño del ícono */
  iconSize?: number
  className?: string
}

/**
 * Botón reutilizable de WhatsApp.
 * - Si recibe `product`, genera el mensaje de pedido con nombre + precio + URL.
 * - Si no, genera el mensaje genérico de contacto a la tienda.
 *
 * Usa los helpers de `lib/utils/whatsapp.ts`.
 */
export default function WhatsAppButton({
  phone,
  storeName,
  product,
  variant = 'solid',
  color = '#16A34A',
  label,
  iconSize = 16,
  className = '',
}: WhatsAppButtonProps) {
  if (!phone) return null

  const href = product
    ? buildProductWhatsAppLink(phone, product.name, product.price, storeName, product.url)
    : buildStoreWhatsAppLink(phone, storeName)

  const defaultLabel = product ? 'Pedir por WhatsApp' : 'Contactar'
  const text = label ?? defaultLabel

  // ─── Estilos por variante ──────────────────────────────────
  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all'

  const variants: Record<string, string> = {
    solid: 'text-white rounded-xl px-4 py-2.5 text-sm hover:opacity-90 active:scale-[0.98]',
    outline: 'border-2 rounded-xl px-4 py-2.5 text-sm hover:bg-gray-50',
    text: 'text-sm hover:underline underline-offset-4',
    floating: 'fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full px-4 py-3 shadow-xl hover:scale-105',
  }

  const style: React.CSSProperties =
    variant === 'solid' ? { backgroundColor: color }
      : variant === 'outline' ? { borderColor: color, color }
        : variant === 'text' ? { color }
          : {}

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${variants[variant]} ${className}`}
      style={style}
      aria-label={text}
    >
      <MessageCircle size={iconSize} />
      {variant === 'floating' ? (
        <span className="text-sm hidden sm:inline">{text}</span>
      ) : (
        <span>{text}</span>
      )}
    </a>
  )
}
