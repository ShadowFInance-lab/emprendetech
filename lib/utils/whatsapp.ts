/**
 * Limpia un número de teléfono para usar en wa.me
 * "+52 55 1234 5678" → "525512345678"
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/**
 * Genera un link de WhatsApp para contactar a una tienda.
 */
export function buildStoreWhatsAppLink(phone: string, storeName: string): string {
  const clean = cleanPhone(phone)
  const text = encodeURIComponent(
    `Hola, vi tu catálogo de *${storeName}* y me gustaría más información. 👋`
  )
  return `https://wa.me/${clean}?text=${text}`
}

/**
 * Genera un link de WhatsApp para pedir un producto específico.
 */
export function buildProductWhatsAppLink(
  phone: string,
  productName: string,
  price: number,
  storeName: string,
  catalogUrl: string
): string {
  const clean = cleanPhone(phone)
  const formattedPrice = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(price)

  const text = encodeURIComponent(
    `Hola! Me interesa este producto de *${storeName}*:\n\n` +
    `📦 *${productName}*\n` +
    `💰 Precio: ${formattedPrice}\n\n` +
    `Vi tu catálogo en:\n${catalogUrl}`
  )
  return `https://wa.me/${clean}?text=${text}`
}
