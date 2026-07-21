/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.123'
export const APP_BUILD = '2026-07-20' // v7.123: SEGUIMIENTO DE PEDIDOS — al "Enviar" se captura guía + paquetería (modal), fecha automática, historial de estados, correo automático al cliente (Resend, opcional) y mensaje de WhatsApp listo para copiar; página pública /rastreo/[orderNo] con línea de tiempo. PROTECCIÓN LEGAL — páginas /terminos y /privacidad, footer legal en landing/login/catálogo, checkbox obligatorio en registro, y /reportar (tienda o pedido). Migración 054 (tracking_number, shipping_carrier, shipped_at, status_history + tabla reports).
