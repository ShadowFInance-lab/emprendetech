// Utilidades de envío / seguimiento de pedidos. Módulo PURO (sin secretos ni
// process.env sensibles) → seguro de importar tanto en servidor como en cliente.

/** Paqueterías ofrecidas al marcar "Enviado". */
export const CARRIERS = [
  'Estafeta', 'DHL', 'FedEx', 'UPS', 'Correos de México', '99 Minutos', 'Otro',
] as const
export type Carrier = typeof CARRIERS[number]

/** Etapas visibles para el cliente en el rastreo (el pedido nace "pagado"). */
export const CUSTOMER_STEPS = [
  { key: 'pagado', label: 'Pago confirmado', desc: 'Recibimos tu pago' },
  { key: 'preparando', label: 'Preparando', desc: 'El negocio está preparando tu pedido' },
  { key: 'enviado', label: 'Enviado', desc: 'Tu paquete va en camino' },
  { key: 'entregado', label: 'Entregado', desc: '¡Pedido entregado!' },
] as const

/**
 * Link de rastreo de la paquetería. Para las conocidas usa su rastreador; para
 * las demás (Correos de México / Otro) cae a una búsqueda de Google — así el
 * enlace NUNCA queda roto. Devuelve null si no hay número de guía.
 */
export function trackingUrl(carrier?: string | null, guide?: string | null): string | null {
  if (!guide || !guide.trim()) return null
  const g = encodeURIComponent(guide.trim())
  const c = (carrier || '').toLowerCase()
  if (c.includes('dhl')) return `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${g}`
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${g}`
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${g}`
  if (c.includes('estafeta')) return `https://www.estafeta.com/herramientas/rastreo?guias=${g}`
  if (c.includes('99')) return `https://99minutos.com/rastreo/?tracking=${g}`
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || 'rastreo'} ${guide}`)}`
}

/** Mensaje de WhatsApp listo para copiar/enviar cuando el pedido se envía. */
export function buildShipWhatsApp(p: {
  store?: string | null; orderNo?: string | null
  carrier?: string | null; guide?: string | null
  carrierUrl?: string | null; trackUrl: string
}): string {
  return [
    `¡Hola! 📦 Tu pedido *${p.orderNo || ''}* de *${p.store || 'la tienda'}* ya fue enviado.`,
    p.carrier ? `Paquetería: ${p.carrier}` : '',
    p.guide ? `Número de guía: ${p.guide}` : '',
    p.carrierUrl ? `Rastrea tu paquete: ${p.carrierUrl}` : '',
    `Sigue el estado de tu pedido aquí: ${p.trackUrl}`,
    '',
    '¡Gracias por tu compra! 🙌',
  ].filter(Boolean).join('\n')
}

/** HTML del correo automático "tu pedido va en camino". Estilos inline (email). */
export function buildShipmentEmailHtml(p: {
  storeName?: string | null; orderNo?: string | null
  carrier?: string | null; guide?: string | null
  carrierUrl?: string | null; trackUrl: string
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px">${label}</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;text-align:right">${value}</td></tr>`
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center">
        <div style="font-size:30px">📦</div>
        <h1 style="margin:8px 0 0;color:#fff;font-size:20px">¡Tu pedido va en camino!</h1>
      </div>
      <div style="padding:24px">
        <p style="color:#374151;font-size:14px;margin:0 0 16px">Hola, tu pedido de <strong>${p.storeName || 'la tienda'}</strong> ya fue enviado.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          ${p.orderNo ? row('Pedido', p.orderNo) : ''}
          ${p.carrier ? row('Paquetería', p.carrier) : ''}
          ${p.guide ? row('Número de guía', p.guide) : ''}
        </table>
        ${p.carrierUrl ? `<a href="${p.carrierUrl}" style="display:block;text-align:center;background:#111827;color:#fff;text-decoration:none;padding:12px;border-radius:10px;font-weight:700;font-size:14px;margin-bottom:10px">Rastrear mi paquete</a>` : ''}
        <a href="${p.trackUrl}" style="display:block;text-align:center;background:#4f46e5;color:#fff;text-decoration:none;padding:12px;border-radius:10px;font-weight:700;font-size:14px">Ver estado de mi pedido</a>
        <p style="color:#9ca3af;font-size:12px;margin:18px 0 0;text-align:center">¡Gracias por tu compra! Si tienes dudas, responde este correo o contacta directamente a la tienda.</p>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:14px 0 0">Enviado por Mercanta Business en nombre de ${p.storeName || 'la tienda'}.</p>
  </div></body></html>`
}
