/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.125'
export const APP_BUILD = '2026-07-20' // v7.125: Configuración reorganizada en 6 pestañas (Cobros y Pagos · Vender Online · Redes · Información · Diseño y Colores · Notificaciones) con show/hide (un solo Guardar). Paletas reducidas a 6 premium; color por defecto "Azul Noche" (#0F172A + acento oro). Vender Online bloqueado en plan Gratis con CTA a Suscripción. Mensaje de desarrollo continuo en /subscription. // v7.124: enlaces legales en /subscription — al "Enviar" se captura guía + paquetería (modal), fecha automática, historial de estados, correo automático al cliente (Resend, opcional) y mensaje de WhatsApp listo para copiar; página pública /rastreo/[orderNo] con línea de tiempo. PROTECCIÓN LEGAL — páginas /terminos y /privacidad, footer legal en landing/login/catálogo, checkbox obligatorio en registro, y /reportar (tienda o pedido). Migración 054 (tracking_number, shipping_carrier, shipped_at, status_history + tabla reports).
