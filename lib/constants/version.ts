/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.118'
export const APP_BUILD = '2026-07-13' // v7.118: FIX del error "migración 038" al crear pedidos — era el insert().select() de v7.117 contra RLS de comprador anónimo; ahora el id del pedido se genera en el servidor (insert puro). Checkout solo-Stripe, pestañas y OAuth canónico re-verificados con grep.
